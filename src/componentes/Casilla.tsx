import { motion, useReducedMotion } from 'framer-motion';
import { useId, type ReactNode } from 'react';

import { INMEDIATO } from '../estilos/movimiento.ts';

interface Props {
  etiqueta: string;
  /** Segunda linea, mas pequena, que explica la consecuencia. */
  nota?: ReactNode;
  marcada: boolean;
  onChange: (marcada: boolean) => void;
  disabled?: boolean;
}

/**
 * Una casilla que responde como un objeto.
 *
 * El `input` real sigue ahi, solo que invisible: es el que recibe el foco, el
 * que responde a la barra espaciadora y el que un lector de pantalla anuncia.
 * Lo que se pinta encima es decoracion sincronizada con el.
 *
 * Reemplazar la casilla nativa por un `div` con un `onClick` es el error
 * clasico: se ve bien y deja fuera a quien navega con teclado.
 *
 * El movimiento tiene tres partes que ocurren a la vez:
 *
 *   - la caja se hunde un poco y vuelve, como si cediera bajo el dedo;
 *   - el relleno crece desde el centro en lugar de encenderse de golpe;
 *   - el check se traza solo, de un extremo al otro.
 *
 * Las tres son resortes, asi que la casilla se siente fisica. Y las tres se
 * apagan con "reducir movimiento": el estado se sigue viendo por el color y
 * por el check, que es lo que importa.
 */
export function Casilla({ etiqueta, nota, marcada, onChange, disabled }: Props) {
  const sinMovimiento = useReducedMotion();
  const id = useId();
  const idNota = `${id}-nota`;

  const resorte = sinMovimiento ? { duration: 0 } : INMEDIATO;

  return (
    <div className="casilla">
      <input
        id={id}
        type="checkbox"
        className="casilla__real"
        checked={marcada}
        disabled={disabled}
        aria-describedby={nota ? idNota : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />

      <label className="casilla__cuerpo" htmlFor={id}>
        <motion.span
          className="casilla__caja"
          aria-hidden="true"
          animate={{
            scale: marcada ? 1 : 0.94,
            borderColor: marcada ? 'var(--acento)' : 'var(--borde-fuerte)',
          }}
          whileTap={sinMovimiento || disabled ? {} : { scale: 0.8 }}
          transition={resorte}
        >
          {/* El relleno crece desde el centro. Encenderlo de golpe se lee como
              un cambio de estado; que crezca se lee como una respuesta. */}
          <motion.span
            className="casilla__relleno"
            initial={false}
            animate={{ scale: marcada ? 1 : 0 }}
            transition={sinMovimiento ? { duration: 0 } : { ...INMEDIATO, stiffness: 600 }}
          />

          <svg viewBox="0 0 24 24" fill="none" className="casilla__check">
            <motion.path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: marcada ? 1 : 0, opacity: marcada ? 1 : 0 }}
              transition={
                sinMovimiento ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
              }
            />
          </svg>
        </motion.span>

        <span className="casilla__texto">
          {etiqueta}
          {nota !== undefined && (
            <span className="casilla__nota" id={idNota}>
              {nota}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
