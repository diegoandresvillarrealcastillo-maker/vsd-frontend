import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormaDeCasilla } from './FormaDeCasilla.tsx';
import { esUnaFormaConocida, FORMAS_DE_CASILLA } from './formasDeCasilla.ts';

/**
 * Las formas de «Recuerda los colores» (SCRUM-209): lo que distingue una casilla de otra sin
 * depender del color (R10). Son adorno para quien ve: el nombre de la casilla lo lleva el texto.
 */
describe('esUnaFormaConocida', () => {
  it('reconoce las nueve y ninguna otra', () => {
    for (const forma of FORMAS_DE_CASILLA) {
      expect(esUnaFormaConocida(forma)).toBe(true);
    }

    for (const otra of ['dodecaedro', 'Circulo', '', 'círculo', 'constructor', '__proto__']) {
      expect(esUnaFormaConocida(otra)).toBe(false);
    }
  });
});

describe('FormaDeCasilla', () => {
  it('son las nueve de las fichas', () => {
    expect([...FORMAS_DE_CASILLA].sort()).toEqual(
      [
        'circulo',
        'cuadrado',
        'estrella',
        'gota',
        'hoja',
        'luna',
        'nube',
        'rombo',
        'triangulo',
      ].sort(),
    );
  });

  it.each([...FORMAS_DE_CASILLA])('«%s» se dibuja como una figura propia', (forma) => {
    const { container } = render(<FormaDeCasilla forma={forma} />);
    const dibujo = container.querySelector('svg');

    expect(dibujo).not.toBeNull();
    expect(dibujo).toHaveAttribute('data-forma', forma);
    expect(dibujo?.querySelector('path, circle, rect, polygon')).not.toBeNull();
  });

  it('cada una es un dibujo distinto de las demas, y no solo una etiqueta distinta', () => {
    // Se compara lo que hay dentro del dibujo: la etiqueta data-forma quedaria distinta aunque el trazo fuera igual.
    const trazos = FORMAS_DE_CASILLA.map(
      (forma) => render(<FormaDeCasilla forma={forma} />).container.querySelector('svg')?.innerHTML,
    );

    expect(new Set(trazos).size).toBe(FORMAS_DE_CASILLA.length);
  });

  it.each([
    ['círculo', 'circulo'],
    ['Triángulo', 'triangulo'],
    [' ESTRELLA ', 'estrella'],
  ])('«%s» se reconoce con tilde y con mayusculas', (entra, sale) => {
    const { container } = render(<FormaDeCasilla forma={entra} />);

    expect(container.querySelector('svg')).toHaveAttribute('data-forma', sale);
  });

  it('es adorno: los lectores de pantalla no la leen, el nombre ya lo dice', () => {
    const { container } = render(<FormaDeCasilla forma="circulo" />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('el tamano por omision son 40 px, y se puede cambiar', () => {
    const normal = render(<FormaDeCasilla forma="circulo" />).container.querySelector('svg');
    const chica = render(<FormaDeCasilla forma="circulo" tamano={28} />).container.querySelector(
      'svg',
    );

    expect(normal).toHaveAttribute('width', '40');
    expect(normal).toHaveAttribute('height', '40');
    expect(chica).toHaveAttribute('width', '28');
    expect(chica).toHaveAttribute('height', '28');
  });

  it('la ficha neutra es su propio dibujo: no se confunde con ninguna de las nueve', () => {
    const neutra = render(<FormaDeCasilla forma="dodecaedro" />).container.querySelector('svg');
    const trazos = FORMAS_DE_CASILLA.map(
      (forma) => render(<FormaDeCasilla forma={forma} />).container.querySelector('svg')?.innerHTML,
    );

    expect(trazos).not.toContain(neutra?.innerHTML);
    expect(neutra?.querySelector('rect')).not.toBeNull();
  });

  it('una forma que no conoce, o ninguna, se dibuja como una ficha neutra', () => {
    const desconocida = render(<FormaDeCasilla forma="dodecaedro" />).container.querySelector(
      'svg',
    );
    const ninguna = render(<FormaDeCasilla />).container.querySelector('svg');

    expect(desconocida).toHaveAttribute('data-forma', 'ficha');
    expect(ninguna).toHaveAttribute('data-forma', 'ficha');
  });
});
