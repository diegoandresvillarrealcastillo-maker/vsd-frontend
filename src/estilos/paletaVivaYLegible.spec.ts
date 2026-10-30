import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';
import GLOBAL from './global.css?raw';

/**
 * La paleta es viva y se lee (SCRUM-309).
 *
 * Dos cosas que se rompen sin que nadie lo note y que jsdom no puede ver pintadas: que los acentos
 * pierdan saturacion (la aplicacion se veia opaca) y que un texto deje de llegar a 4,5:1 sobre su
 * fondo. Se miden sobre los valores que estan en las hojas, en claro y en oscuro, dentro de la
 * cuenta y en la portada.
 */

type Tokens = Readonly<Record<string, string>>;

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** El cuerpo de un bloque por su selector exacto. */
function bloque(hoja: string, selector: string): Tokens {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\']/g, String.raw`\$&`);
  const cuerpo = new RegExp(String.raw`(?:^|\n)${escapado}\s*\{([^}]*)\}`).exec(
    sinComentarios(hoja),
  )?.[1];

  if (cuerpo === undefined) {
    throw new Error(`No hay un bloque para ${selector}`);
  }

  return Object.fromEntries(
    [...cuerpo.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  ) as Tokens;
}

function canal(valor: number): number {
  const c = valor / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function canales(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa y contraste, como los define WCAG 2.2. */
function luminancia(hex: string): number {
  const [r, g, b] = canales(hex);

  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];

  return (claro + 0.05) / (oscuro + 0.05);
}

/** Saturacion HSL, de 0 a 1. */
function saturacion(hex: string): number {
  const [r, g, b] = canales(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1));
}

const CUENTA = {
  oscuro: bloque(APLICACION, '.app,\n.actividad'),
  claro: bloque(APLICACION, ":root[data-tema='claro'] .app,\n:root[data-tema='claro'] .actividad"),
};

const PORTADA = {
  oscuro: bloque(GLOBAL, ":root[data-tema='oscuro']"),
  claro: bloque(GLOBAL, ':root'),
};

const TEMAS = ['oscuro', 'claro'] as const;

/** Un texto (primero) sobre su fondo (segundo), con el minimo que pide la WCAG. */
// Sin `readonly`: `it.each` solo reparte los argumentos con tipo cuando cada caso es una tupla mutable.
type Par = [texto: string, fondo: string, minimo?: number];

const PARES_DE_LA_CUENTA: readonly Par[] = [
  ['--app-tinta', '--app-lienzo'],
  ['--app-tinta', '--app-superficie'],
  ['--app-tinta', '--app-superficie-alta'],
  ['--app-tenue', '--app-lienzo'],
  ['--app-tenue', '--app-superficie'],
  ['--app-tenue', '--app-superficie-alta'],
  ['--app-primario', '--app-lienzo'],
  ['--app-primario', '--app-superficie'],
  ['--app-sobre-primario', '--app-primario'],
  ['--app-salvia', '--app-lienzo'],
  ['--app-salvia', '--app-superficie'],
  ['--app-salvia', '--app-superficie-alta'],
  ['--app-bienestar-acento', '--app-bienestar'],
  ['--app-cognicion-acento', '--app-cognicion'],
  ['--app-emociones-acento', '--app-emociones'],
  ['--app-tinta', '--app-bienestar'],
  ['--app-tinta', '--app-cognicion'],
  ['--app-tinta', '--app-emociones'],
  ['--app-avatar-tinta', '--app-avatar'],
];

const PARES_DE_LA_PORTADA: readonly Par[] = [
  ['--texto', '--fondo'],
  ['--texto', '--fondo-elevado'],
  ['--texto', '--fondo-sutil'],
  ['--texto-tenue', '--fondo'],
  ['--texto-tenue', '--fondo-elevado'],
  ['--texto-tenue', '--fondo-sutil'],
  ['--texto-apagado', '--fondo'],
  ['--texto-apagado', '--fondo-elevado'],
  ['--texto-apagado', '--fondo-sutil'],
  // Linea de control: es la unica senal de donde empieza un campo, asi que pide 3:1.
  ['--borde-fuerte', '--fondo', 3],
  ['--borde-fuerte', '--fondo-elevado', 3],
  ['--acento', '--fondo'],
  ['--acento', '--fondo-elevado'],
  ['--acento', '--acento-suave'],
  ['--acento-contraste', '--acento'],
  ['--error', '--fondo'],
  ['--error', '--fondo-elevado'],
  ['--error', '--error-suave'],
  ['--exito', '--acento-suave'],
  ['--dato', '--fondo'],
  ['--dato', '--dato-suave'],
  ['--pulso', '--fondo'],
  ['--pulso', '--fondo-elevado'],
];

/** Lo que tiene que verse vivo: el primario y el acento de cada modulo. */
const ACENTOS_DE_LA_CUENTA = [
  '--app-primario',
  '--app-bienestar-acento',
  '--app-cognicion-acento',
  '--app-emociones-acento',
];

const ACENTOS_DE_LA_PORTADA = ['--acento', '--dato', '--pulso'];

const SATURACION_MINIMA = 0.6;

function valor(tokens: Tokens, nombre: string, donde: string): string {
  const color = tokens[nombre];

  if (color === undefined) {
    throw new Error(`${nombre} no esta en ${donde}`);
  }

  return color;
}

describe.each(TEMAS)('paleta de la cuenta, tema %s', (tema) => {
  it.each(PARES_DE_LA_CUENTA)('%s sobre %s llega al contraste', (texto, fondo, minimo = 4.5) => {
    const donde = `la cuenta en ${tema}`;

    expect(
      contraste(valor(CUENTA[tema], texto, donde), valor(CUENTA[tema], fondo, donde)),
    ).toBeGreaterThanOrEqual(minimo);
  });

  it.each(ACENTOS_DE_LA_CUENTA)('%s es un color vivo', (acento) => {
    expect(saturacion(valor(CUENTA[tema], acento, `la cuenta en ${tema}`))).toBeGreaterThanOrEqual(
      SATURACION_MINIMA,
    );
  });
});

describe.each(TEMAS)('paleta de la portada, tema %s', (tema) => {
  it.each(PARES_DE_LA_PORTADA)('%s sobre %s llega al contraste', (texto, fondo, minimo = 4.5) => {
    const donde = `la portada en ${tema}`;

    expect(
      contraste(valor(PORTADA[tema], texto, donde), valor(PORTADA[tema], fondo, donde)),
    ).toBeGreaterThanOrEqual(minimo);
  });

  it.each(ACENTOS_DE_LA_PORTADA)('%s es un color vivo', (acento) => {
    expect(
      saturacion(valor(PORTADA[tema], acento, `la portada en ${tema}`)),
    ).toBeGreaterThanOrEqual(SATURACION_MINIMA);
  });
});
