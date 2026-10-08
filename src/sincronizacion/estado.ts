import { useSyncExternalStore } from 'react';

import { reintentarCambio, descartarCambio } from './acciones.ts';
import {
  avisarQueLaColaCambio,
  cicloActual,
  suscribirALaCola,
  suscribirAlCiclo,
  type CicloAbierto,
} from './ciclo.ts';
import { iniciarLosDisparadores } from './disparadores.ts';
import {
  META_ULTIMA_SINCRONIZACION,
  type EventoDelMotor,
  type MotivoDeSincronizacion,
  type ResultadoDeSincronizacion,
} from './motor.ts';
import { avisarEnSegundoPlano } from './notificacionLocal.ts';
import { conciliarElDiario as conciliarLaCopiaDelDiario, esTipoDelDiario } from './diarioLocal.ts';
import { precargarLasLecturas } from './precarga.ts';
import { planDeEnvio } from './cola.ts';
import {
  avisoDeSinConexion,
  cambiosParaMostrar,
  construirAviso,
  contarCambios,
  indicadorDe,
  type Aviso,
  type CambioGuardado,
  type ContadoresDeCambios,
  type EstadoDeLaConexion,
  type Indicador,
} from './resumen.ts';

/**
 * Lo que la pantalla sabe de la sincronizacion (SCRUM-137): si hay conexion, si se
 * esta enviando, que cambios siguen guardados en este equipo y el ultimo aviso.
 *
 * Es un almacen pequeno fuera de React, como el de las versiones nuevas
 * (`pwa/versionNueva.ts`), porque lo que lo alimenta —la red, el motor, otras
 * pestanas— no vive en ningun componente. Los componentes lo leen con
 * `useSincronizacion`.
 *
 * ## De donde sale cada cosa
 *
 * - **La conexion** viene de dos sitios: del navegador (`online` y `offline`), que
 *   solo es una pista, y de lo que encuentra el motor al intentar enviar, que es
 *   la verdad. Si el navegador dice que hay red pero la API no responde, el motor
 *   dice `sin_conexion` y esa es la que manda.
 * - **Los cambios** se leen del almacen local cada vez que algo puede haberlos
 *   movido: un cambio en la cola (de esta pestana o de otra), un envio, o la
 *   apertura del almacen.
 * - **El aviso** lo construye `construirAviso` al terminar cada tanda: uno por
 *   tanda, nunca uno por cambio.
 */

export interface AvisoVisible extends Aviso {
  /** Distingue un aviso de otro aunque tengan el mismo texto: asi se anuncia de nuevo. */
  readonly id: number;
}

export interface EstadoDeLaSincronizacion {
  /** Si hay un almacen abierto: sin el no hay nada que mostrar ni enviar. */
  readonly hayAlmacen: boolean;
  readonly conexion: EstadoDeLaConexion;
  readonly sincronizando: boolean;
  readonly contadores: ContadoresDeCambios;
  readonly cambios: readonly CambioGuardado[];
  readonly indicador: Indicador;
  /** La ultima vez que se sincronizo del todo, en ISO 8601. */
  readonly ultimaSincronizacion: string | null;
  readonly aviso: AvisoVisible | null;
  /**
   * Sube cada vez que algo pide abrir la lista de cambios (el boton "Ver la lista"
   * de un aviso). El indicador mira este numero y, cuando cambia, abre la lista.
   */
  readonly peticionDeLista: number;
}

const SIN_CAMBIOS: ContadoresDeCambios = {
  porEnviar: 0,
  requierenAtencion: 0,
  conflictos: 0,
  total: 0,
};

function estadoInicial(conexion: EstadoDeLaConexion): EstadoDeLaSincronizacion {
  return {
    hayAlmacen: false,
    conexion,
    sincronizando: false,
    contadores: SIN_CAMBIOS,
    cambios: [],
    indicador: indicadorDe(conexion, false, SIN_CAMBIOS),
    ultimaSincronizacion: null,
    aviso: null,
    peticionDeLista: 0,
  };
}

// ---------------------------------------------------------------------------
// El almacen
// ---------------------------------------------------------------------------

let estado: EstadoDeLaSincronizacion = estadoInicial('con_conexion');
const oyentes = new Set<() => void>();

