import { useId } from 'react';

import '../estilos/racha.css';
import type { NivelDeLaLlama } from '../infraestructura/api/racha.ts';

/**
 * El dibujo de la llama (SCRUM-186): una llama grande, una interior mas clara y, de los niveles
 * altos, chispas y una estrella. Lo usan la barra de arriba, el panel y la celebracion de la racha
 * (SCRUM-243), cada uno a su tamano.
 *
 * Es decorativo (`aria-hidden`): lo que se anuncia lo dice quien lo usa. Los colores salen de los
 * tokens `--llama-*` y el nivel decide cuales: ver `racha.css`.
 */
export function DibujoDeLaLlama({
  nivel,
  enDescanso,
  tamano = 26,
}: {
  nivel: NivelDeLaLlama;
  enDescanso: boolean;
  /** El ancho en pixeles; el alto sigue la proporcion del dibujo (24 por 26). */
  tamano?: number;
}) {
  const id = useId();
  const degradado = `${id}-llama`;

  return (
    <svg
      className="llama__dibujo"
      viewBox="0 0 24 26"
      width={tamano}
      height={Math.round((tamano * 26) / 24)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={degradado} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--llama-base)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--llama-media)' }} />
          <stop offset="1" style={{ stopColor: 'var(--llama-punta)' }} />
        </linearGradient>
      </defs>

      <path
        className="llama__cuerpo"
        fill={enDescanso ? 'none' : `url(#${degradado})`}
        d="M12 2.5c.6 3.3-1.6 5-3.3 7.2C7.3 11.5 6.5 13 6.5 15.4a5.5 5.5 0 0 0 11 0c0-2.2-1-3.9-2.1-5.3-.3 1.2-.9 2-1.6 2.4.6-3.2-.2-6.4-1.8-10Z"
      />

      {!enDescanso && (
        <path
          className="llama__corazon"
          d="M12 22a3.1 3.1 0 0 0 3.1-3.1c0-1.6-1.2-2.7-2.2-3.9-.3.9-.8 1.5-1.4 1.8.3-1.6-.2-3-.8-4.2-1.1 1.4-2 3-2 6.3A3.1 3.1 0 0 0 12 22Z"
        />
      )}

      {nivel >= 3 && !enDescanso && (
        <>
          <circle className="llama__chispa llama__chispa--a" cx="5" cy="9" r="1" />
          <circle className="llama__chispa llama__chispa--b" cx="19.5" cy="7" r="0.9" />
        </>
      )}

      {nivel >= 4 && !enDescanso && (
        <path
          className="llama__estrella"
          d="m12 0 .7 1.6 1.6.7-1.6.7L12 4.6l-.7-1.6-1.6-.7 1.6-.7Z"
        />
      )}
    </svg>
  );
}
