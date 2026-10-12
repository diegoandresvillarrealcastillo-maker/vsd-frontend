import type { CSSProperties } from 'react';

import type { NombreDeIcono } from '../../panel/Icono.tsx';

/**
 * El color de cada simbolo de los juegos de cognicion (SCRUM-173).
 *
 * Cada simbolo tiene el suyo para que se distingan de un vistazo, ademas de por su forma: asi
 * nadie depende solo del color para jugar. Los colores salen de la paleta de la aplicacion
 * (`--app-*`), la misma del panel, y por eso cambian solos entre el tema claro y el oscuro.
 * Ninguno es un rojo de error ni un verde de «correcto»: no dicen si se juega bien o mal.
 */
const COLORES: Readonly<Partial<Record<NombreDeIcono, string>>> = {
  leaf: 'var(--app-bienestar-acento)',
  heart: 'var(--app-emociones-acento)',
  moon: 'var(--app-cognicion-acento)',
  sparkles: 'var(--app-avatar-tinta)',
  book: 'var(--app-primario)',
  calendar: 'color-mix(in srgb, var(--app-emociones-acento) 55%, var(--app-avatar-tinta))',
};

/** El estilo en linea que le pasa su color al CSS por `--simbolo`. */
export function estiloDelSimbolo(icono: NombreDeIcono): CSSProperties {
  const color = COLORES[icono];

  return (color === undefined ? {} : { '--simbolo': color }) as CSSProperties;
}
