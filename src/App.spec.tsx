import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { App } from './App.tsx';
import { RUTAS } from './rutas/rutas.ts';

function pintar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('muestra la portada en la raiz', () => {
    pintar(RUTAS.INICIO);

    expect(screen.getByRole('heading', { name: 'VSD Health' })).toBeInTheDocument();
  });

  it('deja el aviso clinico a la vista', () => {
    pintar(RUTAS.INICIO);

    // No es decoracion: el proyecto se compromete a que la aplicacion no
    // parezca una herramienta de diagnostico en ningun momento.
    expect(screen.getByText(/no diagnostica/i)).toBeInTheDocument();
  });

  it('devuelve a la portada cualquier direccion que no existe', () => {
    pintar('/esta-ruta-no-existe');

    expect(screen.getByRole('heading', { name: 'VSD Health' })).toBeInTheDocument();
  });
});
