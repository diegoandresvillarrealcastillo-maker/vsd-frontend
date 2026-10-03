import type { ReactElement } from 'react';

import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';
import { ComoDormisteAnoche } from './ComoDormisteAnoche.tsx';
import { ComoTeSientesHoy } from './ComoTeSientesHoy.tsx';
import { EncuentraLaDiferencia } from './EncuentraLaDiferencia.tsx';
import { LaCargaDeTuSemana } from './LaCargaDeTuSemana.tsx';
import { MovimientoDelDia } from './MovimientoDelDia.tsx';
import { ParejasDeCartas } from './ParejasDeCartas.tsx';
import { QueTeEstaPesando } from './QueTeEstaPesando.tsx';
import { SecuenciaDeNumeros } from './SecuenciaDeNumeros.tsx';
import { UnMomentoBueno } from './UnMomentoBueno.tsx';

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
 * Las que falten
 * ---------------------------------------------------------------------------
 *
 * Desde SCRUM-94 las nueve actividades del catalogo tienen su mecanica. Si se
 * siembra una nueva en la base antes de tener pantalla, no aparece aqui, y la
 * pantalla dice que todavia no esta disponible en lugar de fingir que si.
 * Prometer una actividad que no se puede hacer es peor que decir que falta.
 */
export interface PropsDeMecanica {
  readonly alTerminar: (produjo: LoQueProduceLaActividad) => void;
  readonly enviando: boolean;
}

type Mecanica = (props: PropsDeMecanica) => ReactElement;

const MECANICAS: Readonly<Record<string, Mecanica>> = {
  // Cognicion
  // Parejas de cartas
  '0acd0000-0000-4000-8000-000000000001': (props) => <ParejasDeCartas {...props} />,
  // Secuencia de numeros
  '0acd0000-0000-4000-8000-000000000002': (props) => <SecuenciaDeNumeros {...props} />,
  // Encuentra la diferencia
  '0acd0000-0000-4000-8000-000000000003': (props) => <EncuentraLaDiferencia {...props} />,

  // Bienestar
  // Como dormiste anoche
  '0acd0000-0000-4000-8000-000000000004': (props) => <ComoDormisteAnoche {...props} />,
  // La carga de tu semana
  '0acd0000-0000-4000-8000-000000000005': (props) => <LaCargaDeTuSemana {...props} />,
  // Movimiento del dia
  '0acd0000-0000-4000-8000-000000000006': (props) => <MovimientoDelDia {...props} />,

  // Emociones
  // Como te sientes hoy
  '0acd0000-0000-4000-8000-000000000007': (props) => <ComoTeSientesHoy {...props} />,
  // Que te esta pesando
  '0acd0000-0000-4000-8000-000000000008': (props) => <QueTeEstaPesando {...props} />,
  // Un momento bueno del dia
  '0acd0000-0000-4000-8000-000000000009': (props) => <UnMomentoBueno {...props} />,
};

/** La mecanica de esa actividad, o `undefined` si todavia no existe. */
export function mecanicaDe(idDeLaActividad: string): Mecanica | undefined {
  return MECANICAS[idDeLaActividad];
}
