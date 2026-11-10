import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArbolDeSesiones } from './ArbolDeSesiones.tsx';
import { ordenarActividadesParaPersona } from './ordenPersonalDeSesiones.ts';

const { consultar, consultarHechas } = vi.hoisted(() => ({
  consultar: vi.fn(),
  consultarHechas: vi.fn(),
}));
const movimiento = vi.hoisted(() => ({ reducido: false }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => movimiento.reducido }));
vi.mock('../../infraestructura/api/sesionesPublicadas.ts', () => ({
  consultarSesionesPublicadas: consultar,
  consultarSesionesHechas: consultarHechas,
}));

beforeEach(() => {
  movimiento.reducido = false;
  consultar.mockReset();
  consultarHechas.mockReset();
  consultarHechas.mockResolvedValue([]);
});

describe('ArbolDeSesiones', () => {
  it('reinicia el salto al volver a pulsar sin cancelar otras animaciones del nodo', async () => {
    consultar.mockResolvedValue([
      { id: 'sesion-1', idActividad: 'actividad-1', titulo: 'Pausa', actividad: 'Pausa', nivel: 1 },
    ]);
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <div className="app">
          <ArbolDeSesiones modulo="bienestar" />
        </div>
      </MemoryRouter>,
    );
    const nodo = await screen.findByRole('button', { name: /Actividad 1:/ });
    const salto = { id: '', cancel: vi.fn() };
    const pulso = { id: 'pulso-de-hoy', cancel: vi.fn() };
    const animar = vi.fn(() => salto);
    Object.defineProperty(nodo, 'animate', { value: animar });
    Object.defineProperty(nodo, 'getAnimations', { value: () => [salto, pulso] });
    await usuario.click(nodo);
    await usuario.click(nodo);
    expect(animar).toHaveBeenCalledTimes(2);
    expect(salto.cancel).toHaveBeenCalledOnce();
    expect(pulso.cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Comenzar Pausa' })).toHaveFocus();
  });

  it('con movimiento reducido abre sin saltar y vuelve al dia sin desplazamiento animado', async () => {
    movimiento.reducido = true;
    consultar.mockResolvedValue([
      { id: 'sesion-1', idActividad: 'actividad-1', titulo: 'Pausa', actividad: 'Pausa', nivel: 1 },
    ]);
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <div className="app">
          <ArbolDeSesiones modulo="bienestar" />
        </div>
      </MemoryRouter>,
    );
    const nodo = await screen.findByRole('button', { name: /Actividad 1:/ });
    const animar = vi.fn();
    Object.defineProperty(nodo, 'animate', { value: animar });
    const desplazar = vi.fn();
    Object.defineProperty(nodo, 'scrollIntoView', { value: desplazar });
    await usuario.click(nodo);
    expect(animar).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Comenzar Pausa' })).toBeVisible();
    await usuario.keyboard('{Escape}');
    await usuario.click(screen.getByRole('button', { name: 'Ir a mi día' }));
    expect(desplazar).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
    expect(nodo).toHaveFocus();
  });

  it('conserva todo el catálogo y deja pendiente la actividad que todavía no toca', async () => {
    consultar.mockResolvedValue(
      Array.from({ length: 58 }, (_, indice) => ({
        id: `sesion-${indice + 1}`,
        idActividad: `actividad-${indice + 1}`,
        titulo: `Pausa ${indice + 1}`,
        actividad: `Pausa ${indice + 1}`,
        nivel: 1,
      })),
    );
    render(
      <MemoryRouter>
        <div className="app">
          <ArbolDeSesiones modulo="bienestar" />
        </div>
      </MemoryRouter>,
    );

    const arbol = await screen.findByRole('region', { name: 'Actividades de bienestar' });
    expect(within(arbol).getAllByRole('button')).toHaveLength(58);
    expect(within(arbol).getByRole('button', { name: /Pausa 58, pendiente/ })).toBeDisabled();
    expect(within(arbol).getByRole('button', { name: /sugerida para hoy/ })).toBeEnabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(consultar).toHaveBeenCalledWith('bienestar', expect.any(AbortSignal));
  });

  it('marca solo las actividades hechas y lleva a la primera pendiente después de dos completadas', async () => {
    const sesiones = [1, 2, 3].map((numero) => ({
      id: `sesion-${numero}`,
      idActividad: `actividad-${numero}`,
      titulo: `Pausa ${numero}`,
      actividad: `Pausa ${numero}`,
      nivel: 1,
    }));
    const personaId = 'persona-que-avanza';
    const grupos = ordenarActividadesParaPersona(sesiones, personaId, 'bienestar');
    const hechas = grupos.slice(0, 2).map(({ sesion }) => sesion.id);
    consultar.mockResolvedValue(sesiones);
    consultarHechas.mockResolvedValue(hechas);
    render(
      <MemoryRouter>
        <ArbolDeSesiones modulo="bienestar" personaId={personaId} />
      </MemoryRouter>,
    );

    const arbol = await screen.findByRole('region', { name: 'Actividades de bienestar' });
    const completadas = within(arbol).getAllByRole('button', { name: /completada/ });
    const actividadActiva = within(arbol).getByRole('button', { name: /sugerida para hoy/ });

    expect(completadas).toHaveLength(2);
    for (const actividad of completadas) {
      expect(actividad).toHaveClass('arbol-sesiones__punto--hecho');
      expect(actividad).toBeEnabled();
    }
    expect(actividadActiva).toHaveAttribute('data-dia-activo', 'true');
    expect(actividadActiva).toHaveClass('arbol-sesiones__punto--hoy');
    expect(actividadActiva).not.toHaveClass('arbol-sesiones__punto--hecho');
    expect(actividadActiva).toBeEnabled();
    expect(within(arbol).getAllByRole('button')).toHaveLength(3);
    const desplazar = vi.fn();
    Object.defineProperty(actividadActiva, 'scrollIntoView', { value: desplazar });
    await userEvent.click(screen.getByRole('button', { name: 'Ir a mi día' }));
    expect(desplazar).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(actividadActiva).toHaveFocus();
  });

  it('renderiza las 365 actividades recibidas sin recortar la lista', async () => {
    consultar.mockResolvedValue(
      Array.from({ length: 365 }, (_, indice) => ({
        id: `sesion-${indice + 1}`,
        idActividad: `actividad-${indice + 1}`,
        titulo: `Actividad ${indice + 1}`,
        actividad: `Actividad ${indice + 1}`,
        nivel: 1,
      })),
    );
    render(
      <MemoryRouter>
        <ArbolDeSesiones modulo="emociones" personaId="cuenta-365" />
      </MemoryRouter>,
    );

    const arbol = await screen.findByRole('region', { name: 'Actividades de emociones' });
    expect(within(arbol).getAllByRole('listitem')).toHaveLength(365);
    expect(within(arbol).getAllByRole('button')).toHaveLength(365);
    expect(within(arbol).getAllByRole('button')[364]).toBeDisabled();
  });

  it('permite reintentar si falla la consulta sin mostrar sesiones incompletas', async () => {
    consultar.mockRejectedValueOnce(new Error('Red no disponible')).mockResolvedValueOnce([
      {
        id: 'sesion-1',
        idActividad: 'actividad-1',
        titulo: 'Pausa 1',
        actividad: 'Pausa 1',
        nivel: 1,
      },
    ]);
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <ArbolDeSesiones modulo="bienestar" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    expect(
      screen.queryByRole('region', { name: 'Actividades de bienestar' }),
    ).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: /Pausa 1/ })).toBeEnabled();
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('abre con teclado y devuelve el foco al nodo al cerrar sin perder su estado', async () => {
    consultar.mockResolvedValue([
      { id: 'sesion-1', idActividad: 'actividad-1', titulo: 'Pausa', actividad: 'Pausa', nivel: 1 },
    ]);
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <div className="app">
          <ArbolDeSesiones modulo="bienestar" />
        </div>
      </MemoryRouter>,
    );
    const nodo = await screen.findByRole('button', { name: /Actividad 1:/ });
    nodo.focus();
    await usuario.keyboard('{Enter}');
    expect(nodo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Comenzar Pausa' })).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(nodo).toHaveFocus();
    expect(nodo).toHaveAttribute('aria-expanded', 'false');
    expect(nodo).toHaveAttribute('data-dia-activo', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
