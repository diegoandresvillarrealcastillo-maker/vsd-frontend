import { describe, expect, it } from 'vitest';

import BOTONES from './botones.css?raw';

/**
 * Los botones tienen presencia (SCRUM-309).
 *
 * jsdom no pinta ni dispara `:hover`, asi que se vigila lo que si se puede leer: que el efecto de
 * pasar y pulsar este escrito, que con «reducir movimiento» no haya escala, y que cada clase que
 * la hoja nombra siga existiendo en otra (si alguien renombra un boton, aqui salta antes de que
 * se quede sin su efecto sin que nadie lo note).
 */

const OTRAS_HOJAS = import.meta.glob<string>('./*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

const HOJA = sinComentarios(BOTONES);

/** El texto de un `@media` por su condicion, con las llaves de sus reglas. */
function medio(condicion: string): string {
  const inicio = HOJA.indexOf(`@media ${condicion}`);

  if (inicio === -1) {
    throw new Error(`No hay un @media ${condicion}`);
  }

  let profundidad = 0;

  for (let i = HOJA.indexOf('{', inicio); i < HOJA.length; i++) {
    profundidad += HOJA[i] === '{' ? 1 : HOJA[i] === '}' ? -1 : 0;

    if (profundidad === 0) {
      return HOJA.slice(inicio, i + 1);
    }
  }

  throw new Error(`El @media ${condicion} no cierra`);
}

describe('botones con presencia', () => {
  it('al pasar el cursor crecen un 5 % y brillan, solo donde hay cursor de verdad', () => {
    const conCursor = medio('(hover: hover) and (pointer: fine)');

    expect(conCursor).toContain('scale(1.05)');
    expect(conCursor).toMatch(/box-shadow:/);
  });

  it('al pulsar se hunden un 5 %', () => {
    expect(HOJA).toMatch(/:active[^{]*\{[^}]*scale\(0\.95\)/);
  });

  it('con «reducir movimiento» no hay escala, solo cambia el color', () => {
    const sinMovimiento = medio('(prefers-reduced-motion: reduce)');

    expect(sinMovimiento).toMatch(/transform:\s*none/);
    expect(sinMovimiento).not.toContain('scale(');
    expect(sinMovimiento).toMatch(/transition-property:\s*box-shadow, background, border-color;/);
    // Y el `:hover` sin escala tambien se queda dentro de «hay cursor», como el que la pone.
    expect(HOJA).toMatch(
      /@media \(prefers-reduced-motion: reduce\) and \(hover: hover\)[^{]*\{[^@]*:hover:not\(:disabled\) \{\s*transform:\s*none/,
    );
  });

  it('lo deshabilitado no reacciona', () => {
    expect(HOJA).toContain(':not(:disabled)');
  });

  it('los secundarios descansan con el borde teñido de la marca, y los que ya tienen el suyo no se tocan', () => {
    const reposo = [...HOJA.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].find(([, , cuerpo]) =>
      /^\s*border-color:\s*color-mix\(/.test(cuerpo!),
    );

    expect(reposo, 'falta la regla del borde en reposo').toBeDefined();
    expect(reposo![1]).toContain('.perfil__secundario');
    expect(reposo![1]).toContain(':not(:disabled)');
    expect(reposo![1]).not.toMatch(/lienzo__boton|tutorial__|perfil__peligro/);
  });

  it('el efecto se escribe una sola vez y llega a los dos temas con los tokens, sin colores propios', () => {
    expect(HOJA).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  const CLASES = [...new Set([...HOJA.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]!))];

  it('nombra al menos los botones principales y los secundarios', () => {
    expect(CLASES).toEqual(expect.arrayContaining(['app__boton', 'perfil__secundario']));
  });

  it.each(CLASES)('la clase .%s existe en otra hoja', (clase) => {
    const existe = Object.entries(OTRAS_HOJAS).some(
      ([ruta, hoja]) =>
        !ruta.endsWith('botones.css') && new RegExp(String.raw`\.${clase}(?![\w-])`).test(hoja),
    );

    expect(existe, `.${clase} no esta en ninguna otra hoja`).toBe(true);
  });
});
