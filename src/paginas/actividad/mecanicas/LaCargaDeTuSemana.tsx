import { useMemo } from 'react';

import { Cuestionario } from './Cuestionario.tsx';
import {
  leerCuestionario,
  maximoDelCuestionario,
  type ParametrosDeCuestionario,
} from './parametrosDeLaSesion.ts';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "La carga de tu semana": cinco preguntas sobre como viene la semana en
 * estudio, tiempo propio y descanso (SCRUM-93).
 *
 * Es un cuestionario con la escala **al reves** que "Como dormiste": aqui un
 * puntaje alto significa una semana mas cargada, y el servidor lo interpreta
 * con `mayor_requiere_atencion`. Por eso todas las preguntas estan redactadas
 * en el mismo sentido: responder "Mucho" siempre suma carga.
 *
 * Las preguntas hablan de la semana, no de la persona: no nombran sintomas ni
 * estados de animo. Orientan, no evaluan.
 */

const PREGUNTAS = [
  { clave: 'pendientes', texto: '¿Cuánto trabajo o estudio pendiente sientes que tienes?' },
  { clave: 'horario', texto: '¿Qué tan apretado ha estado tu horario?' },
  {
    clave: 'tiempoPropio',
    texto: '¿Cuánto te ha faltado tiempo para ti: descansar, tus aficiones, la gente que quieres?',
  },
  { clave: 'desconectar', texto: '¿Cuánto te ha costado desconectarte al terminar el día?' },
  { clave: 'loQueViene', texto: '¿Cuánto te pesa lo que viene en los próximos días?' },
] as const;

const OPCIONES = [
  { valor: 0, texto: 'Nada' },
  { valor: 1, texto: 'Poco' },
  { valor: 2, texto: 'Algo' },
  { valor: 3, texto: 'Bastante' },
  { valor: 4, texto: 'Mucho' },
] as const;

/**
 * Lo de siempre: cinco preguntas de 0 a 4, el maximo del catalogo (20). Es lo mismo que lleva la
 * sesion de la Fase 0 (SCRUM-207), y es lo que se usa si la sesion no llega o no se entiende.
 */
const DE_SIEMPRE: ParametrosDeCuestionario = {
  indicacion: 'Piensa en los últimos siete días. No hay respuestas buenas ni malas.',
  preguntas: PREGUNTAS,
  opciones: OPCIONES,
};

export function LaCargaDeTuSemana({ sesion, ...props }: PropsDeMecanica) {
  // El maximo se deduce de lo que se pinta (preguntas por la opcion mas alta): tiene que coincidir
  // con el del catalogo, o la API responde 400, y asi no hay dos numeros que cuadrar.
  const cuestionario = useMemo(() => leerCuestionario(sesion?.parametros) ?? DE_SIEMPRE, [sesion]);

  return <Cuestionario {...props} {...cuestionario} maximo={maximoDelCuestionario(cuestionario)} />;
}
