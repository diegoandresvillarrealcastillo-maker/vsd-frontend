import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DibujoDeLaLlama } from './DibujoDeLaLlama.tsx';

/**
 * El dibujo de la llama (SCRUM-186), que ahora usan la barra de arriba, el panel y la celebracion
 * (SCRUM-243). Es decorativo: lo que se anuncia lo dice quien lo usa.
 */
describe('DibujoDeLaLlama', () => {
  it('es decorativo', () => {
    const { container } = render(<DibujoDeLaLlama nivel={1} enDescanso={false} />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('con el tamano de siempre mide 26 de ancho', () => {
    const { container } = render(<DibujoDeLaLlama nivel={1} enDescanso={false} />);

    expect(container.querySelector('svg')).toHaveAttribute('width', '26');
  });

  it('se puede pedir mas grande y conserva la proporcion', () => {
    const { container } = render(<DibujoDeLaLlama nivel={1} enDescanso={false} tamano={120} />);

    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', String(Math.round((120 * 26) / 24)));
  });

  it('tiene un degradado de tres paradas; en descanso no se rellena', () => {
    const { container, rerender } = render(<DibujoDeLaLlama nivel={3} enDescanso={false} />);

    expect(container.querySelectorAll('linearGradient stop')).toHaveLength(3);
    expect(container.querySelector('.llama__cuerpo')?.getAttribute('fill')).toMatch(/^url\(#/);

    rerender(<DibujoDeLaLlama nivel={3} enDescanso />);

    expect(container.querySelector('.llama__cuerpo')?.getAttribute('fill')).toBe('none');
    expect(container.querySelector('.llama__corazon')).toBeNull();
  });

  it('las chispas aparecen desde el nivel 3 y la estrella en el 4', () => {
    const nivel2 = render(<DibujoDeLaLlama nivel={2} enDescanso={false} />);

    expect(nivel2.container.querySelectorAll('.llama__chispa')).toHaveLength(0);
    nivel2.unmount();

    const nivel3 = render(<DibujoDeLaLlama nivel={3} enDescanso={false} />);

    expect(nivel3.container.querySelectorAll('.llama__chispa')).toHaveLength(2);
    expect(nivel3.container.querySelector('.llama__estrella')).toBeNull();
    nivel3.unmount();

    const nivel4 = render(<DibujoDeLaLlama nivel={4} enDescanso={false} />);

    expect(nivel4.container.querySelector('.llama__estrella')).not.toBeNull();
  });

  it('dos llamas en la misma pantalla no comparten el identificador del degradado', () => {
    const { container } = render(
      <>
        <DibujoDeLaLlama nivel={1} enDescanso={false} />
        <DibujoDeLaLlama nivel={1} enDescanso={false} />
      </>,
    );

    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);

    expect(new Set(ids).size).toBe(2);
  });
});
