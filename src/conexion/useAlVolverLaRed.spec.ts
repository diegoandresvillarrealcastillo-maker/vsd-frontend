import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAlVolverLaRed } from './useAlVolverLaRed.ts';

const volver = () => window.dispatchEvent(new Event('online'));

describe('useAlVolverLaRed', () => {
  it('mientras esta activo, hace lo que se le dice cada vez que vuelve la red', () => {
    const alVolver = vi.fn();

    renderHook(() => {
      useAlVolverLaRed(true, alVolver);
    });
    volver();
    volver();

    expect(alVolver).toHaveBeenCalledTimes(2);
  });

  it('si no esta activo, no escucha nada', () => {
    const alVolver = vi.fn();

    renderHook(() => {
      useAlVolverLaRed(false, alVolver);
    });
    volver();

    expect(alVolver).not.toHaveBeenCalled();
  });

  it('al dejar de estar activo, deja de escuchar', () => {
    const alVolver = vi.fn();
    const { rerender } = renderHook(
      ({ activo }) => {
        useAlVolverLaRed(activo, alVolver);
      },
      { initialProps: { activo: true } },
    );

    rerender({ activo: false });
    volver();

    expect(alVolver).not.toHaveBeenCalled();
  });

  it('al empezar a estar activo, empieza a escuchar', () => {
    const alVolver = vi.fn();
    const { rerender } = renderHook(
      ({ activo }) => {
        useAlVolverLaRed(activo, alVolver);
      },
      { initialProps: { activo: false } },
    );

    rerender({ activo: true });
    volver();

    expect(alVolver).toHaveBeenCalledTimes(1);
  });

  it('al desmontar, no deja nada escuchando', () => {
    const alVolver = vi.fn();
    const { unmount } = renderHook(() => {
      useAlVolverLaRed(true, alVolver);
    });

    unmount();
    volver();

    expect(alVolver).not.toHaveBeenCalled();
  });

  it('si cambia lo que hay que hacer, se hace lo nuevo', () => {
    const viejo = vi.fn();
    const nuevo = vi.fn();
    const { rerender } = renderHook(
      ({ alVolver }) => {
        useAlVolverLaRed(true, alVolver);
      },
      { initialProps: { alVolver: viejo } },
    );

    rerender({ alVolver: nuevo });
    volver();

    expect(viejo).not.toHaveBeenCalled();
    expect(nuevo).toHaveBeenCalledTimes(1);
  });
});
