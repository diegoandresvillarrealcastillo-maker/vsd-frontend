import { describe, expect, it } from 'vitest';

import ESTADOS from './estados.css?raw';

/**
 * Las cargas y los vacios respetan a quien pide menos movimiento (SCRUM-180).
 *
 * jsdom no anima, asi que lo que se vigila es la regla: que el brillo del esqueleto exista y que
 * con `prefers-reduced-motion` quede quieto. La regla global de `global.css` ya acorta las
 * animaciones a 0,01 ms, pero un esqueleto con el brillo "casi" quieto sigue parpadeando una vez;
 * aqui se apaga de verdad.
 */

const SIN_COMENTARIOS = ESTADOS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('El esqueleto', () => {
  it('tiene un brillo que recorre la forma', () => {
    expect(SIN_COMENTARIOS).toMatch(/@keyframes\s+esqueleto-brillo/);
    expect(SIN_COMENTARIOS).toMatch(/\.esqueleto\s*\{[^}]*animation:[^;]*esqueleto-brillo/);
  });

  it('con movimiento reducido no se anima', () => {
    const bloque = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
      SIN_COMENTARIOS,
    )?.[1];

    expect(bloque, 'no hay un bloque de movimiento reducido').toBeDefined();
    expect(bloque).toMatch(/\.esqueleto\s*\{[^}]*animation:\s*none/);
  });

  it('usa los tokens de la aplicacion y no colores fijos', () => {
    const reglaBase = /\.esqueleto\s*\{([^}]*)\}/.exec(SIN_COMENTARIOS)?.[1] ?? '';

    expect(reglaBase).toContain('var(--app-');
    expect(reglaBase).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
