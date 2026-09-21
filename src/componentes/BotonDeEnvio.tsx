import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { ACOMPANADO, INMEDIATO, REACCION_DE_BOTON } from '../estilos/movimiento.ts';

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
 * Bajo el cursor se acerca un poco y se levanta un pixel; al pulsarlo cede.
 * Esa cesion es la parte que de verdad se siente: sin ella el boton responde,
 * pero no parece un objeto.
 *
 * `useReducedMotion` apaga todo eso para quien lo pidio en su sistema. El CSS
 * ya frena las transiciones, pero Framer Motion anima con JavaScript y no se
 * entera: hay que preguntarselo.
 */
export function BotonDeEnvio({ estado, children, textoAlTerminar = 'Listo' }: Props) {
  const sinMovimiento = useReducedMotion();
  const ocupado = estado === 'enviando';
  const hecho = estado === 'hecho';
  const bloqueado = ocupado || hecho;

  const reaccion = sinMovimiento || bloqueado ? {} : REACCION_DE_BOTON;

  return (
    <motion.button
      type="submit"
      layout
      transition={ACOMPANADO}
      className={`envio${ocupado ? ' envio--ocupado' : ''}${hecho ? ' envio--hecho' : ''}`}
      disabled={bloqueado}
      // Mientras esta ocupado, quien no ve la pantalla necesita saberlo: el
      // cambio de forma no le llega.
      aria-busy={ocupado || undefined}
      aria-label={ocupado ? 'Enviando' : hecho ? textoAlTerminar : undefined}
      {...reaccion}
    >
      {/* El brillo que cruza el boton al pasar el cursor. Es decorativo y no
          debe leerse; va detras del texto y no recibe eventos. */}
      {!sinMovimiento && !bloqueado && <span className="envio__brillo" aria-hidden="true" />}

      <AnimatePresence mode="wait" initial={false}>
        {ocupado && (
          <motion.span
            key="girando"
            className="envio__giro"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={INMEDIATO}
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
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={INMEDIATO}
          >
            {/* El trazo se dibuja solo: el check aparece como si alguien lo
                acabara de hacer, y eso lee mejor que un icono que surge. */}
            <motion.path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: sinMovimiento ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: sinMovimiento ? 0 : 0.34, ease: 'easeOut' }}
            />
          </motion.svg>
        )}

        {!bloqueado && (
          <motion.span
            key="texto"
            className="envio__texto"
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
