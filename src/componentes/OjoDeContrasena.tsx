import { motion, useReducedMotion } from 'framer-motion';

import { INMEDIATO } from '../estilos/movimiento.ts';

interface Props {
  visible: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * El ojo que muestra y esconde la contrasena.
 *
 * No cambia de icono: **es el mismo ojo que se transforma**. La pupila se
 * encoge hasta desaparecer, el parpado baja, y una linea se traza en diagonal
 * como si alguien la dibujara. Cambiar un icono por otro seria un corte; esto
 * es un gesto, y se lee como que la contrasena se esconde.
 *
 * Va dentro del campo y no al lado porque asi la persona no tiene que mover la
 * mirada: lo que quiere ver y el control que lo revela ocupan el mismo sitio.
 *
 * `type="button"` es obligatorio. Un boton sin tipo dentro de un formulario lo
 * envia, y aqui pulsarlo mandaria el registro a medio escribir.
 */
export function OjoDeContrasena({ visible, onClick, disabled }: Props) {
  const sinMovimiento = useReducedMotion();

  return (
    <motion.button
      type="button"
      className="ojo"
      onClick={onClick}
      disabled={disabled}
      // `aria-pressed` es lo que le dice a un lector de pantalla si la
      // contrasena esta visible ahora mismo. Sin el, el boton se anuncia igual
      // en los dos estados.
      aria-pressed={visible}
      aria-label={visible ? 'Ocultar la contrasena' : 'Mostrar la contrasena'}
      whileHover={sinMovimiento || disabled ? {} : { scale: 1.12 }}
      whileTap={sinMovimiento || disabled ? {} : { scale: 0.88 }}
      transition={INMEDIATO}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {/* El contorno del ojo. Se achata un poco cuando la contrasena se
            esconde, como un parpado que baja a medias. */}
        <motion.path
          d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ scaleY: visible ? 1 : 0.72 }}
          style={{ originX: '12px', originY: '12px' }}
          transition={sinMovimiento ? { duration: 0 } : INMEDIATO}
        />

        {/* La pupila se encoge hasta desaparecer. Es el movimiento que de
            verdad comunica: un ojo sin pupila ya no mira. */}
        <motion.circle
          cx="12"
          cy="12"
          r="3.1"
          stroke="currentColor"
          strokeWidth="1.8"
          animate={{ scale: visible ? 1 : 0, opacity: visible ? 1 : 0 }}
          style={{ originX: '12px', originY: '12px' }}
          transition={sinMovimiento ? { duration: 0 } : { ...INMEDIATO, stiffness: 600 }}
        />

        {/* La linea se traza sola de una esquina a otra. `pathLength` va de 0 a
            1 sobre la longitud real del trazo, asi que el dibujo se ve como un
            gesto y no como un icono que aparece. */}
        <motion.path
          d="M4 4 L20 20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: visible ? 0 : 1, opacity: visible ? 0 : 1 }}
          transition={sinMovimiento ? { duration: 0 } : { duration: 0.26, ease: 'easeOut' }}
        />
      </svg>
    </motion.button>
  );
}
