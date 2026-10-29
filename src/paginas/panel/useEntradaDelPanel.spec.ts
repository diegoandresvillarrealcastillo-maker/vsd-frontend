import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useEntradaDelPanel } from './useEntradaDelPanel.ts';

/**
 * La entrada escalonada de las secciones del panel (SCRUM-310). Con «reducir movimiento» tiene su
 * propio archivo: Framer Motion lee la preferencia una sola vez por carga del modulo.
 */
describe('useEntradaDelPanel', () => {
  it('cada seccion nace transparente y 16 px mas abajo, y sube con un resorte suave', () => {
    const { result } = renderHook(() => useEntradaDelPanel(true));

    expect(result.current(0)).toMatchObject({
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0 },
      transition: { type: 'spring' },
    });
  });

  it('entran una tras otra: cada seccion espera un poco mas que la anterior', () => {
    const { result } = renderHook(() => useEntradaDelPanel(true));
    const esperas = [0, 1, 2].map((orden) => result.current(orden).transition?.delay);

    expect(esperas[0]).toBe(0);
    expect(esperas[1]).toBeGreaterThan(esperas[0]!);
    expect(esperas[2]).toBeGreaterThan(esperas[1]!);
    // Una pausa que se nota entre una y otra, y la ultima no se hace esperar.
    expect(esperas[2]).toBeLessThanOrEqual(0.3);
  });

  it('mientras el tutorial esta por abrirse no hay entrada: mide el panel al montar y el movimiento lo desplazaria', () => {
    const { result } = renderHook(() => useEntradaDelPanel(false));

    expect([0, 1, 2].map((orden) => result.current(orden))).toEqual([{}, {}, {}]);
  });
});
