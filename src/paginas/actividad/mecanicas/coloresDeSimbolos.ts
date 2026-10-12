import type { CSSProperties } from 'react';

import type { NombreDeIcono } from '../../panel/Icono.tsx';

/**
 * El color de cada simbolo de los juegos de cognicion (SCRUM-173).
 *
 * Cada simbolo tiene el suyo para que se distingan de un vistazo, ademas de por su forma: asi
 * nadie depende solo del color para jugar. Son tonos oscuros y saturados; el CSS los aclara de
 * noche. Ninguno es un rojo de error ni un verde de «correcto»: no dicen si se juega bien o mal.
 */
const COLORES: Readonly<Partial<Record<NombreDeIcono, string>>> = {
  leaf: '#0a7a58',
  heart: '#c2335f',
  moon: '#4a52c9',
  sparkles: '#a86e00',
  book: '#1f7a99',
  calendar: '#c2570c',
};

/** El estilo en linea que le pasa su color al CSS por `--simbolo`. */
export function estiloDelSimbolo(icono: NombreDeIcono): CSSProperties {
  const color = COLORES[icono];

  return (color === undefined ? {} : { '--simbolo': color }) as CSSProperties;
}
