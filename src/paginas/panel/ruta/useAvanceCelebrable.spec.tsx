import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { olvidarLoVisto, useAvanceCelebrable } from './useAvanceCelebrable.ts';

describe('useAvanceCelebrable', () => {
  beforeEach(() => {
    olvidarLoVisto();
  });

  it('la primera vez que se ve el panel no hay nada nuevo', () => {
    const { result } = renderHook(() => useAvanceCelebrable(['a', 'b']));

    expect(result.current.nuevas.size).toBe(0);
  });

  it('al volver al panel, lo hecho desde la ultima vez es lo nuevo', () => {
    const primera = renderHook(() => useAvanceCelebrable(['a']));

    primera.unmount();

    const segunda = renderHook(() => useAvanceCelebrable(['a', 'b']));

    expect([...segunda.result.current.nuevas]).toEqual(['b']);
  });

  it('si no cambia nada, al volver no hay nada que celebrar', () => {
    renderHook(() => useAvanceCelebrable(['a'])).unmount();

    const segunda = renderHook(() => useAvanceCelebrable(['a']));

    expect(segunda.result.current.nuevas.size).toBe(0);
  });

  it('lo que se hace con el panel abierto tambien se celebra', () => {
    const { result, rerender } = renderHook(({ ids }) => useAvanceCelebrable(ids), {
      initialProps: { ids: ['a'] },
    });

    expect(result.current.nuevas.size).toBe(0);

    act(() => {
      rerender({ ids: ['a', 'b'] });
    });

    expect([...result.current.nuevas]).toEqual(['b']);
  });

  it('lo que otra persona hizo antes no se celebra: al cerrar sesion se olvida lo visto', () => {
    renderHook(() => useAvanceCelebrable(['a'])).unmount();
    olvidarLoVisto();

    const otra = renderHook(() => useAvanceCelebrable(['a', 'b']));

    expect(otra.result.current.nuevas.size).toBe(0);
  });

  it('lo nuevo se acumula mientras el panel sigue abierto', () => {
    const { result, rerender } = renderHook(({ ids }) => useAvanceCelebrable(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => {
      rerender({ ids: ['a'] });
    });
    act(() => {
      rerender({ ids: ['a', 'b'] });
    });

    expect([...result.current.nuevas].sort()).toEqual(['a', 'b']);
  });
});
