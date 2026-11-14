import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import type { ActividadDeHoy, ProgresoDelModulo } from '../../../infraestructura/api/progreso.ts';

/**
 * La ruta del dia (SCRUM-170): lo que toca hoy, ordenado.
 *
 * Es solo la forma de ver datos que el panel ya tiene (`GET /api/progreso`): no pide nada
 * nuevo ni inventa un orden. El orden es el del servidor, y "lo siguiente" es la primera
 * actividad sin hacer, que es la misma que ensena la tarjeta de "Recomendado".
 *
 * Cada actividad tiene uno de tres estados.
 */
export type EstadoDelNodo = 'hecha' | 'siguiente' | 'pendiente';

export interface NodoDeLaRuta {
  readonly actividad: ActividadDeHoy;
  readonly modulo: Modulo;
  readonly estado: EstadoDelNodo;
}

export interface RutaDelDia {
  /**
   * Los modulos activos, con la meta del dia ya repartida en `hoy` (y lo que sobro en `sugeridas`).
   * Incluye los que hoy no tienen nada: su ruta de 365 dias sigue siendo suya.
   */
  readonly modulos: readonly ProgresoDelModulo[];
  /** Todos los nodos, en orden: lo que recorren el panel y la tarjeta de "Recomendado". */
  readonly nodos: readonly NodoDeLaRuta[];
  readonly siguiente: NodoDeLaRuta | undefined;
  readonly idsHechos: readonly string[];
  readonly hechas: number;
  readonly total: number;
  readonly planCompleto: boolean;
}

/**
 * Cuantas actividades se le piden a la persona por dia: unas tres. Con que haga una ya cuenta para
 * la racha; esto solo fija cuantas ve como meta y cuando se da el dia por logrado.
 */
export const META_DEL_DIA = 3;

/**
 * Reparte la meta del dia entre los modulos activos, de a una por vuelta y en el orden del
 * servidor (con un solo modulo, las tres son suyas).
 *
 * Dentro de cada modulo, lo hecho va primero: asi lo que la persona ya hizo siempre cuenta y la
 * lista no se mueve al hacer algo. Lo que no entra no se pierde: pasa a las sugeridas («Si quieres
 * hacer mas»), donde se puede hacer cuando se quiera.
 */
function repartirLaMeta(progreso: readonly ProgresoDelModulo[]): ProgresoDelModulo[] {
  const colas = progreso.map((uno) => [
    ...uno.hoy.filter((actividad) => actividad.hecha),
    ...uno.hoy.filter((actividad) => !actividad.hecha),
  ]);
  const elegidas = new Set<ActividadDeHoy>();

  for (
    let vuelta = 0;
    elegidas.size < META_DEL_DIA && colas.some((cola) => cola.length > vuelta);
    vuelta += 1
  ) {
    for (const cola of colas) {
      const una = cola[vuelta];

      if (una !== undefined && elegidas.size < META_DEL_DIA) {
        elegidas.add(una);
      }
    }
  }

  return progreso.map((uno) => ({
    ...uno,
    hoy: uno.hoy.filter((actividad) => elegidas.has(actividad)),
    sugeridas: [
      ...uno.hoy.filter((actividad) => !elegidas.has(actividad)),
      ...(uno.sugeridas ?? []),
    ],
  }));
}

export function construirLaRuta(progreso: readonly ProgresoDelModulo[]): RutaDelDia {
  const modulos = repartirLaMeta(progreso);
  const primeraSinHacer = modulos.flatMap((uno) => uno.hoy).find((actividad) => !actividad.hecha);

  const nodos = modulos.flatMap((uno) =>
    uno.hoy.map((actividad): NodoDeLaRuta => {
      const estado: EstadoDelNodo = actividad.hecha
        ? 'hecha'
        : actividad === primeraSinHacer
          ? 'siguiente'
          : 'pendiente';

      return { actividad, modulo: uno.modulo, estado };
    }),
  );
  const idsHechos = nodos
    .filter((nodo) => nodo.estado === 'hecha')
    .map((nodo) => nodo.actividad.id);

  return {
    modulos,
    nodos,
    siguiente: nodos.find((nodo) => nodo.estado === 'siguiente'),
    idsHechos,
    hechas: idsHechos.length,
    total: nodos.length,
    planCompleto: nodos.length > 0 && idsHechos.length === nodos.length,
  };
}
