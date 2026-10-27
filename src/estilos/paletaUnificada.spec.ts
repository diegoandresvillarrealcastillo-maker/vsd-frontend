import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';
import GLOBAL from './global.css?raw';

/**
 * El tema oscuro de la cuenta es el de la portada (SCRUM-286). `--app-*` no puede apuntar a los
 * tokens globales con `var()` (dentro de `.actividad`, `viva.css` redefine `--fondo`), asi que
 * repite sus valores. Este spec es lo que impide que se separen otra vez sin que nadie lo note.
 */

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** El cuerpo de un bloque por su selector exacto. */
function bloque(hoja: string, selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\']/g, String.raw`\$&`);
  const cuerpo = new RegExp(String.raw`(?:^|\n)${escapado}\s*\{([^}]*)\}`).exec(hoja)?.[1];

  if (cuerpo === undefined) {
    throw new Error(`No hay un bloque para ${selector}`);
  }

  return cuerpo;
}

function colores(cuerpo: string): Record<string, string> {
  return Object.fromEntries(
    [...cuerpo.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

const PORTADA = colores(bloque(sinComentarios(GLOBAL), ":root[data-tema='oscuro']"));
const CUENTA = colores(bloque(sinComentarios(APLICACION), '.app,\n.actividad'));

/** Cada token de la cuenta y el de la portada que tiene que valer lo mismo. */
const PAREJAS: readonly (readonly [string, string])[] = [
  ['--app-lienzo', '--fondo'],
  ['--app-superficie', '--fondo-elevado'],
  ['--app-superficie-alta', '--fondo-sutil'],
  ['--app-borde', '--borde'],
  ['--app-tinta', '--texto'],
  ['--app-tenue', '--texto-tenue'],
  ['--app-primario', '--acento'],
  ['--app-salvia', '--acento-claro'],
  ['--app-sobre-primario', '--acento-contraste'],
  ['--app-bienestar', '--acento-suave'],
  ['--app-bienestar-acento', '--acento-claro'],
  ['--app-cognicion', '--dato-suave'],
  ['--app-cognicion-acento', '--dato'],
  ['--app-emociones', '--error-suave'],
  ['--app-emociones-acento', '--pulso'],
];

describe('paleta oscura de la cuenta', () => {
  it.each(PAREJAS)('%s vale lo mismo que %s en la portada', (propio, global) => {
    expect(PORTADA[global], `${global} no esta en el tema oscuro de global.css`).toBeDefined();
    expect(CUENTA[propio]).toBe(PORTADA[global]);
  });
});
