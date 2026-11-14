import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';

import '../../../estilos/viva.css';
import type { Mascota } from '../../../infraestructura/api/cuenta.ts';
import type { Expresion } from '../../../mascota/personajes.ts';
import { useImagenDeLaMascota } from './useImagenDeLaMascota.ts';

/**
 * La mascota hablando: su cara y un globo con lo que dice (SCRUM-173).
 *
 * Es el gesto que acompana a la persona en cada paso: le da la bienvenida, le agradece, le
 * dice cuanto falta. Respira sin parar, y da un saltito cada vez que sube `latido` (por ejemplo
 * al elegir una opcion o dar con una pareja). El globo entra con un rebote cada vez que cambia
 * lo que dice (`mensaje`), y puede llevar una segunda linea mas tenue (`ademas`). El texto nuevo
 * se pone de inmediato —sin esperar a que salga el anterior—: a quien lo lee con un lector de
 * pantalla no le sirve un mensaje que llega tarde.
 *
 * `resultado="acierto"` tine el globo del color del modulo; sin el, el globo es neutro. Un
 * «casi» nunca se pinta de rojo.
 *
 * Se anuncia con `aria-live="polite"`: un lector de pantalla lo lee sin interrumpir lo que la
 * persona estaba haciendo. Si la pantalla ya anuncia lo mismo por otro lado, `anunciar={false}`
 * evita que se lea dos veces. La cara es decorativa.
 *
 * Con `prefers-reduced-motion` el globo cambia sin rebote y la mascota no salta.
 */
export function VozDeLaMascota({
  mascota,
  mensaje,
  ademas,
  expresion = 'normal',
  latido = 0,
  resultado,
  anunciar = true,
}: {
  mascota: Mascota | null;
  mensaje: string;
  ademas?: string;
  expresion?: Expresion;
  latido?: number;
  resultado?: 'acierto' | 'casi';
  anunciar?: boolean;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const salto = useAnimationControls();
  const imagen = useImagenDeLaMascota(mascota, expresion);

  useEffect(() => {
    if (latido === 0 || sinMovimiento) {
      return;
    }

    void salto.start({
      y: [0, -22, 0, -8, 0],
      rotate: [0, -9, 9, -3, 0],
      scaleY: [1, 1.08, 0.9, 1.03, 1],
      transition: { duration: 0.7, ease: 'easeOut' },
    });
  }, [latido, sinMovimiento, salto]);

  return (
    <div className="viva-voz">
      <div className="viva-voz__mascota" aria-hidden="true">
        <span className="viva-voz__cara">
          <motion.span animate={salto} style={{ display: 'block', transformOrigin: '50% 100%' }}>
            <img src={imagen} alt="" width={92} height={92} draggable={false} />
          </motion.span>
        </span>
        <span className="viva-voz__sombra" />
      </div>

      <div
        className="viva-voz__globo"
        {...(resultado === undefined ? {} : { 'data-resultado': resultado })}
        {...(anunciar ? { 'aria-live': 'polite' as const } : {})}
      >
        <motion.div
          key={mensaje}
          style={{ transformOrigin: 'left bottom' }}
          initial={sinMovimiento ? false : { opacity: 0, y: 10, scale: 0.86, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        >
          <p>{mensaje}</p>
          {ademas !== undefined && <p className="viva-voz__extra">{ademas}</p>}
        </motion.div>
      </div>
    </div>
  );
}
