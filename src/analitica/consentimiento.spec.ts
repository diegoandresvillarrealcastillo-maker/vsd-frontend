import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DEL_CONSENTIMIENTO,
  VERSION_DEL_CONSENTIMIENTO,
  guardarLaDecision,
  leerLaDecision,
} from './consentimiento.ts';

afterEach(() => {
  window.localStorage.removeItem(CLAVE_DEL_CONSENTIMIENTO);
  vi.restoreAllMocks();
});

describe('la decision sobre la analitica', () => {
  it('sin nada guardado, no hay decision: se pregunta', () => {
    expect(leerLaDecision()).toBeNull();
  });

  it.each(['aceptada', 'rechazada'] as const)('recuerda que se %s', (decision) => {
    guardarLaDecision(decision);

    expect(leerLaDecision()).toBe(decision);
  });

  it('guarda solo la eleccion, la version y cuando: nada de quien es la persona', () => {
    guardarLaDecision('aceptada', new Date('2026-10-08T12:00:00.000Z'));

    const guardado = JSON.parse(
      window.localStorage.getItem(CLAVE_DEL_CONSENTIMIENTO) ?? '{}',
    ) as Record<string, unknown>;

    expect(Object.keys(guardado).sort()).toEqual(['decision', 'en', 'version']);
    expect(guardado).toEqual({
      version: VERSION_DEL_CONSENTIMIENTO,
      decision: 'aceptada',
      en: '2026-10-08T12:00:00.000Z',
    });
  });

  it('una decision de una version anterior ya no vale: se vuelve a preguntar', () => {
    window.localStorage.setItem(
      CLAVE_DEL_CONSENTIMIENTO,
      JSON.stringify({
        version: VERSION_DEL_CONSENTIMIENTO - 1,
        decision: 'aceptada',
        en: '2026-01-01T00:00:00.000Z',
      }),
    );

    expect(leerLaDecision()).toBeNull();
  });

  it.each([
    ['basura', 'esto no es json'],
    ['un valor que no es un objeto', '42'],
    ['null', 'null'],
    [
      'una decision inventada',
      JSON.stringify({ version: VERSION_DEL_CONSENTIMIENTO, decision: 'si' }),
    ],
    ['sin decision', JSON.stringify({ version: VERSION_DEL_CONSENTIMIENTO })],
  ])('con %s guardado, se pregunta y no se rompe', (_caso, crudo) => {
    window.localStorage.setItem(CLAVE_DEL_CONSENTIMIENTO, crudo);

    expect(leerLaDecision()).toBeNull();
  });

  it('si no se puede leer el almacenamiento, no hay decision', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    expect(leerLaDecision()).toBeNull();
  });

  it('si no se puede guardar, no lanza: la decision vale para esta visita', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });

    expect(() => {
      guardarLaDecision('rechazada');
    }).not.toThrow();
  });
});
