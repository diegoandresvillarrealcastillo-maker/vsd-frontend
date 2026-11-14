import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEnLinea } from './useEnLinea.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

function conLaRed(hay: boolean) {
  return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(hay);
}

describe('useEnLinea', () => {
  it('dice lo que dice el navegador al empezar', () => {
    conLaRed(true);
    expect(renderHook(() => useEnLinea()).result.current).toBe(true);

    conLaRed(false);
    expect(renderHook(() => useEnLinea()).result.current).toBe(false);
  });

  it('se entera cuando se va la conexion, y cuando vuelve', () => {
    const red = conLaRed(true);
    const gancho = renderHook(() => useEnLinea());

    act(() => {
      red.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(gancho.result.current).toBe(false);

    act(() => {
      red.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(gancho.result.current).toBe(true);
  });

  it('deja de escuchar al desmontarse', () => {
    const quitar = vi.spyOn(window, 'removeEventListener');
    const gancho = renderHook(() => useEnLinea());

    gancho.unmount();

    expect(quitar).toHaveBeenCalledWith('online', expect.any(Function));
    expect(quitar).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
