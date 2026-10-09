import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LogroDeLaActividad } from './LogroDeLaActividad.tsx';

describe('LogroDeLaActividad', () => {
  it('celebrando, dice que lo hizo y suelta confeti', () => {
    const { container } = render(<LogroDeLaActividad celebrar />);

    expect(screen.getByText('¡Lo hiciste!')).toBeInTheDocument();
    expect(container.querySelector('.confeti')).not.toBeNull();
    expect(container.querySelector('.actividad__insignia--serena')).toBeNull();
  });

  it('sin celebrar, acompana: otro texto, insignia serena y nada de confeti', () => {
    const { container } = render(<LogroDeLaActividad celebrar={false} />);

    expect(screen.getByText('Gracias por tomarte este momento.')).toBeInTheDocument();
    expect(container.querySelector('.confeti')).toBeNull();
    expect(container.querySelector('.actividad__insignia--serena')).not.toBeNull();
  });

  it('la insignia es decorativa: lo importante lo dice el texto', () => {
    const { container } = render(<LogroDeLaActividad celebrar />);

    expect(container.querySelector('.actividad__insignia')).toHaveAttribute('aria-hidden', 'true');
  });
});
