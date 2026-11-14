import type { CSSProperties } from 'react';

/**
 * El color de cada casilla de «Recuerda los colores» (SCRUM-209, ficha COG-01).
 *
 * Como en `coloresDeSimbolos.ts`, los colores salen de la paleta de la aplicacion (`--app-*`) y
 * por eso cambian solos entre el tema claro y el oscuro. **El color es un apoyo, nunca la unica
 * pista (R10):** cada casilla lleva tambien su forma y su nombre visible. Ninguno es un rojo de
 * error ni un verde de «correcto»: no dicen si se juega bien o mal.
 *
 * Los nombres son los que escribe quien redacta la sesion; se reconocen con o sin tilde y con o
 * sin mayusculas. Un color que no se conozca se pinta con el tono neutro: la casilla se juega
 * igual, por su forma y su nombre.
 */
const COLORES: Readonly<Record<string, string>> = {
  verde: 'var(--app-bienestar-acento)',
  azul: 'var(--app-cognicion-acento)',
  ambar: 'color-mix(in srgb, var(--viva-sol) 82%, var(--app-avatar-tinta))',
  violeta: 'color-mix(in srgb, var(--app-cognicion-acento) 58%, var(--app-emociones-acento))',
  rosa: 'color-mix(in srgb, var(--app-emociones-acento) 58%, #fff)',
  turquesa: 'color-mix(in srgb, var(--app-primario) 60%, var(--app-cognicion-acento))',
  gris: 'var(--app-tenue)',
  naranja: 'color-mix(in srgb, var(--app-emociones-acento) 55%, var(--viva-sol))',
  marron: 'var(--app-avatar-tinta)',
};

const NEUTRO = 'var(--app-tenue)';

/** Sin tildes, sin espacios en los bordes y en minusculas: «Ámbar» y «ambar» son el mismo. */
export function normalizarElNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

/** El estilo en linea que le pasa su color al CSS por `--simbolo`. */
export function estiloDeLaCasilla(color: string | undefined): CSSProperties {
  const nombre = color === undefined ? undefined : normalizarElNombre(color);
  // Solo los nombres de la tabla: «constructor» no es un color, aunque el objeto tenga uno.
  const tono = nombre !== undefined && Object.hasOwn(COLORES, nombre) ? COLORES[nombre] : undefined;

  return { '--simbolo': tono ?? NEUTRO } as CSSProperties;
}
