import { describe, expect, it } from 'vitest';

import TUTORIAL from './tutorial.css?raw';

/**
 * El tutorial de Fungito, en CSS (SCRUM-187).
 *
 * jsdom no pinta, asi que lo que se vigila son las reglas faciles de quitar sin darse cuenta:
 * que quede por encima de los demas velos, que respete la zona segura y que se apague con
 * movimiento reducido.
 */
const CSS = TUTORIAL.replace(/\/\*[\s\S]*?\*\//g, '');

function regla(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const cuerpo = new RegExp(String.raw`(?:^|\n)${escapado}\s*\{([^}]*)\}`).exec(CSS)?.[1];

  if (cuerpo === undefined) {
    throw new Error(`No hay una regla para ${selector}`);
  }

  return cuerpo.replace(/\s+/g, ' ').trim();
}

describe('El tutorial de Fungito', () => {
  it('queda por encima del velo del semaforo (z-index 60) y de la mascota', () => {
    const indice = Number(/z-index:\s*(\d+)/.exec(regla('.tutorial'))?.[1]);

    expect(indice).toBeGreaterThan(60);
  });

  it('respeta la zona segura en los cuatro lados', () => {
    const reglas = regla('.tutorial');

    for (const lado of ['top', 'right', 'bottom', 'left']) {
      expect(reglas).toContain(`env(safe-area-inset-${lado}`);
    }
  });

  it('con movimiento reducido no se anima', () => {
    const reducido = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1];

    expect(reducido).toContain('.tutorial__caja');
    expect(reducido).toMatch(/animation:\s*none/);
    expect(reducido).toMatch(/transform:\s*none/);
  });

  it('los colores salen de los tokens, no de valores fijos', () => {
    expect(CSS.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});
