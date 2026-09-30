import type { Transition } from 'framer-motion';

/**
 * Las curvas de movimiento del proyecto, en un solo sitio.
 *
 * ---------------------------------------------------------------------------
 * Por que resortes y no duraciones
 * ---------------------------------------------------------------------------
 *
 * Una transicion de 200 ms siempre tarda 200 ms, vaya donde vaya. Un resorte
 * responde a la distancia: un desplazamiento pequeno se resuelve rapido y uno
 * grande se toma su tiempo. Es lo que hace que el movimiento se sienta fisico
 * en lugar de programado, y es la diferencia mas grande entre una interfaz que
 * parece viva y una que parece una hoja de calculo con colores.
 *
 * ---------------------------------------------------------------------------
 * Por que ninguno rebota
 * ---------------------------------------------------------------------------
 *
 * El amortiguamiento esta alto a proposito en los tres. Un rebote llama la
 * atencion sobre el propio movimiento, y aqui el movimiento tiene que
 * acompanar lo que la persona hace, no hacerse notar. En una herramienta de
 * bienestar eso importa mas que en cualquier otra.
 */

/** Para lo que reacciona bajo el dedo: hover, pulsacion, foco. */
export const INMEDIATO: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 34,
  mass: 0.7,
};

/** Para lo que cambia de sitio o de tamano: la tarjeta, el boton que muta. */
export const ACOMPANADO: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
  mass: 0.9,
};

/** Para lo que entra en pantalla. Sin resorte: entrar no es rebotar. */
export const ENTRADA: Transition = {
  duration: 0.34,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * Lo que hace un control al pasar el cursor y al pulsarlo.
 *
 * La escala es de 1,015 y no de 1,05. Un boton que crece un cinco por ciento
 * empuja lo que tiene al lado y se nota como un salto; a este tamano lo que se
 * percibe es que el boton se acerca, no que cambia.
 *
 * Al pulsar se encoge por debajo del tamano original. Es lo que da la
 * sensacion de que el control cede, que es la parte que de verdad se siente.
 */
export const REACCION_DE_BOTON = {
  whileHover: { scale: 1.015, y: -1 },
  whileTap: { scale: 0.985, y: 0 },
  transition: INMEDIATO,
} as const;

/** Igual, pero mas contenida: para controles secundarios. */
export const REACCION_SUAVE = {
  whileHover: { scale: 1.008, y: -1 },
  whileTap: { scale: 0.992, y: 0 },
  transition: INMEDIATO,
} as const;
