import type { ReactElement } from 'react';

import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';
import { ComoDormisteAnoche } from './ComoDormisteAnoche.tsx';

/**
 * Que pantalla corresponde a cada actividad.
 *
 * ---------------------------------------------------------------------------
 * Por que se busca por identificador y no por `tipo`
 * ---------------------------------------------------------------------------
 *
 * Seria comodo tener tres componentes, uno por `tipo`, y elegir con el que
 * llega del catalogo. No sirve: dos actividades del mismo tipo no se hacen
 * igual. "Parejas de cartas" y "Secuencia de numeros" son las dos juegos y no
 * comparten ni una regla.
 *
 * El `tipo` dice como se presenta, no como se juega. Lo que decide la mecanica
 * es la actividad concreta, asi que el mapa va por identificador.
 *
 * ---------------------------------------------------------------------------
 * Por que el mapa guarda funciones que devuelven JSX
 * ---------------------------------------------------------------------------
 *
 * La version anterior guardaba el componente y la pantalla lo pintaba con
 * `<Componente />`. Funciona, pero React no puede saber que ese componente es
 * el mismo entre renders: si cambiara, desmontaria y volveria a montar, y la
 * mecanica perderia lo que la persona llevara escrito.
 *
 * Guardando una funcion que devuelve `<ComoDormisteAnoche />`, quien aparece en
 * el arbol es el componente de verdad, escrito literalmente. React lo reconoce
 * y no hay nada dinamico que vigilar.
 *
 * ---------------------------------------------------------------------------
 * Las que faltan
 * ---------------------------------------------------------------------------
 *
 * Las ocho restantes llegan con sus modulos: Cognicion es SCRUM-84, y despues
 * Bienestar y Emociones. Hasta entonces, la pantalla dice que todavia no esta
 * disponible en lugar de fingir que si. Prometer una actividad que no se puede
 * hacer es peor que decir que falta.
 */
export interface PropsDeMecanica {
  readonly alTerminar: (produjo: LoQueProduceLaActividad) => void;
  readonly enviando: boolean;
}

type Mecanica = (props: PropsDeMecanica) => ReactElement;

const MECANICAS: Readonly<Record<string, Mecanica>> = {
  // Como dormiste anoche
  '0acd0000-0000-4000-8000-000000000004': (props) => <ComoDormisteAnoche {...props} />,
};

/** La mecanica de esa actividad, o `undefined` si todavia no existe. */
export function mecanicaDe(idDeLaActividad: string): Mecanica | undefined {
  return MECANICAS[idDeLaActividad];
}
