import { descartarCambio } from '../sincronizacion/acciones.ts';
import { encolar } from '../sincronizacion/ciclo.ts';
import type { CambiosEnConflicto } from './composicion.ts';

/**
 * Lo que se hace cuando un cambio a un pendiente choco con otro dispositivo (SCRUM-140, ADR 0009).
 *
 * El conflicto nunca se resuelve solo: la persona ve lo del servidor y lo suyo, y elige. Hasta
 * entonces **no se pierde ninguna de las dos**: lo del servidor esta en el servidor y lo suyo
 * sigue en la cola, detenido.
 */

/**
 * Se queda con lo del servidor: lo que la persona cambio aqui se tira, junto con lo que quedo
 * detenido detras de eso.
 */
export async function quedarseConLoDelServidor(conflicto: CambiosEnConflicto): Promise<void> {
  await descartarCambio(conflicto.operacionQueChoco);
}

/**
 * Se queda con lo suyo: lo vuelve a mandar con la version que tiene el servidor ahora, o lo
 * elimina si lo ultimo que queria era eliminarlo. Devuelve la operacion nueva.
 *
 * **Primero se guarda lo nuevo y despues se tira lo viejo**, no al reves: si algo falla entre
 * las dos cosas, sobra una copia de lo mismo y no falta lo que la persona escribio. La nueva
 * no depende de la vieja (`dependeDe: null`): tirar la vieja se lleva a lo que depende de ella.
 */
export async function aplicarMiCambio(
  conflicto: CambiosEnConflicto,
  versionDelServidor: number | undefined,
): Promise<string> {
  const operationId = globalThis.crypto.randomUUID();
  const entidad = `pendiente:${conflicto.id}`;

  await (conflicto.eliminar
    ? encolar({
        operationId,
        tipo: 'pendiente.borrar',
        entidad,
        payload: { id: conflicto.id },
        dependeDe: null,
      })
    : encolar({
        operationId,
        tipo: 'pendiente.editar',
        entidad,
        payload: {
          id: conflicto.id,
          cambios: {
            ...conflicto.cambios,
            ...(versionDelServidor === undefined ? {} : { version: versionDelServidor }),
          },
        },
        dependeDe: null,
      }));
  await descartarCambio(conflicto.operacionQueChoco);

  return operationId;
}
