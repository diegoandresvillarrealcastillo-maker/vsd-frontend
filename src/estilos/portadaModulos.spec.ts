import { describe, expect, it } from 'vitest';

import PORTADA from './portada.css?raw';

/**
 * Las tarjetas de modulo de la portada (SCRUM-313).
 *
 * jsdom no pinta ni dispara `:hover`, asi que se vigila lo que si se puede leer: que cada modulo tenga
 * su color (el mismo verde, azul y coral que ya significan Bienestar, Cognicion y Emociones en la
 * cuenta), que el efecto de pasar el cursor este escrito en la regla de la tarjeta activa y que no
 * quede nada de las tarjetas de metricas que se quitaron.
 */

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Prettier parte las listas largas en varias lineas: se juntan para poder leerlas con una expresion. */
function plano(texto: string): string {
  return texto.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ ,/g, ',');
}

const HOJA = plano(sinComentarios(PORTADA));

/** El cuerpo de la primera regla cuyo selector es exactamente este. */
function regla(selector: string): string {
  const hallada = [...HOJA.matchAll(/(?<=^|\})\s*([^{}@]+)\{([^{}]*)\}/g)].find(
    ([, selectores]) => selectores!.trim() === selector,
  );

  if (hallada === undefined) {
    throw new Error(`No hay una regla ${selector}`);
  }

  return hallada[2]!;
}

describe('cada modulo de la portada lleva su color', () => {
  it.each([
    ['bienestar', '--vital'],
    ['cognicion', '--dato'],
    ['emociones', '--pulso'],
  ])('«%s» usa %s, el color que ya tiene en la cuenta', (modulo, color) => {
    expect(regla(`.modulo-portada--${modulo}`)).toContain(`--modulo: var(${color})`);
  });

  it('la tarjeta tiene el borde superior del color del modulo y mantiene el fondo de las demas', () => {
    const tarjeta = regla('.modulo-portada');

    expect(tarjeta).toContain('border-top: 4px solid var(--modulo)');
    // El fondo no se tine: asi el texto conserva el contraste que ya tenian las tarjetas.
    expect(tarjeta).toContain('background: var(--fondo-elevado)');
  });

  it('el icono va en una pastilla teñida con el color del modulo', () => {
    const icono = regla('.modulo-portada__icono');

    expect(icono).toContain('color: var(--modulo)');
    expect(icono).toMatch(
      /background: color-mix\(in srgb, var\(--modulo\) \d+%, var\(--fondo-elevado\)\)/,
    );
  });

  it('al pasar el cursor, la tarjeta toma el borde del modulo', () => {
    expect(regla('.modulo-portada--activa')).toContain('border-color: var(--modulo)');
  });
});

describe('no quedan estilos de las tarjetas de metricas', () => {
  it.each(['.metrica', '.metricas', '.sueno', '.sueno__barra'])('no hay %s', (selector) => {
    expect(HOJA).not.toMatch(new RegExp(`${selector.replace('.', '\\.')}[\\s{,:_-]`));
  });
});
