import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Confeti } from './Confeti.tsx';

describe('Confeti', () => {
  it('pinta unas treinta piezas, todas decorativas y sin recibir clics', () => {
    const { container } = render(<Confeti />);
    const raiz = container.querySelector('.confeti');

    expect(raiz).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.confeti__pieza')).toHaveLength(30);
  });

  it('pintar dos veces da las mismas piezas: no depende del azar', () => {
    const una = render(<Confeti />).container.innerHTML;
    const otra = render(<Confeti />).container.innerHTML;

    expect(otra).toBe(una);
  });

  it('las piezas usan los colores de la aplicacion, no colores sueltos', () => {
    const { container } = render(<Confeti />);
    const colores = [...container.querySelectorAll<HTMLElement>('.confeti__pieza')].map(
      (pieza) => pieza.style.background,
    );

    expect(colores.every((color) => color.startsWith('var(--app-'))).toBe(true);
  });
});
