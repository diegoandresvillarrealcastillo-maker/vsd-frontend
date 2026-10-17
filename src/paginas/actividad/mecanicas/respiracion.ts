import type { PatronDeRespiracion } from './parametrosDeLaSesion.ts';

export type { PatronDeRespiracion };

/**
 * El ritmo de la respiracion guiada (SCRUM-210, ficha BIE-01), sin pantalla.
 *
 * Son funciones puras: dado cuanto tiempo lleva, dicen que etapa toca, cuantos segundos le quedan a
 * esa etapa y cuando se acaba todo. La pantalla solo pinta lo que dicen, y el ritmo se prueba sin
 * relojes.
 *
 * Un ciclo es inhalar, una pausa (que puede ser de cero) y exhalar.
 */
export type Etapa = 'inhala' | 'pausa' | 'exhala';

export interface PuntoDeLaRespiracion {
  /** Desde 0. */
  readonly ciclo: number;
  readonly etapa: Etapa;
  /** Los segundos enteros que le quedan a la etapa de ahora; 1 en el ultimo, 0 solo al terminar. */
  readonly restanSegundos: number;
  /** Cuanto de la etapa lleva, de 0 a 1. */
  readonly avance: number;
  readonly terminada: boolean;
}

export function duracionDelCiclo(patron: PatronDeRespiracion): number {
  return patron.inhalaSegundos + patron.pausaSegundos + patron.exhalaSegundos;
}

/**
 * Cuantos ciclos caben en la duracion de la sesion: el entero mas cercano, de modo que la sesion
 * dura unos segundos mas o menos pero **termina siempre al cerrar un ciclo**, y nunca a mitad de una
 * exhalacion. Nunca menos de uno.
 */
export function cuantosCiclos(duracionSegundos: number, patron: PatronDeRespiracion): number {
  return Math.max(1, Math.round(duracionSegundos / duracionDelCiclo(patron)));
}

/** Que le toca a la persona a los `transcurridoSegundos` de empezar. */
export function puntoDeLaRespiracion(
  transcurridoSegundos: number,
  patron: PatronDeRespiracion,
  ciclos: number,
): PuntoDeLaRespiracion {
  const ciclo = duracionDelCiclo(patron);
  const tiempo = Math.max(0, transcurridoSegundos);

  if (tiempo >= ciclos * ciclo) {
    return { ciclo: ciclos - 1, etapa: 'exhala', restanSegundos: 0, avance: 1, terminada: true };
  }

  const numero = Math.floor(tiempo / ciclo);
  const dentro = tiempo - numero * ciclo;

  const [etapa, empieza, dura]: [Etapa, number, number] =
    dentro < patron.inhalaSegundos
      ? ['inhala', 0, patron.inhalaSegundos]
      : dentro < patron.inhalaSegundos + patron.pausaSegundos
        ? ['pausa', patron.inhalaSegundos, patron.pausaSegundos]
        : ['exhala', patron.inhalaSegundos + patron.pausaSegundos, patron.exhalaSegundos];
  const local = dentro - empieza;

  return {
    ciclo: numero,
    etapa,
    restanSegundos: Math.ceil(dura - local),
    avance: local / dura,
    terminada: false,
  };
}

/** «1:35»: minutos y segundos, para lo que queda. Hacia arriba, y nunca negativo. */
export function formatearElTiempo(segundos: number): string {
  const total = Math.max(0, Math.ceil(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;

  return `${String(minutos)}:${String(resto).padStart(2, '0')}`;
}
