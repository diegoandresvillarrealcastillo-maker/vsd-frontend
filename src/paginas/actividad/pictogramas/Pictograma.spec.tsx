import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DIBUJOS } from './dibujos.tsx';
import { existeElPictograma } from './existeElPictograma.ts';
import { Pictograma } from './Pictograma.tsx';
import catalogo from './pictogramasDelCatalogo.json';

/**
 * La biblioteca de pictogramas (SCRUM-225): 60 figuras con nombre, dibujadas en codigo.
 *
 * `pictogramasDelCatalogo.json` es una copia de la lista que el backend siembra en las sesiones
 * (`src/pruebas/catalogo/pictogramas.ts`): si una sesion nombra una figura que aqui no existe, se pinta como una
 * ficha neutra y el juego se juega por el nombre, pero mejor que no pase. Esta prueba comprueba que cada clave
 * de la lista tiene su dibujo, y que no sobra ninguno.
 */
describe('la biblioteca de pictogramas', () => {
  const claves = catalogo.objetos.map((una) => una.clave);

  it('son 60, sin repetir, con su nombre escrito', () => {
    expect(claves).toHaveLength(60);
    expect(new Set(claves).size).toBe(60);
    expect(catalogo.objetos.every((una) => una.nombre.trim() !== '')).toBe(true);
    expect(new Set(catalogo.objetos.map((una) => una.nombre)).size).toBe(60);
  });

  it('cada clave de la lista tiene su dibujo, y no sobra ninguno', () => {
    expect(Object.keys(DIBUJOS).sort()).toEqual([...claves].sort());
  });

  it.each(claves)('«%s» se dibuja como una figura propia', (clave) => {
    const { container } = render(<Pictograma clave={clave} />);
    const dibujo = container.querySelector('svg');

    expect(dibujo).toHaveAttribute('data-forma', clave);
    expect(dibujo?.querySelector('path, circle, rect, polygon, ellipse')).not.toBeNull();
  });

  it('cada una es un dibujo distinto de las demas', () => {
    const trazos = claves.map(
      (clave) => render(<Pictograma clave={clave} />).container.querySelector('svg')?.innerHTML,
    );

    expect(new Set(trazos).size).toBe(60);
  });

  it('es adorno: los lectores de pantalla no la leen, el nombre ya lo dice', () => {
    const { container } = render(<Pictograma clave="manzana" />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([undefined, '', 'dodecaedro', 'constructor', '__proto__'])(
    'una clave que no conoce («%s») se pinta como una ficha neutra y no rompe',
    (clave) => {
      const { container } = render(<Pictograma clave={clave} />);

      expect(container.querySelector('svg')).toHaveAttribute('data-forma', 'ficha');
    },
  );

  it('reconoce la clave con tilde y con mayusculas', () => {
    expect(existeElPictograma('Árbol')).toBe(true);
    expect(existeElPictograma(' MANZANA ')).toBe(true);
    expect(existeElPictograma('toString')).toBe(false);
  });
});

describe('las figuras de estiramiento', () => {
  it('la lista que viene del backend son 48 claves `zona:gesto`, sin repetir', () => {
    expect(catalogo.figuras).toHaveLength(48);
    expect(new Set(catalogo.figuras).size).toBe(48);
    expect(catalogo.figuras.every((una) => /^[a-z]+:[a-z-]+$/.test(una))).toBe(true);
  });
});
