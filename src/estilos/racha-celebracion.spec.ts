import { describe, expect, it } from 'vitest';

import CELEBRACION from './racha-celebracion.css?raw';

/**
 * La celebracion de la racha, en CSS (SCRUM-243).
 *
 * jsdom no pinta ni mide, asi que se vigilan las reglas que sostienen el diseno: que cubra la pantalla
 * respetando la muesca y el teclado, que los colores vivan en los tokens, que nada se mueva con
 * `prefers-reduced-motion` y que ningun `:hover` pegue en un telefono.
 */

const CSS = CELEBRACION.replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de la primera regla con ese selector exacto. */
function regla(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\']/g, String.raw`\$&`);
  const cuerpo = new RegExp(String.raw`(?:^|[\s}])${escapado}\s*\{([^}]*)\}`).exec(CSS)?.[1];

  if (cuerpo === undefined) {
    throw new Error(`No hay una regla para ${selector}`);
  }

  return cuerpo.replace(/\s+/g, ' ').trim();
}

/** El contenido de un `@media` por su condicion. */
function media(condicion: string): string {
  const escapada = condicion.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const contenido = new RegExp(String.raw`@media ${escapada}\s*\{([\s\S]*?)\n\}`).exec(CSS)?.[1];

  if (contenido === undefined) {
    throw new Error(`No hay un @media ${condicion}`);
  }

  return contenido;
}

/** El texto de dentro de cada `@keyframes`, contando llaves para no mezclarlo con lo que sigue. */
function cuerposDeLosKeyframes(): string[] {
  const cuerpos: string[] = [];

  for (const inicio of CSS.matchAll(/@keyframes[^{]*\{/g)) {
    let profundidad = 1;
    let posicion = inicio.index + inicio[0].length;
    const desde = posicion;

    while (profundidad > 0 && posicion < CSS.length) {
      const caracter = CSS[posicion];

      if (caracter === '{') {
        profundidad += 1;
      } else if (caracter === '}') {
        profundidad -= 1;
      }

      posicion += 1;
    }

    cuerpos.push(CSS.slice(desde, posicion - 1));
  }

  return cuerpos;
}

describe('racha-celebracion.css', () => {
  describe('cubre la pantalla', () => {
    const raiz = () => regla('.racha-celebracion');

    it('es fija y ocupa todo', () => {
      expect(raiz()).toMatch(/position:\s*fixed/);
      expect(raiz()).toMatch(/inset:\s*0/);
    });

    it('respeta la muesca y la barra de abajo en un telefono', () => {
      expect(raiz()).toContain('env(safe-area-inset-top');
      expect(raiz()).toContain('env(safe-area-inset-bottom');
      expect(raiz()).toContain('env(safe-area-inset-left');
      expect(raiz()).toContain('env(safe-area-inset-right');
    });

    it('si el contenido es mas alto que la pantalla (horizontal), se desplaza sin arrastrar la pagina', () => {
      expect(raiz()).toMatch(/overflow-y:\s*auto/);
      expect(raiz()).toMatch(/overscroll-behavior:\s*contain/);
    });

    it('el contenido se centra sin cortarse por arriba cuando no cabe', () => {
      // `margin: auto` dentro de un contenedor flex centra y deja desplazar; `place-items` cortaria.
      expect(regla('.racha-celebracion__tarjeta')).toMatch(/margin:\s*auto/);
    });

    it('usa la altura dinamica del telefono, no la que cambia con la barra del navegador', () => {
      expect(CSS).toMatch(/\d+dvh/);
      expect(CSS).not.toMatch(/\d+vh(?!\w)/);
    });
  });

  it('no tiene ningun color fijo: todo sale de los tokens', () => {
    expect(CSS.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it('los unicos colores fijos son blancos y negros translucidos', () => {
    const fijos = CSS.match(/rgb\((?:\d{1,3} ){2}\d{1,3}(?: \/ [\d.]+)?\)/g) ?? [];

    for (const color of fijos) {
      expect(color, color).toMatch(/^rgb\((?:255 255 255|0 0 0) \/ 0?\.\d+\)$/);
    }
  });

  it('no usa rojo de alarma', () => {
    expect(CSS).not.toMatch(/--semaforo-urgente|#(?:f00|ff0000|e53935|d32f2f)\b/i);
  });

  it('ningun :hover afuera de un @media que lo limite al raton', () => {
    expect(CSS).not.toContain(':hover');
  });

  it('solo anima transform, opacity y lo que va por la tarjeta grafica', () => {
    // Animar `width`, `height`, `top` o `left` recalcula la pagina en cada cuadro.
    expect(CSS).not.toMatch(/transition:[^;]*\b(width|height|top|left)\b/);

    for (const cuerpo of cuerposDeLosKeyframes()) {
      expect(cuerpo).not.toMatch(/\b(width|height|top|left)\s*:/);
    }
  });

  describe('con movimiento reducido', () => {
    const reducido = media('(prefers-reduced-motion: reduce)');

    it.each([
      '.racha-celebracion',
      '.racha-celebracion__fuego',
      '.racha-celebracion__aura',
      '.racha-celebracion__rayos',
      '.racha-celebracion__cifra-nueva',
      '.racha-celebracion__voz',
      '.racha-celebracion__seguir',
    ])('%s no se anima', (selector) => {
      expect(reducido).toContain(selector);
      expect(reducido).toMatch(/animation:\s*none/);
    });

    it('el boton esta visible desde el primer momento', () => {
      expect(reducido).toMatch(/\.racha-celebracion__seguir[^}]*opacity:\s*1/);
    });

    it('va despues de las reglas que animan, para que gane a igual peso', () => {
      expect(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
        CSS.lastIndexOf('@keyframes'),
      );
    });
  });
});
