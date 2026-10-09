import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import type { ActividadDeHoy, ProgresoDelModulo } from '../../../infraestructura/api/progreso.ts';

/**
 * La ruta del dia (SCRUM-170): lo que toca hoy, ordenado como un camino.
 *
 * Es solo la forma de ver datos que el panel ya tiene (`GET /api/progreso`): no pide nada
 * nuevo ni inventa un orden. El orden es el del servidor, y "lo siguiente" es la primera
 * actividad sin hacer, que es la misma que ensena la tarjeta de "Recomendado".
 *
 * Cada actividad tiene uno de tres estados. La meta del dia (el final del camino) tiene
 * los suyos aparte: esta cerrada hasta que se hace todo.
 */
export type EstadoDelNodo = 'hecha' | 'siguiente' | 'pendiente';

export interface NodoDeLaRuta {
  readonly actividad: ActividadDeHoy;
  readonly modulo: Modulo;
  readonly estado: EstadoDelNodo;
}

/** Las actividades de hoy de un modulo, que en el camino forman un tramo con su titulo. */
export interface TramoDeLaRuta {
  readonly progreso: ProgresoDelModulo;
  readonly nodos: readonly NodoDeLaRuta[];
}

export interface RutaDelDia {
  readonly tramos: readonly TramoDeLaRuta[];
  readonly hechas: number;
  readonly total: number;
  readonly planCompleto: boolean;
}

export function construirLaRuta(progreso: readonly ProgresoDelModulo[]): RutaDelDia {
  const conActividades = progreso.filter((uno) => uno.hoy.length > 0);
  const primeraSinHacer = conActividades
    .flatMap((uno) => uno.hoy)
    .find((actividad) => !actividad.hecha);

  const tramos = conActividades.map((uno) => ({
    progreso: uno,
    nodos: uno.hoy.map((actividad): NodoDeLaRuta => ({
      actividad,
      modulo: uno.modulo,
      estado: actividad.hecha ? 'hecha' : actividad === primeraSinHacer ? 'siguiente' : 'pendiente',
    })),
  }));

  const total = tramos.reduce((suma, tramo) => suma + tramo.nodos.length, 0);
  const hechas = tramos.reduce(
    (suma, tramo) => suma + tramo.nodos.filter((nodo) => nodo.estado === 'hecha').length,
    0,
  );

  return { tramos, hechas, total, planCompleto: total > 0 && hechas === total };
}

/** Cuanto se corre cada punto hacia un lado, para que el camino serpentee. */
export function desplazamientoDelNodo(indice: number): number {
  return Math.round(Math.sin(indice * 0.9) * 68);
}
