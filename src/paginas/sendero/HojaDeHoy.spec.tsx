import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActividadDeHoy } from '../../infraestructura/api/progreso.ts';
import { HojaDeHoy } from './HojaDeHoy.tsx';

/**
 * La hoja de lo que toca hoy en un modulo: un dialogo que se maneja entero con teclado. El foco
 * entra, no se sale con Tab, Escape la cierra y el foco vuelve a donde estaba.
 */
const HECHA: ActividadDeHoy = { id: 'respirar', nombre: 'Respirar', hecha: true };
const POR_HACER: ActividadDeHoy = { id: 'caminar', nombre: 'Caminar', hecha: false };

function pintar() {
  const alCerrar = vi.fn();
  const vista = render(
    <MemoryRouter>
      <HojaDeHoy modulo="Bienestar" hoy={[HECHA, POR_HACER]} alCerrar={alCerrar} />
    </MemoryRouter>,
  );

  return { alCerrar, ...vista };
}

describe('HojaDeHoy', () => {
  // El punto del sendero que abrio la hoja, detras de ella: sin el, Tab no tendria a donde escaparse.
  let detras: HTMLButtonElement;

  beforeEach(() => {
    detras = document.createElement('button');
    detras.textContent = 'Punto de hoy';
    document.body.append(detras);
  });

  afterEach(() => {
    detras.remove();
  });

  it('es un dialogo con nombre, y el foco entra al boton de cerrar', () => {
    pintar();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Lo de hoy');
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('se cierra con Escape y con el boton, y no al pulsar dentro', async () => {
    const { alCerrar } = pintar();

    await userEvent.click(screen.getByRole('dialog'));
    expect(alCerrar).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(alCerrar).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(alCerrar).toHaveBeenCalledTimes(2);
  });

  it('se cierra al pulsar el fondo', async () => {
    const { alCerrar } = pintar();

    await userEvent.click(screen.getByRole('dialog').parentElement!);

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('Tab da la vuelta dentro de la hoja, hacia delante y hacia atras', async () => {
    pintar();

    const primero = screen.getAllByRole('link')[0];
    const cerrar = screen.getByRole('button', { name: 'Cerrar' });

    // Desde el ultimo (el foco entra ahi) vuelve al primero.
    await userEvent.tab();
    expect(primero).toHaveFocus();

    // Desde el primero, hacia atras, vuelve al ultimo.
    await userEvent.tab({ shift: true });
    expect(cerrar).toHaveFocus();
  });

  it('al cerrarse, el foco vuelve a donde estaba', () => {
    detras.focus();

    const { unmount } = pintar();

    expect(detras).not.toHaveFocus();

    unmount();

    expect(detras).toHaveFocus();
  });
});
