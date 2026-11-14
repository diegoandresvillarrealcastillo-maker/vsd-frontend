import type { CSSProperties } from 'react';

import { porcentaje } from '../porcentaje.ts';
import { textoDelAvance } from './textoDelAvance.ts';

/**
 * La tarjeta "Tu actividad de hoy": el porcentaje y una barra que se llena (SCRUM-170).
 *
 * Cuando se acaba de hacer algo, la barra arranca desde lo que habia antes y se llena hasta
 * donde esta ahora: quien vuelve de terminar una actividad ve crecer su avance. Lo hace con
 * una animacion de CSS (`aplicacion.css`), que se apaga sola con `prefers-reduced-motion`.
 * Si no hay nada nuevo, la barra simplemente esta donde esta.
 *
 * El texto acompana segun el momento y nunca reprocha: tampoco cuando no se ha hecho
 * nada. Lo ultimo, que esto refleja actividades y no una valoracion de la salud, va
 * siempre (L-03 de la auditoria 360).
 */
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
  const ahora = porcentaje(hechas, total);
  const antes = porcentaje(Math.max(0, hechas - recienHechas), total);
  const llenandose = antes !== ahora;

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
        <div
          className={llenandose ? 'app__barra-llenandose' : undefined}
          style={{ width: `${String(ahora)}%`, '--desde': `${String(antes)}%` } as CSSProperties}
        />
      </div>

      <p className="app__nota">
        {textoDelAvance(hechas, total)} Refleja actividades, no una valoración de tu salud.
      </p>
    </div>
  );
}
