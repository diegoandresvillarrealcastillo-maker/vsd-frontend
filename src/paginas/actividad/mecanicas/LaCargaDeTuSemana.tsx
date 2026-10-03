import { Cuestionario } from './Cuestionario.tsx';
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

/** Cinco preguntas de 0 a 4. Tiene que coincidir con el maximo del catalogo. */
const MAXIMO = 20;

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

export function LaCargaDeTuSemana(props: PropsDeMecanica) {
  return (
    <Cuestionario
      {...props}
      indicacion="Piensa en los últimos siete días. No hay respuestas buenas ni malas."
      preguntas={PREGUNTAS}
      opciones={OPCIONES}
      maximo={MAXIMO}
    />
  );
}
