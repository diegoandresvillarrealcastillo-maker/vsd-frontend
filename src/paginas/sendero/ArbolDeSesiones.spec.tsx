import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArbolDeSesiones } from './ArbolDeSesiones.tsx';

const { consultar, consultarHechas } = vi.hoisted(() => ({
  consultar: vi.fn(),
  consultarHechas: vi.fn(),
}));
vi.mock('../../infraestructura/api/sesionesPublicadas.ts', () => ({
  consultarSesionesPublicadas: consultar,
  consultarSesionesHechas: consultarHechas,
}));

beforeEach(() => {
  consultar.mockReset();
  consultarHechas.mockReset();
  consultarHechas.mockResolvedValue([]);
});

describe('ArbolDeSesiones', () => {
  it('permite abrir la sesion 58 sin pasar por las anteriores', async () => {
    consultar.mockResolvedValue(
      Array.from({ length: 58 }, (_, indice) => ({
        id: `sesion-${indice + 1}`,
        idActividad: `actividad-${indice + 1}`,
        titulo: `Pausa ${indice + 1}`,
        actividad: 'Pausa',
        nivel: 1,
      })),
    );
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <div className="app">
          <ArbolDeSesiones modulo="bienestar" />
        </div>
      </MemoryRouter>,
    );

    const arbol = await screen.findByRole('region', { name: 'Actividades de bienestar' });
    expect(within(arbol).getAllByRole('button')).toHaveLength(58);
    await usuario.click(within(arbol).getByRole('button', { name: 'Actividad 58: Pausa 58' }));

    expect(screen.getByRole('link', { name: 'Comenzar Pausa 58' })).toHaveAttribute(
      'href',
      '/actividad/actividad-58?sesion=sesion-58',
    );
    expect(consultar).toHaveBeenCalledWith('bienestar', expect.any(AbortSignal));
  });

  it('avanza el foco al día siguiente y distingue una sesión terminada sin bloquear las demás', async () => {
    consultar.mockResolvedValue(
      [1, 2, 3].map((numero) => ({
        id: `sesion-${numero}`,
        idActividad: `actividad-${numero}`,
        titulo: `Pausa ${numero}`,
        actividad: 'Pausa',
        nivel: 1,
      })),
    );
    consultarHechas.mockResolvedValue(['sesion-1']);
    render(
      <MemoryRouter>
        <ArbolDeSesiones modulo="bienestar" diasHechos={1} />
      </MemoryRouter>,
    );
    const primera = await screen.findByRole('button', { name: 'Actividad 1: Pausa 1, completada' });
    const segunda = screen.getByRole('button', { name: 'Actividad 2: Pausa 2, sugerida para hoy' });
    expect(primera).toHaveClass('arbol-sesiones__punto--hecho');
    expect(segunda).toHaveAttribute('data-dia-activo', 'true');
    expect(screen.getByRole('button', { name: 'Actividad 3: Pausa 3' })).toBeEnabled();
  });
});
