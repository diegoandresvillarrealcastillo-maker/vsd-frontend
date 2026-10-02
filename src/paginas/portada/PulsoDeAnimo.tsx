import { motion, useReducedMotion } from 'framer-motion';

/**
 * La linea del animo, que se traza sola al entrar en pantalla.
 *
 * ---------------------------------------------------------------------------
 * Por que no dice "ritmo cardiaco"
 * ---------------------------------------------------------------------------
 *
 * La forma es la de un electro porque es la que todo el mundo reconoce al
 * instante como "algo vivo que se esta midiendo". Pero VSD Health no mide el
 * pulso: no hay sensor, no hay reloj, no hay nada que lo lea. Ensenar un
 * corazon con una cifra al lado prometeria una capacidad que la aplicacion no
 * tiene, y en una herramienta de salud eso no es una licencia de diseno.
 *
 * Lo que aparece aqui es como se sintio alguien y cuando lo conto. Eso si
 * ocurre, y es suyo.
 *
 * ---------------------------------------------------------------------------
 * Por que no hay ninguna puntuacion
 * ---------------------------------------------------------------------------
 *
 * El indicador interno de bienestar no se le ensena a nadie. Un numero que
 * resume como estas invita a compararte contigo mismo de la peor manera, y una
 * mala semana pasa de ser una mala semana a ser una nota baja.
 */

/** Dos latidos sobre la linea de base. */
const TRAZO =
  'M0 62 H70 L82 62 L92 30 L102 92 L112 62 L124 62 H176 L188 62 L198 26 L208 96 L218 62 L230 62 H320';

export function PulsoDeAnimo({ activa = false }: { activa?: boolean }) {
  const quieto = useReducedMotion() ?? false;

  /**
   * Se arma el grupo entero de props en vez de anular cada una por separado.
   * Con `exactOptionalPropertyTypes`, pasar `undefined` a una prop opcional no
   * es lo mismo que no pasarla, y el compilador tiene razon: son dos cosas
   * distintas.
   */
  const trazarse = quieto
    ? ({ initial: { pathLength: 1 } } as const)
    : ({
        initial: { pathLength: 0 },
        whileInView: { pathLength: 1 },
        viewport: { once: true, amount: 0.6 },
        transition: { duration: 1.7, ease: [0.22, 1, 0.36, 1] },
      } as const);

  // Sin `as const` a proposito: los fotogramas tienen que quedar como arreglos
  // normales, porque Framer Motion los recorre y no acepta uno de solo
  // lectura. Solo la curva se fija como literal.
  //
  // Con el cursor encima el latido se acelera y crece un poco. Un corazon que
  // se acelera al mirarlo es lo que hace que la tarjeta se sienta viva en vez
  // de ser un dibujo que se repite.
  const latir = quieto
    ? {}
    : {
        // El latido real no es regular: golpe fuerte, rebote, golpe flojo y
        // despues una pausa larga. Repartirlo uniforme suena a metronomo.
        animate: { scale: activa ? [1, 1.24, 1.04, 1.14, 1] : [1, 1.16, 1.02, 1.09, 1] },
        transition: {
          duration: activa ? 0.95 : 1.5,
          times: [0, 0.1, 0.22, 0.34, 1],
          repeat: Infinity,
          ease: 'easeOut' as const,
        },
      };

  /**
   * El pulso que recorre la linea al pasar el cursor.
   *
   * Es un segundo trazo con la raya muy corta y el hueco muy largo: lo unico
   * que se ve es un tramo brillante, y al mover su desfase ese tramo viaja de
   * un extremo a otro. Se hace asi y no con un punto sobre la ruta porque el
   * guion sigue la forma exacta del electro, subidas incluidas.
   */
  const recorrido = quieto
    ? { animate: { opacity: 0 } }
    : {
        animate: {
          strokeDashoffset: activa ? [0, -1100] : 0,
          opacity: activa ? 0.9 : 0,
        },
        transition: activa
          ? {
              strokeDashoffset: { duration: 1.6, repeat: Infinity, ease: 'linear' as const },
              opacity: { duration: 0.25 },
            }
          : { duration: 0.3 },
      };

  return (
    <div className="metrica__lienzo">
      <svg
        viewBox="0 0 320 110"
        width="100%"
        height="110"
        fill="none"
        role="img"
        aria-label="Una línea de pulso que se dibuja de izquierda a derecha, con un corazón que late."
      >
        {/* El mismo trazo, grueso y borroso, por debajo. Es lo que hace que la
            linea parezca encendida en vez de pintada.

            La opacidad se anima en el grupo y no en el trazo porque el trazo ya
            tiene su propia animacion de entrada, con su duracion: puestas en el
            mismo elemento, el encendido al pasar el cursor heredaria el segundo
            y pico del dibujado y se sentiria pastoso. */}
        <motion.g
          animate={{ opacity: activa ? 0.55 : 0.28 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <motion.path
            d={TRAZO}
            stroke="var(--pulso)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'blur(7px)' }}
            {...trazarse}
          />
        </motion.g>

        <motion.path
          d={TRAZO}
          stroke="var(--pulso)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...trazarse}
        />

        {/* El tramo brillante que viaja. Fuera de la tarjeta es invisible. */}
        <motion.path
          d={TRAZO}
          stroke="var(--texto)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="26 1100"
          {...recorrido}
        />
      </svg>

      <motion.svg
        viewBox="0 0 24 24"
        width="30"
        height="30"
        fill="var(--pulso)"
        aria-hidden="true"
        style={{ marginTop: -14 }}
        {...latir}
      >
        <path d="M12 21s-7.4-4.7-9.6-9C.7 8.5 2.4 4.7 5.9 3.8c2-.5 4.2.4 5.4 2.1l.7 1 .7-1c1.2-1.7 3.4-2.6 5.4-2.1 3.5.9 5.2 4.7 3.5 8.2-2.2 4.3-9.6 9-9.6 9Z" />
      </motion.svg>
    </div>
  );
}
