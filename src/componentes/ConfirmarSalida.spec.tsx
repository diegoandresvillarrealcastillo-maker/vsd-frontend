import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmarSalida } from './ConfirmarSalida.tsx';

afterEach(() => {
  vi.restoreAllMocks();
});

const usuario = userEvent.setup({ delay: null });

function conLaRed(hay: boolean) {
  return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(hay);
}

function pintar(
  parcial: Partial<React.ComponentProps<typeof ConfirmarSalida>> = {},
  red = true,
): {
  alEsperar: ReturnType<typeof vi.fn>;
  alEnviar: ReturnType<typeof vi.fn>;
  alSalir: ReturnType<typeof vi.fn>;
} {
  conLaRed(red);

  const alEsperar = vi.fn();
  const alEnviar = vi.fn();
  const alSalir = vi.fn();

  render(
    <ConfirmarSalida
      cambios={3}
      enviando={false}
      alEsperar={alEsperar}
      alEnviar={alEnviar}
      alSalir={alSalir}
      {...parcial}
    />,
  );

  return { alEsperar, alEnviar, alSalir };
}

describe('ConfirmarSalida (SCRUM-142)', () => {
  it('dice cuantos cambios son y que se perderan', () => {
    pintar({ cambios: 3 });

    expect(screen.getByRole('alertdialog', { name: '¿Salir ahora?' })).toHaveTextContent(
      'Tienes 3 cambios guardados en este equipo que no se han enviado. Si sales ahora, se perderán.',
    );
  });

  it('con uno, en singular', () => {
    pintar({ cambios: 1 });

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Tienes 1 cambio guardado en este equipo que no se ha enviado. Si sales ahora, se perderá.',
    );
  });

  it('el dialogo se describe con ese texto', () => {
    pintar({ cambios: 2 });

    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/Tienes 2 cambios/);
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('el foco entra en «Esperar»: lo primero a mano es lo que no pierde nada', () => {
    pintar();

    expect(screen.getByRole('button', { name: 'Esperar' })).toHaveFocus();
  });

  it('esperar y Escape son lo mismo: no se sale', async () => {
    const { alEsperar, alSalir } = pintar();

    await usuario.click(screen.getByRole('button', { name: 'Esperar' }));
    await usuario.keyboard('{Escape}');

    expect(alEsperar).toHaveBeenCalledTimes(2);
    expect(alSalir).not.toHaveBeenCalled();
  });

  it('pulsar fuera de la caja tambien es esperar, y pulsar dentro no', async () => {
    const { alEsperar } = pintar();

    await usuario.click(screen.getByRole('alertdialog'));
    expect(alEsperar).not.toHaveBeenCalled();

    await usuario.click(document.querySelector('.confirmar-salida')!);
    expect(alEsperar).toHaveBeenCalledTimes(1);
  });

  it('salir es una eleccion clara, dicha con palabras', async () => {
    const { alSalir, alEsperar } = pintar();

    await usuario.click(screen.getByRole('button', { name: 'Salir y perderlos' }));

    expect(alSalir).toHaveBeenCalledTimes(1);
    expect(alEsperar).not.toHaveBeenCalled();
  });

  it('con conexion se pueden enviar ahora', async () => {
    const { alEnviar } = pintar();

    await usuario.click(screen.getByRole('button', { name: 'Enviarlos ahora' }));

    expect(alEnviar).toHaveBeenCalledTimes(1);
  });

  it('mientras se envian, lo dice y no se envian dos veces; el foco no se va', async () => {
    const { alEnviar } = pintar({ enviando: true });
    const boton = screen.getByRole('button', { name: 'Enviando…' });

    boton.focus();
    await usuario.click(boton);

    expect(alEnviar).not.toHaveBeenCalled();
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(boton).toHaveFocus();
  });

  it('sin conexion no se ofrece enviar, y se explica por que', () => {
    pintar({}, false);

    expect(screen.queryByRole('button', { name: /Enviarlos ahora/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión no se pueden enviar. Si te quedas, se envían solos cuando vuelva.',
    );
    // Esperar y salir siguen ahi.
    expect(screen.getByRole('button', { name: 'Esperar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir y perderlos' })).toBeInTheDocument();
  });

  it('con conexion no dice nada de que no se pueda enviar', () => {
    pintar({}, true);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('si se va la conexion con el dialogo abierto, deja de ofrecer enviar', () => {
    const red = conLaRed(true);

    render(
      <ConfirmarSalida
        cambios={1}
        enviando={false}
        alEsperar={vi.fn()}
        alEnviar={vi.fn()}
        alSalir={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviarlos ahora' })).toBeInTheDocument();

    act(() => {
      red.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.queryByRole('button', { name: 'Enviarlos ahora' })).not.toBeInTheDocument();
  });

  it('nunca dice que cambios son: lo puede estar viendo otra persona', () => {
    pintar({ cambios: 2 });

    expect(screen.getByRole('alertdialog').textContent).not.toMatch(/diario|pendiente|resultado/i);
  });
});
