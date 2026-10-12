import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { LogroDeLaActividad } from './LogroDeLaActividad.tsx';

describe('LogroDeLaActividad', () => {
  it('celebrando, dice que lo hizo y suelta confeti', () => {
    const { container } = render(<LogroDeLaActividad celebrar />);

    expect(screen.getByText('¡Lo hiciste!')).toBeInTheDocument();
    expect(container.querySelector('.confeti')).not.toBeNull();
    expect(container.querySelector('.viva-logro--serena')).toBeNull();
  });

  it('sin celebrar, acompana: otro texto, tarjeta serena y nada de confeti', () => {
    const { container } = render(<LogroDeLaActividad celebrar={false} />);

    expect(screen.getByText('Gracias por tomarte este momento.')).toBeInTheDocument();
    expect(container.querySelector('.confeti')).toBeNull();
    expect(container.querySelector('.viva-logro--serena')).not.toBeNull();
  });

  it('la insignia y la mascota son decorativas: lo importante lo dice el texto', () => {
    const { container } = render(<LogroDeLaActividad celebrar />);

    expect(container.querySelector('.viva-logro__insignia')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.viva-logro__mascota')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lleva el encabezado de primer nivel de la pantalla', () => {
    render(<LogroDeLaActividad celebrar />);

    expect(screen.getByRole('heading', { level: 1, name: 'Listo' })).toBeInTheDocument();
  });

  it('al celebrar enumera lo que se lleva; al acompanar, no', () => {
    const { rerender } = render(<LogroDeLaActividad celebrar />);

    expect(screen.getAllByRole('listitem').map((uno) => uno.textContent)).toEqual([
      'Actividad completada',
      'Un momento para ti',
    ]);

    rerender(<LogroDeLaActividad celebrar={false} />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('no tiene fallos de accesibilidad, celebrando ni acompanando', async () => {
    const { container, rerender } = render(<LogroDeLaActividad celebrar />);

    expect(await fallosDeAccesibilidad(container)).toEqual([]);

    rerender(<LogroDeLaActividad celebrar={false} />);

    expect(await fallosDeAccesibilidad(container)).toEqual([]);
  });
});
