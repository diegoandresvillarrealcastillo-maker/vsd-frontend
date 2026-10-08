import { cicloActual, suscribirALaCola, suscribirAlCiclo, type CicloAbierto } from './ciclo.ts';
import type { ErrorDeOperacion } from './cola.ts';
import { conLimite } from './tiempo.ts';

/**
 * Que paso con algo que se acaba de guardar en la cola (SCRUM-138).
 *
 * Una pantalla que guarda algo —el resultado de una actividad— necesita saber una de
 * cuatro cosas para decirselo a la persona sin mentirle:
 *
 * - **`enviada`**: la API lo acepto, y esto es lo que respondio (la orientacion, por
 *   ejemplo). Se ensena como siempre.
 * - **`guardada`**: sigue en este equipo, sin enviar: no hay conexion, o el servidor
 *   no respondio y se va a reintentar. **Se dice asi**, sin simular que se envio.
 * - **`rechazada`**: la API no lo acepto (o choco con otro dispositivo). No se envia.
 * - **`sin_almacen`**: no hay donde guardar (no hay sesion).
 */
export type Seguimiento =
  | { readonly tipo: 'enviada'; readonly recibo: unknown }
  | { readonly tipo: 'guardada' }
  | {
      readonly tipo: 'rechazada';
      readonly error: ErrorDeOperacion | null;
      /** Choco con otro dispositivo, y no es que la API la haya rechazado. */
      readonly conflicto: boolean;
    }
  | { readonly tipo: 'sin_almacen' };

/**
 * Cuanto se espera a que algo salga antes de decir que quedo guardado en este equipo.
 *
 * Es corto a proposito: lo guardado **ya esta a salvo** en cuanto entra a la cola, y
 * hacer esperar a la persona con "Guardando…" porque la conexion es lenta (o la API
 * estaba dormida) no le sirve de nada. Si sale despues, la pantalla se pone al dia sola.
 */
export const ESPERA_MAXIMA_EN_MS = 5000;

export interface OpcionesDeSeguimiento {
  /** Pide una sincronizacion de una vez: se acaba de encolar y lo normal es que salga ya. */
  readonly sincronizarYa?: boolean;
  /**
   * Cuanto esperar a que salga. Pasado ese tiempo, o en cuanto una sincronizacion
   * termine sin haberlo enviado, se dice `guardada`. `null` espera **todo lo que haga
   * falta**: para seguir algo que ya se sabe que quedo guardado.
   */
  readonly esperaMaximaEnMs?: number | null;
  /** Cancelar el seguimiento (la pantalla se cerro). Devuelve `guardada`: nadie lo espera. */
  readonly senal?: AbortSignal;
}

/**
 * Espera a que **algo cambie** en el motor: termina una tanda, o la cola cambia (en
 * otra pestana, por ejemplo). Devuelve `false` si se acabo el tiempo, se cancelo o se
 * cerro el almacen.
 */
function esperarUnCambio(
  ciclo: CicloAbierto,
  limiteEnMs: number,
  senal: AbortSignal | undefined,
): Promise<boolean> {
  return new Promise<boolean>((resolver) => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const dejarDeEscuchar: (() => void)[] = [];

    function terminar(huboCambio: boolean): void {
      clearTimeout(temporizador);
      dejarDeEscuchar.forEach((dejar) => {
        dejar();
      });
      resolver(huboCambio);
    }

    if (senal?.aborted === true) {
      resolver(false);

      return;
    }

    dejarDeEscuchar.push(
      ciclo.motor.suscribir((evento) => {
        if (evento.tipo === 'fin') {
          terminar(true);
        }
      }),
      suscribirALaCola(() => {
        terminar(true);
      }),
      // Si el almacen cambia (se cerro la sesion), ya no hay nada que esperar.
      suscribirAlCiclo(() => {
        terminar(cicloActual() === ciclo);
      }),
    );

    if (senal !== undefined) {
      const alCancelar = (): void => {
        terminar(false);
      };

      senal.addEventListener('abort', alCancelar, { once: true });
      dejarDeEscuchar.push(() => {
        senal.removeEventListener('abort', alCancelar);
      });
    }

    if (Number.isFinite(limiteEnMs)) {
      temporizador = setTimeout(
        () => {
          terminar(false);
        },
        Math.max(0, limiteEnMs),
      );
    }
  });
}

/**
 * Sigue una operacion hasta que se sepa que paso con ella. Ver `Seguimiento`.
 *
 * No lanza: lo que sea que falle por dentro es una operacion que no se pudo seguir, y
 * eso se dice como `guardada` (esta guardada, que es lo unico que se sabe).
 */
export async function seguirUnaOperacion(
  operationId: string,
  opciones: OpcionesDeSeguimiento = {},
): Promise<Seguimiento> {
  const { sincronizarYa = false, esperaMaximaEnMs = ESPERA_MAXIMA_EN_MS, senal } = opciones;
  const ciclo = cicloActual();

  if (ciclo === null) {
    return { tipo: 'sin_almacen' };
  }

  const termina =
    esperaMaximaEnMs === null ? Number.POSITIVE_INFINITY : Date.now() + esperaMaximaEnMs;

  /** Lo que se sabe ahora de la operacion, o `null` si sigue esperando. */
  async function veredicto(): Promise<Seguimiento | null> {
    const operacion = await ciclo?.almacen.operacion(operationId);

    // Ya no esta: la descartaron. No se envio, y no va a enviarse.
    if (operacion === null || operacion === undefined) {
      return { tipo: 'rechazada', error: null, conflicto: false };
    }

    if (operacion.estado === 'hecha') {
      return { tipo: 'enviada', recibo: operacion.recibo };
    }

    if (operacion.estado === 'requiere_atencion' || operacion.estado === 'conflicto') {
      return {
        tipo: 'rechazada',
        error: operacion.error,
        conflicto: operacion.estado === 'conflicto',
      };
    }

    return null;
  }

  try {
    let porPedir = sincronizarYa;

    for (;;) {
      const sabido = await veredicto();

      if (sabido !== null) {
        return sabido;
      }

      if (senal?.aborted === true) {
        return { tipo: 'guardada' };
      }

      if (porPedir) {
        porPedir = false;

        // Con un servidor lento o dormido la tanda puede tardar: no se espera mas del
        // tiempo maximo. Sigue sola, y si la operacion sale despues, quien la espere
        // (`esperaMaximaEnMs: null`) se entera.
        const resultado = await conLimite(
          ciclo.motor.sincronizar('programada'),
          termina - Date.now(),
        );

        if (resultado === 'tiempo') {
          return (await veredicto()) ?? { tipo: 'guardada' };
        }

        const despues = await veredicto();

        if (despues !== null) {
          return despues;
        }

        // Una tanda propia que termino sin enviarlo: sin conexion, o reintentando.
        // (Si estaba ocupada con otra, se espera a que esa termine.)
        if (resultado.estado !== 'ocupada' && esperaMaximaEnMs !== null) {
          return { tipo: 'guardada' };
        }
      }

      const huboCambio = await esperarUnCambio(ciclo, termina - Date.now(), senal);

      if (!huboCambio) {
        // Se acabo el tiempo, se cancelo o se cerro el almacen: ultima mirada.
        return (await veredicto()) ?? { tipo: 'guardada' };
      }
    }
  } catch {
    return { tipo: 'guardada' };
  }
}
