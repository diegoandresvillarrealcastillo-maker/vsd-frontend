import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useRef, type ReactNode } from 'react';

import '../../../estilos/viva.css';

/**
 * Un paso de la actividad que entra y sale con un desplazamiento suave (SCRUM-173).
 *
 * Avanzar lo manda hacia la izquierda y volver, hacia la derecha: el cuerpo entiende hacia
 * donde va. Con `prefers-reduced-motion` solo se funde.
 *
 * Al cambiar de paso el foco pasa al titulo, sin mover la pantalla: quien usa teclado o
 * lector de pantalla cae justo en la pregunta nueva y no en el boton de abajo.
 */
export function PasoAnimado({
  clave,
  direccion,
  titulo,
  ayuda,
  children,
}: {
  /** Cambia con cada paso: es lo que dispara la animacion. */
  clave: string;
  /** 1 al avanzar, -1 al volver. */
  direccion: 1 | -1;
  titulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  // La clave con la que se abrio la actividad: con esa el foco no se toca.
  const claveInicial = useRef(clave);

  // El foco se pone cuando el titulo NUEVO ya esta en pantalla: con `mode="wait"` el anterior
  // sale antes de que entre el siguiente, y mandar el foco al titulo viejo lo perderia al
  // desmontarse. Una funcion de referencia corre justo al montarse el titulo nuevo.
  const alMontarElTitulo = useCallback(
    (titulo: HTMLHeadingElement | null) => {
      if (titulo !== null && clave !== claveInicial.current) {
        titulo.focus({ preventScroll: true });
      }
    },
    [clave],
  );

  const desplazamiento = sinMovimiento ? 0 : 48 * direccion;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={clave}
        className="viva-paso"
        aria-labelledby={`viva-titulo-${clave}`}
        initial={{ opacity: 0, x: desplazamiento }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -desplazamiento, transition: { duration: 0.14, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      >
        <h2
          id={`viva-titulo-${clave}`}
          ref={alMontarElTitulo}
          tabIndex={-1}
          className="viva-paso__titulo"
        >
          {titulo}
        </h2>
        {ayuda !== undefined && <p className="viva-paso__ayuda">{ayuda}</p>}
        {children}
      </motion.section>
    </AnimatePresence>
  );
}
