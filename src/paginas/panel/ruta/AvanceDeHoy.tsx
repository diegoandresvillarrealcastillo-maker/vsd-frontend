import { motion, useReducedMotion } from 'framer-motion';

import { textoDelAvance } from './textoDelAvance.ts';

/**
 * La tarjeta "Tu actividad de hoy": el porcentaje y una barra que se llena (SCRUM-170).
 *
 * La barra arranca desde lo que habia antes de lo que se acaba de hacer, y se llena hasta
 * donde esta ahora: quien vuelve de terminar una actividad ve crecer su avance. Con
 * `prefers-reduced-motion` aparece ya llena.
 *
 * El texto acompana segun el momento y nunca reprocha: tampoco cuando no se ha hecho
 * nada. Lo ultimo, que esto refleja actividades y no una valoracion de la salud, va
 * siempre (L-03 de la auditoria 360).
 */
function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

export function AvanceDeHoy({
  hechas,
  total,
  recienHechas,
}: {
  hechas: number;
  total: number;
  /** Cuantas se acaban de hacer: de ahi arranca la barra. */
  recienHechas: number;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const ahora = porcentaje(hechas, total);
  const antes = porcentaje(Math.max(0, hechas - recienHechas), total);

  return (
    <div className="app__caja app__avance">
      <div className="app__avance-cabecera">
        <span>Tu actividad de hoy</span>
        {total > 0 && <span className="app__avance-cifra">{ahora}%</span>}
      </div>

      <div
        className="app__barra-progreso"
        role="progressbar"
        aria-label="Actividades de hoy hechas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={hechas}
      >
        <motion.div
          initial={sinMovimiento ? false : { width: `${String(antes)}%` }}
          animate={{ width: `${String(ahora)}%` }}
          transition={
            sinMovimiento ? { duration: 0 } : { duration: 0.9, ease: 'easeOut', delay: 0.25 }
          }
        />
      </div>

      <p className="app__nota">
        {textoDelAvance(hechas, total)} Refleja actividades, no una valoración de tu salud.
      </p>
    </div>
  );
}