function cambiar(cambios: Partial<EstadoDeLaSincronizacion>): void {
  const siguiente = { ...estado, ...cambios };

  // El indicador depende de tres cosas que cambian por separado.
  estado = {
    ...siguiente,
    indicador: indicadorDe(siguiente.conexion, siguiente.sincronizando, siguiente.contadores),
  };
  oyentes.forEach((oyente) => {
    oyente();
  });
}

export function obtenerElEstado(): EstadoDeLaSincronizacion {
  return estado;
}

export function suscribirAlEstado(oyente: () => void): () => void {
  oyentes.add(oyente);

  return () => {
    oyentes.delete(oyente);
  };
}

/** Para los componentes. */
export function useSincronizacion(): EstadoDeLaSincronizacion {
  return useSyncExternalStore(suscribirAlEstado, obtenerElEstado, obtenerElEstado);
}

// ---------------------------------------------------------------------------
// Lo que la persona puede pedir
// ---------------------------------------------------------------------------

/** "Sincronizar ahora". No espera los reintentos programados. */
export async function sincronizarAhora(): Promise<void> {
  await cicloActual()?.motor.sincronizar('manual');
}

/** Devuelve a la cola un cambio rechazado, y lo intenta de una vez. */
export async function reintentar(operationId: string): Promise<void> {
  if (await reintentarCambio(operationId)) {
    await sincronizarAhora();
  }
}

/** Tira un cambio y lo que dependia de el. Devuelve cuantos se quitaron. */
export async function descartar(operationId: string): Promise<number> {
  return (await descartarCambio(operationId)).length;
}

export function descartarElAviso(): void {
  cambiar({ aviso: null });
}

/** Pide que se abra la lista de cambios guardados. */
export function pedirVerLaLista(): void {
  cambiar({ peticionDeLista: estado.peticionDeLista + 1 });
}

// ---------------------------------------------------------------------------
// Lo que lo alimenta
// ---------------------------------------------------------------------------

interface Escucha {
  addEventListener(tipo: string, oyente: () => void): void;
  removeEventListener(tipo: string, oyente: () => void): void;
}

export interface DependenciasDelEstado {
  readonly ventana: Escucha;
  readonly documento: Escucha & { readonly visibilityState: string };
  readonly hayRed: () => boolean;
  readonly reloj: () => Date;
  readonly programar: (tarea: () => void, cadaMs: number) => unknown;
  readonly cancelar: (programacion: unknown) => void;
  /** Muestra la notificacion de "se enviaron". Nunca lanza. */
  readonly notificarEnSegundoPlano: () => void;
  /** Guarda por adelantado lo que sirve para usar la aplicacion sin conexion (SCRUM-138). */
  readonly precargar: () => void;
  /**
   * Pasa a la copia local del diario lo que el servidor acepto y deja marcado cuales
   * anotaciones son copia de otra (SCRUM-139). Se hace aqui y no solo al abrir el diario
   * porque lo enviado se conserva siete dias en la cola: si nadie lo guarda antes, la
   * marca de una copia se perderia. Nunca lanza.
   */
  readonly conciliarElDiario: () => void;
}

function dependenciasReales(): DependenciasDelEstado {
  return {
    ventana: window,
    documento: document,
    hayRed: () => navigator.onLine,
    reloj: () => new Date(),
    programar: (tarea, cadaMs) => setInterval(tarea, cadaMs),
    cancelar: (programacion) => {
      clearInterval(programacion as ReturnType<typeof setInterval>);
    },
    notificarEnSegundoPlano: () => {
      void avisarEnSegundoPlano();
    },
    precargar: () => {
      void precargarLasLecturas();
    },
    conciliarElDiario: () => {
      void conciliarLaCopiaDelDiario();
    },
  };
}

let contadorDeAvisos = 0;

/**
 * Empieza a alimentar el almacen. Devuelve como apagarlo. Se llama una vez, al
 * arrancar la aplicacion.
 */
