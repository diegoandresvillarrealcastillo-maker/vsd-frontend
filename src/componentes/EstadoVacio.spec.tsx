import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EstadoVacio } from './EstadoVacio.tsx';

describe('EstadoVacio (SCRUM-180)', () => {
  it('dice que no hay nada y que pasara cuando lo haya', () => {
    render(<EstadoVacio titulo="Todavía no hay nada" texto="Lo que escribas aparece aquí." />);

    expect(screen.getByText('Todavía no hay nada')).toBeInTheDocument();
    expect(screen.getByText('Lo que escribas aparece aquí.')).toBeInTheDocument();
  });

  it('el texto de apoyo es opcional', () => {
    const { container } = render(<EstadoVacio titulo="Sin nada por ahora" />);

    expect(container.querySelector('.estado-vacio__texto')).toBeNull();
  });

  it('puede llevar una accion, y es alcanzable', () => {
    render(
      <EstadoVacio titulo="Sin módulos">
        <a href="/panel">Añadir uno</a>
      </EstadoVacio>,
    );

    expect(screen.getByRole('link', { name: 'Añadir uno' })).toHaveAttribute('href', '/panel');
  });

  it('el icono es decorativo', () => {
    const { container } = render(
      <EstadoVacio titulo="Vacío" icono={<svg data-testid="icono" />} />,
    );

    expect(container.querySelector('.estado-vacio__icono')).toHaveAttribute('aria-hidden', 'true');
  });

  it('no es un aviso que interrumpa: no usa roles de alerta', () => {
    render(<EstadoVacio titulo="Vacío" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
