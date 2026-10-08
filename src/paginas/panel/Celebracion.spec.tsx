import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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
  it('no tiene fallos de accesibilidad', async () => {
    pintar();

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('el foco entra al boton y la ventana tiene nombre y descripcion', () => {
    const { dialogo } = pintar();

    expect(dialogo).toHaveAccessibleName('Desbloqueaste tu segundo módulo');
    expect(dialogo).toHaveAccessibleDescription(/Ahora tu plan de cada día suma un espacio más/);
    expect(screen.getByRole('button')).toHaveFocus();
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
