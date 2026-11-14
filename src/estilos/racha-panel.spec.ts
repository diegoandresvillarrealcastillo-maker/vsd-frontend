import { describe, expect, it } from 'vitest';

import PANEL from './racha-panel.css?raw';

/**
 * El panel de la racha, en CSS (SCRUM-243).
 *
 * jsdom no pinta ni mide, asi que se vigilan las reglas que sostienen el diseno y que son faciles de
 * quitar sin darse cuenta: que los colores vivan en los tokens (claro y oscuro los comparten), que
 * nada se mueva con `prefers-reduced-motion` y que ningun `:hover` pegue en un telefono.
 */

const CSS = PANEL.replace(/\/\*[\s\S]*?\*\//g, '');

/** El contenido de un `@media` por su condicion. */
function media(condicion: string): string {
  const escapada = condicion.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const contenido = new RegExp(String.raw`@media ${escapada}\s*\{([\s\S]*?)\n\}`).exec(CSS)?.[1];

  if (contenido === undefined) {
    throw new Error(`No hay un @media ${condicion}`);
  }

  return contenido;
}

describe('racha-panel.css', () => {
  it('no tiene ningun color fijo: todo sale de los tokens', () => {
    expect(CSS.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it('el unico blanco fijo es el del destello, y es translucido', () => {
    const fijos = CSS.match(/rgb\((?:255 255 255|0 0 0)[^)]*\)/gi) ?? [];

    expect(fijos).toEqual(['rgb(255 255 255 / 0.35)']);
  });

  it('no usa rojo de alarma: lo que no se hizo solo se apaga', () => {
    expect(CSS).not.toMatch(/--semaforo-urgente|#(?:f00|ff0000|e53935|d32f2f)\b/i);
  });

  it('ningun :hover afuera de un @media que lo limite al raton', () => {
    expect(CSS).not.toContain(':hover');
  });

  it('la barra se anima con transform, no con width', () => {
    expect(CSS).toMatch(/\.racha-progreso__relleno[^}]*transform-origin:\s*left/);
    expect(CSS).not.toMatch(/animation:[^;]*racha-progreso-ancho/);
    expect(CSS).not.toMatch(/transition:[^;]*\bwidth\b/);
  });

  it('las secciones del panel entran una tras otra, solo con opacidad y desplazamiento', () => {
    const entrada = /@keyframes racha-panel-sube\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';

    expect(CSS).toMatch(/\.llama__panel\.racha-panel > \*\s*\{[^}]*animation:\s*racha-panel-sube/);
    expect(entrada).toContain('opacity');
    expect(entrada).toContain('translate');
    // Nada que obligue al navegador a recalcular la caja mientras entran.
    expect(entrada).not.toMatch(/\b(?:height|width|margin|top|left)\b/);
  });

  describe('con movimiento reducido', () => {
    const reducido = media('(prefers-reduced-motion: reduce)');

    it.each([
      '.racha-semana__dia',
      '.racha-semana__visto',
      '.racha-semana__dia--hoy .racha-semana__marca',
      '.racha-semana__dia--une::after',
      '.racha-progreso__relleno',
      '.llama__panel.racha-panel > *',
      '.racha-escalera__hito--siguiente .racha-escalera__marca',
    ])('%s no se anima', (selector) => {
      expect(reducido).toContain(selector);
      expect(reducido).toMatch(/animation:\s*none/);
    });

    it('el destello de la barra desaparece', () => {
      expect(reducido).toMatch(/\.racha-progreso__relleno::after\s*\{\s*display:\s*none/);
    });

    it('va despues de las reglas que animan, para que gane a igual peso', () => {
      expect(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
        CSS.indexOf('@keyframes racha-progreso-destello'),
      );
    });
  });
});
