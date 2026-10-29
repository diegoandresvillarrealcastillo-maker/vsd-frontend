import { useReducedMotion, type MotionProps } from 'framer-motion';

/** Lo que espera cada seccion respecto a la anterior, en segundos. */
const ESCALON_EN_S = 0.1;

/**
 * La entrada escalonada de las secciones del panel (SCRUM-310): cada una nace transparente y 16 px
 * mas abajo, y sube con un resorte suave, una tras otra. Solo al montar: no se repite.
 *
 * No hay entrada en dos casos, y en los dos se devuelve `{}` (nada que animar):
 * - con «reducir movimiento»;
 * - con el tutorial de Fungito por abrirse (`conEntrada` en falso): el tutorial mide en pantalla lo
 *   que señala al montar, y una entrada que desplaza 16 px lo dejaria mal puesto.
 *
 * Devuelve una funcion y no las props de una vez porque cada seccion espera segun su orden.
 */
export function useEntradaDelPanel(conEntrada: boolean): (orden: number) => MotionProps {
  const sinMovimiento = useReducedMotion() ?? false;

  return (orden) =>
    sinMovimiento || !conEntrada
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { type: 'spring', stiffness: 140, damping: 20, delay: orden * ESCALON_EN_S },
        };
}
