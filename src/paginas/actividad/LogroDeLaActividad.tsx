import { motion, useReducedMotion } from 'framer-motion';

import { Confeti } from '../../componentes/Confeti.tsx';
import { Icono } from '../panel/Icono.tsx';
import { useImagenDeLaMascota } from './viva/useImagenDeLaMascota.ts';
import { useMascotaDeLaPersona } from './viva/mascotaDeLaPersona.ts';

import '../../estilos/viva.css';

/**
 * El gesto de logro al terminar una actividad (SCRUM-170, rehecho en SCRUM-173): una tarjeta
 * con el color del modulo, rayos que giran despacio, una insignia que se infla con aros que se
 * abren, una marca que se dibuja, la mascota bailando y, cuando corresponde, confeti.
 *
 * ## Cuando se celebra y cuando solo se acompana
 *
 * Terminar una actividad siempre es algo bueno: la persona se tomo un momento para si.
 * Pero el confeti junto a una orientacion que dice «conviene prestarle atencion» o junto
 * a las lineas de atencion estaria fuera de lugar. Por eso, cuando `celebrar` es falso
 * —el resultado pide acompanar, o todavia no se sabe cual fue—, la tarjeta sale igual,
 * mas tranquila y con otro texto: sin confeti, sin aros, sin baile.
 *
 * Con `prefers-reduced-motion` la insignia aparece ya puesta y el confeti no existe.
 *
 * Aqui vive el `<h1>` de la pantalla de resultado.
 */
export function LogroDeLaActividad({
  celebrar,
  titulo = 'Listo',
}: {
  celebrar: boolean;
  titulo?: string;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const mascota = useMascotaDeLaPersona();
  const imagen = useImagenDeLaMascota(mascota, celebrar ? 'celebrando' : 'feliz');

  return (
    <section className={`viva-logro${celebrar ? '' : ' viva-logro--serena'}`}>
      <span className="viva-logro__rayos" aria-hidden="true" />

      <div className="viva-logro__escena">
        <motion.span
          className="viva-logro__insignia"
          aria-hidden="true"
          initial={sinMovimiento ? false : { scale: 0.3, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 13 }}
        >
          <span className="viva-logro__aro" />
          <span className="viva-logro__aro" />
          <span className="viva-logro__aro" />

          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <motion.path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={sinMovimiento ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
            />
          </svg>
          {celebrar && <Confeti />}
        </motion.span>

        <motion.span
          className="viva-logro__mascota"
          aria-hidden="true"
          initial={sinMovimiento ? false : { opacity: 0, x: -24, scale: 0.6 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 16 }}
        >
          <img src={imagen} alt="" width={96} height={96} draggable={false} />
        </motion.span>
      </div>

      <h1 className="viva-logro__titulo">{titulo}</h1>

      <p className="viva-logro__texto">
        {celebrar ? '¡Lo hiciste!' : 'Gracias por tomarte este momento.'}
      </p>

      {celebrar && (
        <ul className="viva-logro__premios">
          <li className="viva-logro__premio">
            <Icono nombre="star" tamano={16} />
            Actividad completada
          </li>
          <li className="viva-logro__premio">
            <Icono nombre="heart" tamano={16} />
            Un momento para ti
          </li>
        </ul>
      )}
    </section>
  );
}
