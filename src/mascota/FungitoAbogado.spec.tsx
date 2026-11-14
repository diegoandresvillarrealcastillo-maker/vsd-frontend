import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FungitoAbogado } from './FungitoAbogado.tsx';
import { sprite } from './sprites.ts';

/**
 * Fungito, con traje y gafas oscuras, para la pantalla de quien resulta menor de 18 años
 * (SCRUM-189).
 *
 * Es el Fungito de siempre con el traje y las gafas **encima**, como capas aparte: no hay un
 * dibujo nuevo que mantener ni que se pueda desfasar del original. Lo que se vigila es que sea
 * un solo dibujo para quien lee la pantalla (una descripción, sin que cada capa se anuncie) y que
 * no meta nada que se pueda enfocar.
 */
describe('FungitoAbogado', () => {
  it('es una sola imagen para quien lee la pantalla, y dice qué es', () => {
    render(<FungitoAbogado />);

    const imagen = screen.getByRole('img', { name: /Fungito.*traje.*gafas oscuras/i });

    expect(imagen).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('dibuja al Fungito de siempre, en su expresión normal, como base', () => {
    const { container } = render(<FungitoAbogado />);
    const base = container.querySelector('img');

    expect(base).not.toBeNull();
    expect(base).toHaveAttribute('src', sprite('fungito', 'normal'));
    // Decorativa: la descripción la lleva el contenedor.
    expect(base).toHaveAttribute('alt', '');
  });

  it('el traje y las gafas son capas decorativas y no se pueden enfocar', () => {
    const { container } = render(<FungitoAbogado />);
    const capas = container.querySelectorAll('svg');

    expect(capas.length).toBeGreaterThanOrEqual(2);

    for (const capa of capas) {
      expect(capa).toHaveAttribute('aria-hidden', 'true');
      expect(capa).toHaveAttribute('focusable', 'false');
    }

    expect(container.querySelector('a, button, input, [tabindex]')).toBeNull();
  });

  it('el traje solo se pinta donde está Fungito: usa su propio dibujo como máscara', () => {
    const { container } = render(<FungitoAbogado />);
    const raiz = container.querySelector<HTMLElement>('.fungito-abogado');

    // El sprite viaja como variable de CSS y la hoja de estilos lo usa de máscara del traje.
    expect(raiz?.style.getPropertyValue('--fungito-sprite')).toContain(sprite('fungito', 'normal'));
    expect(container.querySelector('.fungito-abogado__traje')).not.toBeNull();
  });

  it('acepta un tamaño en píxeles y lo mantiene cuadrado', () => {
    const { container } = render(<FungitoAbogado tamano={120} />);
    const raiz = container.querySelector<HTMLElement>('.fungito-abogado');

    expect(raiz?.style.width).toBe('120px');
  });
});
