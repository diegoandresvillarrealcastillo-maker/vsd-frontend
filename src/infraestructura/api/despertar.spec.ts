import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { despertarElApi, olvidarQueSeDesperto } from './despertar.ts';

beforeEach(() => {
  olvidarQueSeDesperto();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('despertarElApi (SCRUM-111)', () => {
  it('llama a /health una sola vez por carga, sin leer la respuesta', () => {
    despertarElApi();
    despertarElApi();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/health', {
      mode: 'no-cors',
      cache: 'no-store',
    });
  });

  it('si falla, no pasa nada', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    expect(() => despertarElApi()).not.toThrow();
    // Que el rechazo no quede sin atender.
    await Promise.resolve();
  });
});
