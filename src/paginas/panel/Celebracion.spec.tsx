import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { Celebracion } from './Celebracion.tsx';

/**
 * El aviso al desbloquear un modulo (SCRUM-90), con lo que importa para teclado y
 * lector de pantalla (C-03 de la auditoria 360).
 */
function pintar() {
  const alCerrar = vi.fn();

  render(<Celebracion modulo="bienestar" total={2} alCerrar={alCerrar} />);

  return { alCerrar, dialogo: screen.getByRole('dialog') };
}

describe('Celebracion', () => {
  // Lo que hay detras de la ventana: sin el, Tab no tendria a donde escaparse.
  let detras: HTMLButtonElement;

  beforeEach(() => {
    detras = document.createElement('button');
    detras.textContent = 'Detrás';
    document.body.append(detras);
  });

  afterEach(() => {
    detras.remove();
  });

  it('no tiene fallos de accesibilidad', async () => {
    pintar();

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('el foco entra al boton y la ventana tiene nombre y descripcion', () => {
    const { dialogo } = pintar();

    expect(dialogo).toHaveAccessibleName('Desbloqueaste tu segundo módulo');
    expect(dialogo).toHaveAccessibleDescription(/Tu plan diario suma un espacio más/);
    expect(screen.getByRole('button', { name: /Seguir/ })).toHaveFocus();
  });

  it('Tab no saca el foco de la ventana, ni hacia delante ni hacia atras', async () => {
    pintar();

    const seguir = screen.getByRole('button', { name: /Seguir/ });

    await userEvent.tab();
    expect(seguir).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(seguir).toHaveFocus();
  });

  it('al cerrarse, el foco vuelve a donde estaba', () => {
    detras.focus();

    const { unmount } = render(<Celebracion modulo="bienestar" total={2} alCerrar={vi.fn()} />);

    expect(detras).not.toHaveFocus();

    unmount();

    expect(detras).toHaveFocus();
  });

  it('se cierra con Escape', async () => {
    const { alCerrar } = pintar();

    await userEvent.keyboard('{Escape}');

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('se cierra al pulsar el fondo, y no al pulsar dentro', async () => {
    const { alCerrar, dialogo } = pintar();

    await userEvent.click(dialogo);
    expect(alCerrar).not.toHaveBeenCalled();

    const fondo = dialogo.parentElement;

    expect(fondo).toHaveAttribute('role', 'presentation');
    await userEvent.click(fondo!);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});
