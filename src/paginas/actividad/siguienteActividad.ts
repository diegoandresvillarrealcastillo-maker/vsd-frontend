import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { construirLaRuta } from '../panel/ruta/construirLaRuta.ts';

/** A donde lleva «Siguiente actividad» al terminar una (SCRUM-295). */
export interface SiguienteActividad {
  readonly id: string;
  readonly nombre: string;
  readonly modulo: Modulo;
  /** Si es de otro modulo que la que se acaba de hacer: el boton lo dice. */
  readonly cambiaDeModulo: boolean;
}

/**
 * La siguiente actividad pendiente de la meta del dia, con la misma cuenta que el panel
 * (`construirLaRuta`): primero lo que falta en el mismo modulo, y despues el modulo que le sigue
 * en el orden de la ruta, dando la vuelta si hace falta.
 *
 * La que se acaba de hacer nunca se ofrece, aunque la copia que se lee todavia la tenga pendiente.
 * Sin nada pendiente devuelve `undefined`: el boton no se muestra y queda solo «Volver al panel».
 */
export function siguienteActividad(
  progreso: readonly ProgresoDelModulo[],
  idActual: string,
): SiguienteActividad | undefined {
  const { modulos, nodos } = construirLaRuta(progreso);
  const orden = modulos.map((uno) => uno.modulo);
  // Tambien se busca entre las sugeridas: una actividad de mas se hace desde su modulo.
  const deLaActual = progreso.find((uno) =>
    [...uno.hoy, ...(uno.sugeridas ?? [])].some((actividad) => actividad.id === idActual),
  )?.modulo;
  const inicio = deLaActual === undefined ? 0 : orden.indexOf(deLaActual);
  const distancia = (modulo: Modulo) =>
    (orden.indexOf(modulo) - inicio + orden.length) % orden.length;

  const elegida = nodos
    .filter((nodo) => nodo.estado !== 'hecha' && nodo.actividad.id !== idActual)
    .sort((a, b) => distancia(a.modulo) - distancia(b.modulo))[0];

  return elegida === undefined
    ? undefined
    : {
        id: elegida.actividad.id,
        nombre: elegida.actividad.nombre,
        modulo: elegida.modulo,
        cambiaDeModulo: deLaActual !== undefined && elegida.modulo !== deLaActual,
      };
}
