import type { ReactNode } from 'react';

/**
 * Los iconos del diseño de Figma Make, copiados trazo por trazo.
 *
 * Son SVG en linea y no una libreria: son trece, pesan menos que cualquier
 * dependencia, y heredan el color del texto con `currentColor`. Todos son
 * decorativos (`aria-hidden`): lo que significan lo dice siempre el texto que
 * los acompana.
 */
export type NombreDeIcono =
  | 'activity'
  | 'alert'
  | 'arrow'
  | 'book'
  | 'brain'
  | 'calendar'
  | 'check'
  | 'cloud'
  | 'cloud-off'
  | 'heart'
  | 'home'
  | 'leaf'
  | 'lock'
  | 'moon'
  | 'play'
  | 'plus'
  | 'refresh'
  | 'sparkles'
  | 'star'
  | 'user';

const TRAZOS: Record<NombreDeIcono, ReactNode> = {
  activity: <path d="M4 12h3l2-6 4 12 2-6h5" />,
  // Los cuatro siguientes son del indicador de conexion (SCRUM-137). No estan en el
  // diseño; mismo trazo y grosor que el resto.
  alert: (
    <>
      <path d="M12 4 2.5 20h19Z" />
      <path d="M12 10v4m0 3h.01" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 4.5A3 3 0 0 0 5 7a3 3 0 0 0 .5 5.5A3 3 0 0 0 9 17v2" />
      <path d="M14.5 4.5A3 3 0 0 1 19 7a3 3 0 0 1-.5 5.5A3 3 0 0 1 15 17v2" />
      <path d="M9 6.5c1.5.5 2 1.5 2 3V19M15 6.5c-1.5.5-2 1.5-2 3V19M8 12h3m2 2h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M3 10h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  cloud: <path d="M17.5 19a4.5 4.5 0 1 0-.9-8.9A6 6 0 0 0 5 12.2 3.9 3.9 0 0 0 5.5 19Z" />,
  'cloud-off': (
    <>
      <path d="M5.8 18.9A3.9 3.9 0 0 1 5 12.2a6 6 0 0 1 1.9-3.5M10 5.3a6 6 0 0 1 6.6 4.8 4.5 4.5 0 0 1 3.2 6.9M9.5 19h8" />
      <path d="m3 3 18 18" />
    </>
  ),
  heart: (
    <path d="M20.8 5.7a5.4 5.4 0 0 0-7.6 0L12 6.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z" />
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C12 4 5 8 5 15a5 5 0 0 0 5 5c7 0 10-8 10-16Z" />
      <path d="M4 21c2-6 6-10 12-13" />
    </>
  ),
  // `lock` y `star` son de la ruta del dia (SCRUM-170). Mismo trazo y grosor.
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  moon: <path d="M20.5 15.5A9 9 0 0 1 8.5 3.5a9 9 0 1 0 12 12Z" />,
  play: <path d="m9 7 9 5-9 5Z" />,
  // No esta en el diseño: hace falta para "Añadir módulo". Mismo trazo y
  // grosor que el resto, para que no se note que llego despues.
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />,
  sparkles: (
    <>
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z" />
      <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8Z" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

export function Icono({ nombre, tamano = 20 }: { nombre: NombreDeIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
