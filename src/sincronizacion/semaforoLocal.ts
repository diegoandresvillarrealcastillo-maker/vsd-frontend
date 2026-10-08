import {
  consultarElSemaforo,
  type Pendiente,
  type Semaforo,
} from '../infraestructura/api/pendientes.ts';
import { sonIguales } from './anotaciones.ts';
import { cicloActual } from './ciclo.ts';
import type { Operacion, TipoDeOperacion } from './cola.ts';
import { crearFila } from './enFila.ts';
import { operacionDeUnIdLocal } from './ejecutores.ts';
import {
  leerConCopia,
  leerSoloLaCopia,
  modificarLaCopia,
  type LecturaConCopia,
} from './lecturas.ts';
import { esPendiente } from './pendientes.ts';

/**
 * El semaforo de pendientes con copia en este dispositivo (SCRUM-140).
 *
 * Como el diario (`diarioLocal.ts`), la copia vive en el almacen de la persona, cifrada, y se
 * borra al cerrar sesion. Lo que **todavia no se envio** no esta aqui: esta en la cola, y la
 * pantalla pone las dos cosas juntas (`componerElSemaforo`).
 *
 * ## Los recordatorios no se inventan
 *
 * El servidor es quien decide si toca recordar algo, con los dias de cada color y la zona de
 * la persona. Sin conexion no hay a quien preguntarle: **de la copia nunca sale un
 * recordatorio**, ni siquiera el que tenia la ultima vez. Uno de hace horas diria algo que
 * ya puede no ser cierto.
 */

export const CLAVE_DEL_SEMAFORO = 'semaforo';

/** Lo que queda guardado: los pendientes, sin el recordatorio. */
export interface InstantaneaDelSemaforo {
  readonly pendientes: readonly Pendiente[];
}

/** Si un tipo de operacion es de los pendientes. */
export function esTipoDelSemaforo(tipo: TipoDeOperacion): boolean {
  return tipo === 'pendiente.crear' || tipo === 'pendiente.editar' || tipo === 'pendiente.borrar';
}

export function esDelSemaforo(operacion: Operacion): boolean {
  return esTipoDelSemaforo(operacion.tipo);
}

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lo que se guardo puede ser de otra version de la aplicacion: se queda con lo que entiende. */
function comoInstantanea(valor: unknown): InstantaneaDelSemaforo | null {
  if (!esObjeto(valor) || !Array.isArray(valor.pendientes)) {
    return null;
  }

  return { pendientes: (valor.pendientes as unknown[]).filter(esPendiente) };
}

async function leerLaInstantanea(): Promise<InstantaneaDelSemaforo | null> {
  return comoInstantanea(await leerSoloLaCopia<unknown>(CLAVE_DEL_SEMAFORO));
}

// ---------------------------------------------------------------------------
// Conciliar: lo que el servidor acepto, a la copia
// ---------------------------------------------------------------------------

/**
 * El identificador de verdad de lo que toca una operacion de borrar. Si se creo sin conexion,
 * es el que respondio la operacion que lo creo.
 */
function idRealDelBorrado(operacion: Operacion, todas: readonly Operacion[]): string | null {
  const { payload } = operacion;
  const id = esObjeto(payload) && typeof payload.id === 'string' ? payload.id : null;

  if (id === null) {
    return null;
  }

  const creadora = operacionDeUnIdLocal(id);

  if (creadora === null) {
    return id;
  }

  const recibo = todas.find((otra) => otra.operationId === creadora)?.recibo;

  return esPendiente(recibo) ? recibo.id : null;
}

/**
 * Pasa a la copia local lo que el servidor acepto de los pendientes: lo que respondieron las
 * operaciones ya enviadas, y lo que se borro.
 *
 * **Por que hace falta.** La copia es lo que el servidor tenia cuando se pregunto. Un
 * pendiente anotado o cambiado despues, aunque ya este enviado, no esta en ella: sin
 * conciliar, sin conexion volvia a verse como antes (ya no esta en la cola como pendiente y
 * todavia no esta en la copia).
 *
 * Es idempotente y no pierde nada: un pendiente solo se cambia por uno de version igual o
 * mayor, y lo que no se entiende se deja como esta. Nunca falla ni rechaza.
 */
export function conciliarElSemaforo(): Promise<void> {
  return enFila(hacerLaConciliacion);
}

