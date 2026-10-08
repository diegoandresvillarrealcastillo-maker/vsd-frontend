import { cicloActual } from './ciclo.ts';
import type { EstadoDeOperacion, Operacion, TipoDeOperacion } from './cola.ts';
import { textoDeLoEscrito, type TextoDeLoEscrito } from './textoDeLoEscrito.ts';

/**
 * Lo que sigue guardado en este equipo **sin haberse enviado** (SCRUM-142): lo que se
 * perderia si la persona cerrara sesion ahora, y lo que la exportacion de datos tiene que
 * incluir porque el servidor todavia no lo tiene.
 *
 * Cuenta todo lo que no esta `hecha`: lo que espera, lo que se esta enviando, lo que la API
 * rechazo y lo que choco con otro dispositivo. **No cuenta lo ilegible** (lo que ya no se
 * pudo descifrar o leer): no hay nada que enviar ni que perder, y el panel de lo guardado ya
 * lo dice aparte.
 *
 * Nunca falla: sin almacen abierto, o si no se puede leer, no hay nada que contar.
 */
export async function leerLoQueNoSeHaEnviado(): Promise<readonly Operacion[]> {
  try {
    const todas = (await cicloActual()?.almacen.operaciones()) ?? [];

    return todas
      .filter((operacion) => operacion.estado !== 'hecha' && operacion.ilegible !== true)
      .sort((una, otra) => una.orden - otra.orden);
  } catch {
    return [];
  }
}

export async function cuantosCambiosSinEnviar(): Promise<number> {
  return (await leerLoQueNoSeHaEnviado()).length;
}

/** Un cambio guardado en este equipo, tal como va en la exportacion de los datos. */
export interface CambioSinEnviar {
  readonly operationId: string;
  readonly tipo: TipoDeOperacion;
  /** En que punto esta: `pendiente`, `enviando`, `requiere_atencion` o `conflicto`. */
  readonly estado: EstadoDeOperacion;
  /** Cuando se hizo, en ISO 8601 (la del dispositivo). */
  readonly creadaEn: string;
  /** Lo que se escribio o se hizo, tal cual esta guardado. */
  readonly contenido: unknown;
}

/**
 * Lo que este equipo todavia tiene de la persona y el servidor no, para su exportacion:
 * si descarga "todo lo que VSD Health guarda de ti", eso incluye lo que aun no llego.
 */
export async function exportarLoQueNoSeHaEnviado(): Promise<readonly CambioSinEnviar[]> {
  return (await leerLoQueNoSeHaEnviado()).map((operacion) => ({
    operationId: operacion.operationId,
    tipo: operacion.tipo,
    estado: operacion.estado,
    creadaEn: operacion.creadaEn,
    contenido: operacion.payload,
  }));
}

/**
 * Lo que alguien escribio en una anotacion del diario que sigue en la cola, para poder
 * copiarlo antes de descartarla (SCRUM-142). `null` si no es del diario, si ya no esta o si
 * no tiene nada escrito. Nunca falla.
 */
export async function leerLoEscritoDe(operationId: string): Promise<TextoDeLoEscrito | null> {
  try {
    const operaciones = (await cicloActual()?.almacen.operaciones()) ?? [];
    const operacion = operaciones.find((una) => una.operationId === operationId);

    return operacion === undefined ? null : textoDeLoEscrito(operacion);
  } catch {
    return null;
  }
}
