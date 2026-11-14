import type { TargetAndTransition } from 'framer-motion';

import type { Expresion } from './personajes.ts';

/**
 * El movimiento de una mascota propia (SCRUM-122).
 *
 * Un SVG propio no trae las cuatro caras de los personajes, y no se puede
 * cambiar de dibujo. Lo que se cambia es **como se mueve y como brilla**: feliz
 * se menea, celebrando salta y se inclina, dormida respira despacio y se apaga
 * (el brillo va en el CSS).
 *
 * Todas fijan `y`, `rotate` y `scale`: un movimiento que no nombra una propiedad
 * la deja como la dejo el anterior, y una mascota que pasa de celebrar a estar
 * quieta no puede quedarse torcida.
 *
 * Con `prefers-reduced-motion` no se mueve nada: queda en reposo y derecha, sin
 * ninguna transicion que se repita.
 */
export function movimientoDeLaPropia(
  expresion: Expresion,
  sinMovimiento: boolean,
): TargetAndTransition {
  if (sinMovimiento) {
    return { y: 0, rotate: 0, scale: 1 };
  }

  switch (expresion) {
    case 'celebrando':
      return {
        y: [0, -18, 0, -9, 0],
        rotate: [0, -8, 8, -4, 0],
        scale: [1, 1.08, 1, 1.04, 1],
        transition: { duration: 1.2, repeat: Infinity, repeatDelay: 0.4, ease: 'easeOut' },
      };
    case 'feliz':
      return {
        y: [0, -6, 0],
        rotate: [0, -5, 5, 0],
        scale: [1, 1.06, 1],
        transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'dormida':
      return {
        y: 0,
        rotate: 0,
        scale: [1, 1.03, 1],
        transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
      };
    default:
      return {
        y: [0, -3, 0],
        rotate: 0,
        scale: 1,
        transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
      };
  }
}
