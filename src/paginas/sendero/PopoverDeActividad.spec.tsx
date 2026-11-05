import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PopoverDeActividad } from './PopoverDeActividad.tsx';

function Ejemplo() {
  const [ancla, setAncla] = useState<HTMLButtonElement | null>(null);
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="app">
      <button ref={setAncla} type="button" onClick={() => setAbierto(true)}>
        Actividad
      </button>
      {abierto && ancla !== null && (
        <PopoverDeActividad
          ancla={ancla}
          actividad={{ id: 'actividad-58', nombre: 'Pausa consciente', hecha: false }}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}

describe('PopoverDeActividad', () => {
  it('ofrece la actividad real junto al nodo y se cierra con Escape', async () => {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <Ejemplo />
      </MemoryRouter>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Actividad' }));

    const ficha = screen.getByRole('dialog', { name: 'Actividad: Pausa consciente' });
    expect(ficha).toHaveTextContent('Empieza cuando quieras');
    expect(screen.getByRole('link', { name: 'Comenzar Pausa consciente' })).toHaveAttribute(
      'href',
      '/actividad/actividad-58',
    );

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actividad' })).toHaveFocus();
  });
});
