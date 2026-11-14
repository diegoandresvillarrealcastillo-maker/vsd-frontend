import type { MotivoDeSincronizacion } from './motor.ts';

/**
 * Lo que hace que la aplicacion sincronice **sola** (SCRUM-137, HU_MF09_002).
 *
 * El motor sabe *como* enviar; esto decide *cuando*. Cinco cosas lo ponen en
 * marcha, y todas piden lo mismo: un intento de sincronizar. Si no hay nada que
 * enviar, el motor no toca la red, asi que disparar de mas es barato.
 *
 * | Cuando                                        | Motivo       |
 * | --------------------------------------------- | ------------ |
 * | Vuelve la red (`online`)                      | `conexion`   |
 * | Se abre el almacen de una persona             | `apertura`   |
 * | Se vuelve a la pestana (`visibilitychange`)   | `apertura`   |
 * | La cola cambia y hay algo listo para enviar   | `programada` |
 * | Cada 30 s, si hay algo listo para enviar      | `programada` |
 *
 * ## Lo que NO es
 *
 * No es sincronizacion en segundo plano con la aplicacion cerrada. Eso lo da la
 * API Background Sync en Chrome y Android, y no existe en Safari. Aqui la
 * sincronizacion automatica ocurre **mientras la aplicacion esta abierta**, aunque
 * sea en una pestana de fondo; con la aplicacion cerrada se envia al abrirla (ver
 * el ADR 0019).
 */

/** Cada cuanto se mira si hay algo listo para enviar. */
export const CADA_CUANTO_SE_MIRA_EN_MS = 30_000;

/** Entre dos vueltas a la pestana, lo minimo que se espera antes de volver a intentar. */
export const ESPERA_ENTRE_VUELTAS_A_LA_PESTANA_EN_MS = 10_000;

interface Escucha {
  addEventListener(tipo: string, oyente: () => void): void;
  removeEventListener(tipo: string, oyente: () => void): void;
}

export interface OpcionesDeLosDisparadores {
  readonly ventana: Escucha;
  readonly documento: Escucha & { readonly visibilityState: string };
  /** Lo que dice el navegador de la red. Solo se confia cuando dice que NO hay. */
  readonly hayRed: () => boolean;
  /** Intenta sincronizar. No hace falta esperarlo: nunca lanza. */
  readonly sincronizar: (motivo: MotivoDeSincronizacion) => void;
  /** Si hay algo que enviar ahora mismo (no cuenta lo que espera su reintento). */
  readonly hayAlgoListo: () => Promise<boolean>;
  /** Avisa cuando se abre o se cierra el almacen de una persona. Devuelve como dejar de escuchar. */
  readonly alCambiarElAlmacen: (oyente: () => void) => () => void;
  /** Si ahora hay un almacen abierto. */
  readonly hayAlmacen: () => boolean;
  /** Avisa cuando la cola cambia (esta pestana u otra). Devuelve como dejar de escuchar. */
  readonly alCambiarLaCola: (oyente: () => void) => () => void;
  readonly programar: (tarea: () => void, cadaMs: number) => unknown;
  readonly cancelar: (programacion: unknown) => void;
  readonly ahora: () => number;
}

/** Pone en marcha los disparadores. Devuelve como apagarlos. */
export function iniciarLosDisparadores(opciones: OpcionesDeLosDisparadores): () => void {
  const {
    ventana,
    documento,
    hayRed,
    sincronizar,
    hayAlgoListo,
    alCambiarElAlmacen,
    hayAlmacen,
    alCambiarLaCola,
    programar,
    cancelar,
    ahora,
  } = opciones;
  let ultimaVueltaALaPestana = Number.NEGATIVE_INFINITY;

  /** Sincroniza si hay algo listo y la red no dice que no. */
  function siHayAlgoListo(motivo: MotivoDeSincronizacion): void {
    if (!hayAlmacen() || !hayRed()) {
      return;
    }

    void hayAlgoListo()
      .then((listo) => {
        if (listo) {
          sincronizar(motivo);
        }
      })
      .catch(() => undefined);
  }

  function alVolverLaRed(): void {
    // Aunque no haya nada que enviar: el motor lo sabe y no toca la red, y asi la
    // aplicacion se entera de que volvio y lo dice.
    if (hayAlmacen()) {
      sincronizar('conexion');
    }
  }

  function alVolverALaPestana(): void {
    if (documento.visibilityState !== 'visible' || !hayAlmacen() || !hayRed()) {
      return;
    }

    const momento = ahora();

    // Cambiar de pestana a cada rato no es motivo para preguntar a cada rato.
    if (momento - ultimaVueltaALaPestana < ESPERA_ENTRE_VUELTAS_A_LA_PESTANA_EN_MS) {
      return;
    }

    ultimaVueltaALaPestana = momento;
    sincronizar('apertura');
  }

  ventana.addEventListener('online', alVolverLaRed);
  documento.addEventListener('visibilitychange', alVolverALaPestana);

  const dejarDeEscucharElAlmacen = alCambiarElAlmacen(() => {
    if (hayAlmacen() && hayRed()) {
      sincronizar('apertura');
    }
  });
  const dejarDeEscucharLaCola = alCambiarLaCola(() => {
    siHayAlgoListo('programada');
  });
  const programacion = programar(() => {
    siHayAlgoListo('programada');
  }, CADA_CUANTO_SE_MIRA_EN_MS);

  return () => {
    ventana.removeEventListener('online', alVolverLaRed);
    documento.removeEventListener('visibilitychange', alVolverALaPestana);
    dejarDeEscucharElAlmacen();
    dejarDeEscucharLaCola();
    cancelar(programacion);
  };
}