/** Se hacen de una en una: cada una lee, cambia y escribe. */
const enFila = crearFila();

async function hacerLaConciliacion(): Promise<void> {
  const ciclo = cicloActual();

  if (ciclo === null) {
    return;
  }

  const todas = await ciclo.almacen.operaciones();
  const hechas = todas
    .filter((operacion) => esDelSemaforo(operacion) && operacion.estado === 'hecha')
    .sort((una, otra) => una.orden - otra.orden);

  if (hechas.length === 0) {
    return;
  }

  await modificarLaCopia<InstantaneaDelSemaforo>(CLAVE_DEL_SEMAFORO, (guardada) => {
    const instantanea = comoInstantanea(guardada);

    // Sin una copia no hay a que agregar: una con solo unos cuantos pendientes pareceria el
    // semaforo completo. Se arma la proxima vez que se pregunte al servidor.
    if (instantanea === null) {
      return null;
    }

    const porId = new Map(instantanea.pendientes.map((pendiente) => [pendiente.id, pendiente]));
    let cambio = false;

    for (const operacion of hechas) {
      if (operacion.tipo === 'pendiente.borrar') {
        const id = idRealDelBorrado(operacion, todas);

        if (id !== null && porId.delete(id)) {
          cambio = true;
        }

        continue;
      }

      const { recibo } = operacion;

      if (!esPendiente(recibo)) {
        continue;
      }

      const previa = porId.get(recibo.id);
      const sirve =
        previa === undefined ||
        ((recibo.version ?? 0) >= (previa.version ?? 0) && !sonIguales(previa, recibo));

      if (sirve) {
        porId.set(recibo.id, recibo);
        cambio = true;
      }
    }

    return cambio ? { pendientes: [...porId.values()] } : null;
  });
}

// ---------------------------------------------------------------------------
// Leer
// ---------------------------------------------------------------------------

/**
 * El semaforo: del servidor si se puede, de la copia si no.
 *
 * Los pendientes que devuelve ya estan conciliados con lo que el servidor acepto despues de
 * preguntar. Si son de la copia, **no hay recordatorio**. Ver `leerConCopia` para el resto del
 * comportamiento (tiempo de espera, errores que la copia no tapa).
 */
export async function leerElSemaforoConCopia(
  senal?: AbortSignal,
): Promise<LecturaConCopia<Semaforo>> {
  const lectura = await leerConCopia<Semaforo>(
    CLAVE_DEL_SEMAFORO,
    async () => ({
      estado: 'nuevo',
      valor: await consultarElSemaforo(senal),
      etag: null,
    }),
    senal,
  );

  await conciliarElSemaforo();

  const instantanea = await leerLaInstantanea();

  return {
    ...lectura,
    valor: {
      pendientes: instantanea?.pendientes ?? lectura.valor.pendientes,
      recordatorio: lectura.deLaCopia ? null : lectura.valor.recordatorio,
    },
  };
}

export interface LoLocalDelSemaforo {
  /** Lo que se sabe del servidor, o `null` si nunca se pregunto. */
  readonly instantanea: InstantaneaDelSemaforo | null;
  /** Lo de los pendientes que todavia no se envio (o que no se pudo), en el orden en que se hizo. */
  readonly pendientes: readonly Operacion[];
}

/** Todo lo de los pendientes que hay en este dispositivo, sin preguntar a nadie. */
export async function leerLoLocalDelSemaforo(): Promise<LoLocalDelSemaforo> {
  await conciliarElSemaforo();

  const [instantanea, operaciones] = await Promise.all([
    leerLaInstantanea(),
    cicloActual()
      ?.almacen.operaciones()
      .catch((): readonly Operacion[] => []) ?? Promise.resolve<readonly Operacion[]>([]),
  ]);

  return {
    instantanea,
    pendientes: operaciones
      .filter(
        (operacion) =>
          esDelSemaforo(operacion) && operacion.estado !== 'hecha' && operacion.ilegible !== true,
      )
      .sort((una, otra) => una.orden - otra.orden),
  };
}

/**
 * Lee el semaforo por adelantado, para tenerlo cuando no haya conexion. Ver `precarga.ts`.
 */
export function precargarElSemaforo(): Promise<unknown> {
  return leerElSemaforoConCopia();
}
