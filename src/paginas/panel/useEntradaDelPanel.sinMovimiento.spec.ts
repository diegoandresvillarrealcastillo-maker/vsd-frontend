import { renderHook } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { useEntradaDelPanel } from './useEntradaDelPanel.ts';

/**
 * Va en su propio archivo porque Framer Motion lee la preferencia una sola vez por carga del modulo:
 * mezclada con las pruebas del movimiento normal, el valor que se fijara primero decidiria el de
 * todas.
 */
beforeAll(() => {
  window.matchMedia = (consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'),
    media: consulta,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
});

describe('useEntradaDelPanel con «reducir movimiento»', () => {
  it('no marca ningun movimiento: las secciones aparecen donde van, sin subir', () => {
    const { result } = renderHook(() => useEntradaDelPanel(true));

    expect([0, 1, 2].map((orden) => result.current(orden))).toEqual([{}, {}, {}]);
  });
});
