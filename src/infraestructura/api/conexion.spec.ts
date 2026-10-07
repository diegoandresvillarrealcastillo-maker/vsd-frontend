import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS, hayConexionConLaApi } from './conexion.ts';

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('hayConexionConLaApi (SCRUM-136)', () => {
  it('si el servidor responde bien, hay conexion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"estado":"ok"}', { status: 200 })),
    );

    expect(await hayConexionConLaApi()).toBe(true);
  });

  it('pregunta a /health, sin cache', async () => {
    const pedir = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    vi.stubGlobal('fetch', pedir);

    await hayConexionConLaApi();

    const [direccion, opciones] = pedir.mock.calls[0] as [string, RequestInit];

    expect(direccion).toMatch(/\/health$/);
    expect(opciones.cache).toBe('no-store');
  });

  it('el navegador dice que no hay red: ni siquiera se intenta', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const pedir = vi.fn();

    vi.stubGlobal('fetch', pedir);

    expect(await hayConexionConLaApi()).toBe(false);
    expect(pedir).not.toHaveBeenCalled();
  });

  it('el navegador dice que si hay red pero el servidor no responde: no hay conexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    // `onLine` solo es fiable cuando dice que NO. Estar en una wifi no es poder llegar
    // al servidor.
    expect(await hayConexionConLaApi()).toBe(false);
  });

  it.each([500, 502, 503, 404])('un %i del servidor no es una conexion', async (estado) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: estado })));

    expect(await hayConexionConLaApi()).toBe(false);
  });

  it('un servidor que no contesta no es una conexion: se rinde al pasar el limite', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_direccion: string, opciones: RequestInit) =>
          new Promise<Response>((_resolver, rechazar) => {
            opciones.signal?.addEventListener('abort', () => {
              rechazar(new DOMException('cancelada', 'AbortError'));
            });
          }),
      ),
    );

    const respuesta = hayConexionConLaApi();

    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS - 1);
    // Todavia esperando.
    let termino = false;

    void respuesta.then(() => {
      termino = true;
    });
    await Promise.resolve();

    expect(termino).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(await respuesta).toBe(false);
  });

  it('el limite es de 15 segundos', () => {
    expect(ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS).toBe(15_000);
  });

  it('si responde a tiempo, no queda ningun temporizador vivo', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));

    await hayConexionConLaApi();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('si falla, tampoco', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));

    await hayConexionConLaApi();

    expect(vi.getTimerCount()).toBe(0);
  });
});
