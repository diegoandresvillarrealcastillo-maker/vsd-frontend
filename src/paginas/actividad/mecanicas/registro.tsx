import type { ReactElement } from 'react';

import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';
import type { LoQueProduceLaActividad } from '../useCompletarActividad.ts';
import { AtencionEnFlujo } from './AtencionEnFlujo.tsx';
import { ComoDormisteAnoche } from './ComoDormisteAnoche.tsx';
import { ComoTeSientesHoy } from './ComoTeSientesHoy.tsx';
import { CompletaLaPalabra } from './CompletaLaPalabra.tsx';
import { CuentasConCalma } from './CuentasConCalma.tsx';
import { EncuentraLaDiferencia } from './EncuentraLaDiferencia.tsx';
import { EscrituraBreve } from './EscrituraBreve.tsx';
import { GuiaDeRespiracion } from './GuiaDeRespiracion.tsx';
import { LaCargaDeTuSemana } from './LaCargaDeTuSemana.tsx';
import { LoQueVi } from './LoQueVi.tsx';
import { MovimientoDelDia } from './MovimientoDelDia.tsx';
import { OrdenaPorCategoria } from './OrdenaPorCategoria.tsx';
import { PalabraQueSobra } from './PalabraQueSobra.tsx';
import { ParejasDeCartas } from './ParejasDeCartas.tsx';
import { QueTeEstaPesando } from './QueTeEstaPesando.tsx';
import { RecuerdaLaLista } from './RecuerdaLaLista.tsx';
import { SecuenciaDeCasillas } from './SecuenciaDeCasillas.tsx';
import { SecuenciaDeNumeros } from './SecuenciaDeNumeros.tsx';
import { UnMomentoBueno } from './UnMomentoBueno.tsx';
import { UnirLosPuntos } from './UnirLosPuntos.tsx';

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
  /**
   * La sesion de hoy de esta mecanica (SCRUM-208, ADR 0030), si el servidor la entrego: el
   * contenido de **esta vez** (preguntas, rondas, tiempos...). Cada pantalla la lee con cuidado
   * (`parametrosDeLaSesion.ts`) y, sin ella o con una que no entiende, usa lo de siempre.
   */
  readonly sesion?: SesionDeLaActividad | undefined;
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

/**
 * La pantalla de cada **motor** (SCRUM-209, ADR 0030): la que se usa para una mecanica que no tiene
 * la suya por identificador. Una mecanica nueva sobre un motor que ya tiene pantalla es una fila
 * en la base y no un cambio aqui; las sesiones le dicen que pintar. Las pantallas de motor viven de
 * la sesion de hoy: sin ella no hay con que pintarlas, y lo dicen.
 */
const MECANICAS_POR_MOTOR: Readonly<Record<string, Mecanica>> = {
  secuencia: (props) => <SecuenciaDeCasillas {...props} />,
  guia_paso_a_paso: (props) => <GuiaDeRespiracion {...props} />,
  escritura_breve: (props) => <EscrituraBreve {...props} />,

  // Los motores de Cognicion del catalogo (SCRUM-225). Un motor que sirve a varias mecanicas elige por el
  // `modo` de la sesion; un modo que no conoce cae en la pantalla que dice que necesita la sesion de hoy.
  tocar_el_objetivo: (props) =>
    modoDe(props.sesion) === 'puntos' ? (
      <UnirLosPuntos {...props} />
    ) : (
      <AtencionEnFlujo {...props} />
    ),
  ver_ocultar_recordar: (props) =>
    modoDe(props.sesion) === 'escena' ? <LoQueVi {...props} /> : <RecuerdaLaLista {...props} />,
  clasificar: (props) =>
    modoDe(props.sesion) === 'cestas' ? (
      <OrdenaPorCategoria {...props} />
    ) : (
      <PalabraQueSobra {...props} />
    ),
  palabras: (props) => <CompletaLaPalabra {...props} />,
  calculo: (props) => <CuentasConCalma {...props} />,
};

/** El `modo` de una sesion, si lo trae: los motores que sirven a varias mecanicas se parten por el. */
function modoDe(sesion: SesionDeLaActividad | undefined): unknown {
  const modo = sesion?.parametros.modo;

  return typeof modo === 'string' ? modo : undefined;
}

/**
 * La mecanica de esa actividad, o `undefined` si todavia no existe.
 *
 * Primero por identificador: las nueve de siempre tienen su pantalla escrita a mano, y el
 * identificador manda sobre el motor (la secuencia de numeros y «Recuerda los colores» comparten
 * motor y se juegan distinto). Si no esta ahi, por el `motor` de la actividad.
 */
export function mecanicaDe(idDeLaActividad: string, motor?: string): Mecanica | undefined {
  // Solo lo que esta en las tablas: «constructor» no es una mecanica, aunque el objeto tenga uno.
  const propia = (
    tabla: Readonly<Record<string, Mecanica>>,
    clave: string,
  ): Mecanica | undefined => (Object.hasOwn(tabla, clave) ? tabla[clave] : undefined);

  return (
    propia(MECANICAS, idDeLaActividad) ??
    (motor === undefined ? undefined : propia(MECANICAS_POR_MOTOR, motor))
  );
}
