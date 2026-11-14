import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectorDeTema } from './SelectorDeTema.tsx';

function grupo(): HTMLElement {
  return screen.getByRole('group', { name: 'Tema de la aplicación' });
}

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.dataset.tema = 'claro';
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.tema;
});

describe('SelectorDeTema', () => {
  it('marca cual de los dos temas esta puesto', () => {
    render(<SelectorDeTema />);

    expect(screen.getByRole('button', { name: 'Tema claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tema oscuro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('cambia el tema del documento y lo recuerda', () => {
    render(<SelectorDeTema />);

    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }));

    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(localStorage.getItem('vsd.tema')).toBe('oscuro');
    expect(screen.getByRole('button', { name: 'Tema oscuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('en reposo no lleva la marca del vidrio', () => {
    render(<SelectorDeTema />);

    expect(grupo()).not.toHaveAttribute('data-moviendo');
  });

  it('enciende la marca del vidrio al cambiar y la quita cuando termina', () => {
    render(<SelectorDeTema />);

    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }));

    expect(grupo()).toHaveAttribute('data-moviendo');

    // Todavia dura: no se quita a medias.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(grupo()).toHaveAttribute('data-moviendo');

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(grupo()).not.toHaveAttribute('data-moviendo');
  });

  it('volver a pulsar el que ya esta puesto no vuelve a animar', () => {
    render(<SelectorDeTema />);

    fireEvent.click(screen.getByRole('button', { name: 'Tema claro' }));

    expect(grupo()).not.toHaveAttribute('data-moviendo');
  });

  it('si se cambia otra vez a mitad, reinicia la cuenta en lugar de apagarse antes', () => {
    render(<SelectorDeTema />);

    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tema claro' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Han pasado 800 ms desde el primer cambio, pero solo 400 desde el ultimo.
    expect(grupo()).toHaveAttribute('data-moviendo');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(grupo()).not.toHaveAttribute('data-moviendo');
  });
});
