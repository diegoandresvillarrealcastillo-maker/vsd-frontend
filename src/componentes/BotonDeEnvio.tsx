import { AnimatePresence, motion } from 'framer-motion';

/** En que punto esta el envio. */
export type EstadoDeEnvio = 'listo' | 'enviando' | 'hecho';

interface Props {
  estado: EstadoDeEnvio;
  children: string;
  /** Lo que se anuncia a un lector de pantalla al terminar bien. */
  textoAlTerminar?: string;
}

/**
 * El boton que se convierte en el indicador de progreso.
 *
 * Al enviar no aparece una ruedita al lado: el propio boton se contrae a
 * circulo, gira, y se abre en un check. Una sola forma que muta, en vez de dos
 * elementos compitiendo por decir lo mismo.
 *
 * Framer Motion anima el cambio de ancho y de radio porque son propiedades de
 * disposicion, y `layout` las interpola sin que haya que escribir una sola
 * medida a mano.
 *
 * Con "reducir movimiento" activado, el CSS global deja las transiciones en
 * casi cero: el boton salta entre estados en lugar de deslizarse, y se entiende
 * igual.
 */
export function BotonDeEnvio({ estado, children, textoAlTerminar = 'Listo' }: Props) {
  const ocupado = estado === 'enviando';
  const hecho = estado === 'hecho';

  return (
    <motion.button
      type="submit"
      layout
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`envio${ocupado ? ' envio--ocupado' : ''}${hecho ? ' envio--hecho' : ''}`}
      disabled={ocupado || hecho}
      // Mientras esta ocupado, quien no ve la pantalla necesita saberlo: el
      // cambio de forma no le llega.
      aria-busy={ocupado || undefined}
      aria-label={ocupado ? 'Enviando' : hecho ? textoAlTerminar : undefined}
    >
      <AnimatePresence mode="wait" initial={false}>
        {ocupado && (
          <motion.span
            key="girando"
            className="envio__giro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}

        {hecho && (
          <motion.svg
            key="hecho"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* El trazo se dibuja solo: el check aparece como si alguien lo
                acabara de hacer, y eso lee mejor que un icono que surge. */}
            <motion.path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            />
          </motion.svg>
        )}

        {!ocupado && !hecho && (
          <motion.span
            key="texto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
