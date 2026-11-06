import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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
  it('se coloca junto al ancla estable aunque el boton este en mitad del salto', async () => {
    const ancla = document.createElement('button');
    const envoltura = document.createElement('span');
    envoltura.className = 'arbol-sesiones__nodo';
    envoltura.append(ancla);
    document.body.append(envoltura);
    vi.spyOn(ancla, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 150, y: 182, width: 68, height: 68 }),
    );
    vi.spyOn(envoltura, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 150, y: 200, width: 68, height: 68 }),
    );
    try {
      render(
        <MemoryRouter>
          <PopoverDeActividad
            ancla={ancla}
            actividad={{ id: 'pausa', nombre: 'Pausa', hecha: false }}
            alCerrar={() => undefined}
          />
        </MemoryRouter>,
      );
      expect(await screen.findByRole('dialog')).toHaveStyle({ top: '278px' });
      // Desplazarse durante el salto tampoco debe arrastrar la tarjeta.
      window.dispatchEvent(new Event('scroll'));
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '278px' });
    } finally {
      envoltura.remove();
    }
  });

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