export function iniciarLaSincronizacionAutomatica(
  dependencias: DependenciasDelEstado = dependenciasReales(),
): () => void {
  const {
    ventana,
    documento,
    hayRed,
    reloj,
    notificarEnSegundoPlano,
    precargar,
    conciliarElDiario,
  } = dependencias;
  let dejarDeEscucharAlMotor: (() => void) | null = null;
  let motivoActual: MotivoDeSincronizacion = 'apertura';
  /** Se supo que no habia conexion desde el ultimo aviso. */
  let huboSinConexion = false;
  /** Cada lectura del almacen lleva un numero: si llega una vieja, se descarta. */
  let ultimaLectura = 0;
  let apagado = false;
  /** De quien fue el ultimo almacen abierto: el aviso de una persona no se le ensena a otra. */
  let ultimaPersona: string | null = null;

  cambiar(estadoInicial(hayRed() ? 'con_conexion' : 'sin_conexion'));

  // ------------------------------ lo guardado ------------------------------

  async function leerLoGuardado(): Promise<void> {
    const ciclo = cicloActual();
    const lectura = ++ultimaLectura;

    if (ciclo === null) {
      cambiar({ contadores: SIN_CAMBIOS, cambios: [] });

      return;
    }

    try {
      const operaciones = await ciclo.almacen.operaciones();

      if (apagado || lectura !== ultimaLectura) {
        return;
      }

      cambiar({
        contadores: contarCambios(operaciones),
        cambios: cambiosParaMostrar([...operaciones], reloj()),
      });
    } catch {
      // El almacen se cerro mientras se leia (cerro la sesion): no hay nada que mostrar.
    }
  }

  async function leerLaUltimaSincronizacion(ciclo: CicloAbierto): Promise<void> {
    try {
      const valor = await ciclo.almacen.leerMeta(META_ULTIMA_SINCRONIZACION);

      if (!apagado && cicloActual() === ciclo) {
        cambiar({ ultimaSincronizacion: typeof valor === 'string' ? valor : null });
      }
    } catch {
      // Igual que arriba.
    }
  }

  // --------------------------------- el motor ---------------------------------

  function alTerminarUnaTanda(resultado: ResultadoDeSincronizacion): void {
    const { resumen } = resultado;
    const estabaSinConexion = huboSinConexion;

    // Lo que dice el motor al intentar es mas fiable que lo que dice el navegador.
    if (resultado.estado === 'sin_conexion') {
      huboSinConexion = true;
      cambiar({ conexion: 'sin_conexion', sincronizando: false });
    } else if (resultado.estado === 'terminada' || resultado.estado === 'sesion_vencida') {
      huboSinConexion = false;
      cambiar({ conexion: 'con_conexion', sincronizando: false });
    } else if (resultado.estado === 'nada_que_hacer') {
      huboSinConexion = false;
      cambiar({ sincronizando: false });
    } else {
      cambiar({ sincronizando: false });
    }

    const aviso = construirAviso({
      resultado,
      motivo: motivoActual,
      estabaSinConexion,
      ahora: reloj(),
    });

    if (aviso !== null) {
      contadorDeAvisos += 1;
      cambiar({ aviso: { ...aviso, id: contadorDeAvisos } });

      // Con la aplicacion en segundo plano, nadie ve el aviso: se le dice por fuera.
      if (aviso.enviadas > 0 && documento.visibilityState === 'hidden') {
        notificarEnSegundoPlano();
      }
    }

    const ciclo = cicloActual();

    void leerLoGuardado();

    if (resumen.recibos.some((enviado) => esTipoDelDiario(enviado.tipo))) {
      conciliarElDiario();
    }

    if (ciclo !== null && resultado.estado === 'terminada') {
      void leerLaUltimaSincronizacion(ciclo);
    }

    // Lo que cambio al enviar, que lo sepan las otras pestanas.
    if (resumen.enviadas + resumen.requierenAtencion + resumen.conflictos > 0) {
      avisarQueLaColaCambio();
    }
  }

  function alEventoDelMotor(evento: EventoDelMotor): void {
    if (evento.tipo === 'inicio') {
      motivoActual = evento.motivo;
      cambiar({ sincronizando: true });
    } else if (evento.tipo === 'enviada') {
      void leerLoGuardado();

      // Una tanda puede cortarse a la mitad: lo que ya salio se guarda sin esperar a su fin.
      if (esTipoDelDiario(evento.operacion.tipo)) {
        conciliarElDiario();
      }
    } else {
      alTerminarUnaTanda(evento.resultado);
    }
  }

  // ------------------------------ el almacen ------------------------------

  function alCambiarElAlmacen(): void {
    dejarDeEscucharAlMotor?.();
    dejarDeEscucharAlMotor = null;

    const ciclo = cicloActual();

    if (ciclo === null) {
      // El aviso se queda: "tu sesion vencio, entra de nuevo" se lee justo despues de
      // que el almacen se cierra, y es cuando mas hace falta.
      cambiar({
        hayAlmacen: false,
        sincronizando: false,
        ultimaSincronizacion: null,
        contadores: SIN_CAMBIOS,
        cambios: [],
      });
      ultimaLectura += 1;

      return;
    }

    // Entra otra persona, o la misma que volvio a entrar tras "tu sesion vencio": el
    // aviso anterior ya no le toca.
    const quitarElAviso = ciclo.persona !== ultimaPersona || estado.aviso?.pedirEntrar === true;

    ultimaPersona = ciclo.persona;
    dejarDeEscucharAlMotor = ciclo.motor.suscribir(alEventoDelMotor);
    cambiar({
      hayAlmacen: true,
      sincronizando: ciclo.motor.estaSincronizando(),
      ...(quitarElAviso ? { aviso: null } : {}),
    });
    void leerLoGuardado();
    void leerLaUltimaSincronizacion(ciclo);

    // Con conexion y una persona dentro, se deja guardado lo que hace falta para
    // usar la aplicacion cuando no la haya.
    if (hayRed()) {
      precargar();
    }
  }

  // -------------------------------- la red --------------------------------

  function alPerderseLaRed(): void {
    huboSinConexion = true;
    cambiar({
      conexion: 'sin_conexion',
      ...(estado.hayAlmacen ? { aviso: { ...avisoDeSinConexion(), id: ++contadorDeAvisos } } : {}),
    });
  }

  function alVolverLaRed(): void {
    // Una pista: hasta que el motor intente, no se sabe si la API responde. Lo que
    // se avisaba de la falta de conexion ya no vale.
    cambiar({
      conexion: 'con_conexion',
      ...(estado.aviso?.tono === 'info' ? { aviso: null } : {}),
    });

    // Si algo no se pudo guardar por adelantado por falta de red, ahora si.
    if (estado.hayAlmacen) {
      precargar();
    }
  }

  // ------------------------------- poner en marcha -------------------------------

  ventana.addEventListener('offline', alPerderseLaRed);
  ventana.addEventListener('online', alVolverLaRed);

  const dejarDeEscucharElCiclo = suscribirAlCiclo(alCambiarElAlmacen);
  const dejarDeEscucharLaCola = suscribirALaCola(() => {
    void leerLoGuardado();
  });

  const apagarLosDisparadores = iniciarLosDisparadores({
    ventana,
    documento,
    hayRed,
    sincronizar: (motivo) => {
      void cicloActual()?.motor.sincronizar(motivo);
    },
    hayAlgoListo: async () => {
      const ciclo = cicloActual();

      if (ciclo === null) {
        return false;
      }

      return planDeEnvio(await ciclo.almacen.operaciones(), reloj()).listas.length > 0;
    },
    alCambiarElAlmacen: suscribirAlCiclo,
    hayAlmacen: () => cicloActual() !== null,
    alCambiarLaCola: suscribirALaCola,
    programar: dependencias.programar,
    cancelar: dependencias.cancelar,
    ahora: () => reloj().getTime(),
  });

  // Si el almacen ya estaba abierto cuando se arranco.
  alCambiarElAlmacen();

  return () => {
    apagado = true;
    ventana.removeEventListener('offline', alPerderseLaRed);
    ventana.removeEventListener('online', alVolverLaRed);
    dejarDeEscucharElCiclo();
    dejarDeEscucharLaCola();
    dejarDeEscucharAlMotor?.();
    apagarLosDisparadores();
  };
}

/** Solo para las pruebas. */
export function reiniciarElEstadoParaLasPruebas(): void {
  estado = estadoInicial('con_conexion');
  oyentes.clear();
  contadorDeAvisos = 0;
}
