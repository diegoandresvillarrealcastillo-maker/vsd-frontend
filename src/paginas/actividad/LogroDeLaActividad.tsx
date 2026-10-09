import { motion, useReducedMotion } from 'framer-motion';

import { Confeti } from '../../componentes/Confeti.tsx';

/**
 * El gesto de logro al terminar una actividad (SCRUM-170): una insignia que se infla, una
 * marca que se dibuja y, cuando corresponde, un chorro corto de confeti.
 *
 * ## Cuando se celebra y cuando solo se acompana
 *
 * Terminar una actividad siempre es algo bueno: la persona se tomo un momento para si.
 * Pero el confeti junto a una orientacion que dice «conviene prestarle atencion» o junto
 * a las lineas de atencion estaria fuera de lugar. Por eso, cuando `celebrar` es falso
 * —el resultado pide acompanar, o todavia no se sabe cual fue—, la insignia sale igual,
 * mas tranquila y con otro texto, y no hay confeti.
 *
 * Con `prefers-reduced-motion` la insignia aparece ya puesta y el confeti no existe.
 */
export function LogroDeLaActividad({ celebrar }: { celebrar: boolean }) {
  const sinMovimiento = useReducedMotion() ?? false;

  return (
    <div className="actividad__logro">
      <motion.span
        className={`actividad__insignia${celebrar ? '' : ' actividad__insignia--serena'}`}
        aria-hidden="true"
        initial={sinMovimiento ? false : { scale: 0.4, rotate: -14 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={
          sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 15 }
        }
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <motion.path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={sinMovimiento ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              sinMovimiento ? { duration: 0 } : { delay: 0.25, duration: 0.5, ease: 'easeOut' }
            }
          />
        </svg>
        {celebrar && <Confeti />}
      </motion.span>

      <p className="actividad__logro-texto">
        {celebrar ? '¡Lo hiciste!' : 'Gracias por tomarte este momento.'}
      </p>
    </div>
  );
}
