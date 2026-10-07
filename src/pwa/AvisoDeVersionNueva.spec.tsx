import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AvisoDeVersionNueva } from './AvisoDeVersionNueva.tsx';
import {
  avisarVersionNueva,
  laVersionNuevaTomoElControl,
  olvidarLaVersionNuevaParaLasPruebas,
} from './versionNueva.ts';

afterEach(() => {
  vi.useRealTimers();
  olvidarLaVersionNuevaParaLasPruebas();
});

function ofrecer(activar: () => Promise<void> = () => Promise.resolve()): void {
  act(() => {
    avisarVersionNueva(activar);
  });
}

describe('AvisoDeVersionNueva: actualizar (SCRUM-135)', () => {
  it('sin version nueva no se ve nada, pero la region existe para que se anuncie despues', () => {
    render(<AvisoDeVersionNueva />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('con una version nueva la dice y ofrece actualizar o dejarlo para despues', () => {
    render(<AvisoDeVersionNueva />);

    ofrecer();

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva de VSD Health.');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Después' })).toBeEnabled();
  });

  it('avisa de que la pagina se recarga, para no perder lo que se esta escribiendo', () => {
    render(<AvisoDeVersionNueva />);

    ofrecer();

    expect(screen.getByRole('status')).toHaveTextContent(/se recarga/i);
  });

  it('la region ya estaba en el documento cuando llego el texto (si no, no se anuncia)', () => {
    render(<AvisoDeVersionNueva />);

    const region = screen.getByRole('status');

    ofrecer();

    expect(screen.getByRole('status')).toBe(region);
  });

  it('no roba el foco al aparecer', () => {
    render(<AvisoDeVersionNueva />);

    const antes = document.activeElement;

    ofrecer();

    expect(document.activeElement).toBe(antes);
    expect(screen.getByRole('button', { name: 'Actualizar' })).not.toHaveFocus();
  });

  it('actualizar llama a lo que activa la version nueva', async () => {
    const activar = vi.fn(() => Promise.resolve());

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(activar).toHaveBeenCalledTimes(1);
  });

  it('despues de pulsar sigue diciendo "Actualizando…" hasta que la pagina se recarga', async () => {
    render(<AvisoDeVersionNueva />);
    ofrecer(() => Promise.resolve());

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    // La promesa del plugin resuelve de inmediato, pero la pagina aun no se
    // recargo: el boton no puede volver a "Actualizar" como si nada.
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Después' })).toBeDisabled();
  });

  it('no deja pulsar dos veces', async () => {
    const activar = vi.fn(() => Promise.resolve());

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Actualizando…' }));

    expect(activar).toHaveBeenCalledTimes(1);
  });

  it('si en ocho segundos la pagina no se recargo, lo dice y el boton vuelve', () => {
    vi.useFakeTimers();

    render(<AvisoDeVersionNueva />);
    ofrecer(() => Promise.resolve());

    act(() => {
      screen.getByRole('button', { name: 'Actualizar' }).click();
    });

    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(7999);
    });

    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByText(/No se pudo actualizar ahora/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Después' })).toBeEnabled();
  });

  it('si la pagina se recarga a tiempo, el temporizador no molesta (se limpia al desmontar)', () => {
    vi.useFakeTimers();

    const { unmount } = render(<AvisoDeVersionNueva />);

    ofrecer(() => Promise.resolve());
    act(() => {
      screen.getByRole('button', { name: 'Actualizar' }).click();
    });

    // Pulsado y a la espera: hay un temporizador corriendo.
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    // Desmontado, no queda ninguno: no se actualiza un componente que ya no esta.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si no se pudo activar, lo dice y el boton vuelve a estar disponible', async () => {
    const activar = vi.fn(() => Promise.reject(new Error('no se pudo')));

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByText(/No se pudo actualizar ahora/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Después' })).toBeEnabled();
  });

  it('el aviso de fallo no repite lo que dijo el error del navegador', async () => {
    const activar = vi.fn(() => Promise.reject(new Error('detalle interno del navegador')));

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByText(/No se pudo actualizar ahora/);

    expect(screen.getByRole('status')).not.toHaveTextContent('detalle interno');
  });

  it('un segundo intento limpia el aviso de fallo anterior mientras trabaja', async () => {
    let intento = 0;
    const activar = vi.fn(() => {
      intento += 1;

      return intento === 1 ? Promise.reject(new Error('no se pudo')) : Promise.resolve();
    });

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByText(/No se pudo actualizar ahora/);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(screen.queryByText(/No se pudo actualizar ahora/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();
  });

  it('"despues" lo esconde y no activa nada', async () => {
    const activar = vi.fn(() => Promise.resolve());

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.click(screen.getByRole('button', { name: 'Después' }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(activar).not.toHaveBeenCalled();
  });

  it('se maneja con el teclado', async () => {
    const activar = vi.fn(() => Promise.resolve());

    render(<AvisoDeVersionNueva />);
    ofrecer(activar);

    await userEvent.tab();

    expect(screen.getByRole('button', { name: 'Actualizar' })).toHaveFocus();

    await userEvent.keyboard('{Enter}');

    expect(activar).toHaveBeenCalledTimes(1);
  });
});

describe('AvisoDeVersionNueva: recargar (SCRUM-135)', () => {
  /** La version nueva tomo el control sin que esta pestana lo pidiera. */
  function seActualizoEnOtraPestana(recargar: () => void = () => undefined): void {
    act(() => {
      laVersionNuevaTomoElControl(recargar);
    });
  }

  it('dice que se actualizo en otra pestana y ofrece recargar', () => {
    render(<AvisoDeVersionNueva />);

    seActualizoEnOtraPestana();

    expect(screen.getByRole('status')).toHaveTextContent(
      'VSD Health se actualizó en otra pestaña.',
    );
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled();
  });

  it('pide recargar cuando termine lo que escribe: no lo hace por ella', () => {
    const recargar = vi.fn();

    render(<AvisoDeVersionNueva />);
    seActualizoEnOtraPestana(recargar);

    expect(screen.getByRole('status')).toHaveTextContent(/cuando termines/i);
    expect(recargar).not.toHaveBeenCalled();
  });

  it('no ofrece "Despues": esa pagina ya esta desincronizada', () => {
    render(<AvisoDeVersionNueva />);

    seActualizoEnOtraPestana();

    expect(screen.queryByRole('button', { name: 'Después' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument();
  });

  it('"Recargar" recarga la pagina', async () => {
    const recargar = vi.fn();

    render(<AvisoDeVersionNueva />);
    seActualizoEnOtraPestana(recargar);

    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }));

    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('sustituye a la oferta de actualizar si estaba a la vista', () => {
    render(<AvisoDeVersionNueva />);

    ofrecer();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();

    seActualizoEnOtraPestana();

    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });

  it('no roba el foco al aparecer', () => {
    render(<AvisoDeVersionNueva />);

    const antes = document.activeElement;

    seActualizoEnOtraPestana();

    expect(document.activeElement).toBe(antes);
    expect(screen.getByRole('button', { name: 'Recargar' })).not.toHaveFocus();
  });
});
