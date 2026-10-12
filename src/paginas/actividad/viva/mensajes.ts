/**
 * Lo que dice la mascota mientras se hace una actividad (SCRUM-173).
 *
 * ## Dos familias, y no se mezclan
 *
 * **Las que acompanan** (`ACOMPANAN`) son para las actividades que preguntan por la persona:
 * cuestionarios, bitacoras, texto libre. No hay respuestas buenas ni malas, asi que *nada de
 * lo que se dice depende de lo que se contesto*: ningun «¡muy bien!» tras decir que la semana
 * fue pesada, ni un «¡casi!» tras ninguna respuesta. Agradecen, animan a seguir y dicen cuanto
 * falta. Son iguales vengan de la opcion que vengan.
 *
 * **Las que celebran** (`ACIERTO`, `CASI`) son solo para los juegos de cognicion, donde si hay
 * una respuesta correcta. Un fallo nunca se senala: se acompana («¡Casi!») y se invita a seguir.
 *
 * Todas las frases son cortas, estan en tono de tu y no suponen genero. Se eligen por
 * posicion y no al azar: pintar dos veces lo mismo dice lo mismo, y las pruebas no dependen
 * de la suerte.
 */

export const INICIO: readonly string[] = [
  'Vamos con calma. Aquí estoy contigo.',
  'Qué bueno verte por aquí. Empecemos con tranquilidad.',
  'Sin prisa. Esto es solo para ti.',
];

export const ACOMPANAN: readonly string[] = [
  'Gracias por contármelo.',
  'Eso me ayuda a acompañarte mejor.',
  'Seguimos, sin prisa.',
  'Vas a tu ritmo, y está perfecto.',
  'Un paso a la vez, así.',
  'Qué bien que te des este momento.',
];

/**
 * Lo que dice justo despues de que la persona elige algo. Va por posicion del paso y no por la
 * opcion elegida: agradece que contesto, no valora lo que contesto.
 */
export const AL_ELEGIR: readonly string[] = [
  'Anotado, gracias.',
  'Lo tengo. Gracias por decírmelo.',
  'Perfecto. Cuando quieras, seguimos.',
  'Listo, un paso más.',
  'Gracias, así me ayudas a acompañarte.',
];

export const CASI_AL_FINAL: readonly string[] = [
  '¡Ya casi! Falta muy poquito.',
  'La última, y terminamos.',
];

export const LISTO_PARA_TERMINAR: readonly string[] = [
  'Eso es todo. Gracias por dedicarte este momento.',
  'Listo. Lo hiciste con mucho cuidado.',
];

export const ACIERTO: readonly string[] = [
  '¡Eso es!',
  '¡Qué buena memoria!',
  '¡Así se hace!',
  '¡Lo tienes!',
  '¡Genial, sigue así!',
];

export const CASI: readonly string[] = [
  '¡Casi! Vas por buen camino.',
  'Así también se aprende. Va otra.',
  'Un intento más, sin presión.',
  '¡Casi lo logras! Tú puedes.',
];

/** Lo que se anade tras un «casi» en un juego: refuerza la practica, no senala el fallo. */
export const ANIMO_TRAS_CASI: readonly string[] = [
  'Cada intento entrena tu memoria.',
  'Lo importante es seguir practicando.',
  'Vas a tu ritmo, y está perfecto.',
  'La práctica hace la diferencia.',
];

/** Lo que dice al empezar y a mitad de un juego, cuando todavia no hay nada que celebrar. */
export const EN_EL_JUEGO: readonly string[] = [
  '¡Vamos a entrenar la mente un ratito!',
  'Tómate el tiempo que necesites.',
  'Con calma y atención, así.',
];

/** El que toca en la posicion `n` de una lista: da la vuelta al llegar al final. */
export function elegir(frases: readonly string[], n: number): string {
  if (frases.length === 0) {
    return '';
  }

  const posicion = ((Math.trunc(n) % frases.length) + frases.length) % frases.length;

  return frases[posicion] ?? '';
}

/** Lo que dice la mascota al elegir una opcion en el paso `paso` (desde 0). */
export function mensajeAlElegir(paso: number): string {
  return elegir(AL_ELEGIR, paso);
}

/**
 * Lo que dice la mascota en el paso `paso` (desde 0) de `total`, en una actividad que pregunta
 * por la persona. El primero da la bienvenida, el penultimo avisa que falta una, y el resto
 * agradece, sin depender de lo que se respondio.
 */
export function mensajeDelPaso(paso: number, total: number): string {
  if (paso <= 0) {
    return elegir(INICIO, 0);
  }

  if (total > 2 && paso === total - 1) {
    return elegir(CASI_AL_FINAL, 1);
  }

  if (total > 3 && paso === total - 2) {
    return elegir(CASI_AL_FINAL, 0);
  }

  return elegir(ACOMPANAN, paso - 1);
}
