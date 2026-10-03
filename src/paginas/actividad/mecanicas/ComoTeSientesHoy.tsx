import { Cuestionario } from './Cuestionario.tsx';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Como te sientes hoy": cinco preguntas breves sobre el dia (SCRUM-94).
 *
 * Como "La carga de tu semana", puntua con `mayor_requiere_atencion`: todas las
 * preguntas van en el mismo sentido y "Mucho" siempre suma.
 *
 * Tres opciones y no cinco. El catalogo promete menos de un minuto, y en un
 * dia dificil afinar entre "Bastante" y "Mucho" es pedir demasiado.
 *
 * Ninguna pregunta nombra un estado de animo, un sintoma ni una condicion.
 * Preguntan por cosas que le pasan a cualquiera en un dia: que cueste
 * arrancar, cargar tension, echar de menos a alguien con quien hablar. Con
 * eso basta para orientar, y no suena a test.
 */

/** Cinco preguntas de 0 a 2. Tiene que coincidir con el maximo del catalogo. */
const MAXIMO = 10;

const PREGUNTAS = [
  { clave: 'arrancar', texto: '¿Cuánto te costó arrancar el día?' },
  { clave: 'tension', texto: '¿Cuánta tensión has cargado hoy?' },
  { clave: 'disfrutar', texto: '¿Cuánto te costó disfrutar de lo que normalmente te gusta?' },
  { clave: 'vueltas', texto: '¿Cuánto te han dado vueltas pensamientos que no te dejan en paz?' },
  { clave: 'compania', texto: '¿Cuánto has echado en falta a alguien con quien hablar?' },
] as const;

const OPCIONES = [
  { valor: 0, texto: 'Nada' },
  { valor: 1, texto: 'Algo' },
  { valor: 2, texto: 'Mucho' },
] as const;

export function ComoTeSientesHoy(props: PropsDeMecanica) {
  return (
    <Cuestionario
      {...props}
      indicacion="Piensa solo en hoy. No hay respuestas buenas ni malas."
      preguntas={PREGUNTAS}
      opciones={OPCIONES}
      maximo={MAXIMO}
    />
  );
}
