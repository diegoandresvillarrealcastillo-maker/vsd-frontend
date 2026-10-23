import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS, hayConexionConLaApi } from './conexion.ts';
import { motivoDelUltimoFallo } from './motivoDelFallo.ts';

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

  // «Demasiadas peticiones» es la API contestando: hay conexion, y lo que toca es esperar. Leerlo como
  // «sin conexión» bloqueaba el envio de lo guardado mientras el servidor estaba sano (SCRUM-244).
  it('un 429 es el servidor pidiendo esperar: si hay conexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 429 })));

    expect(await hayConexionConLaApi()).toBe(true);
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

  it('el limite es de 60 segundos: lo que tarda en despertar el servidor del plan gratuito', () => {
    expect(ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS).toBe(60_000);
  });

  it('un servidor dormido que tarda 40 segundos en despertar si cuenta como conexion', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_direccion: string, opciones: RequestInit) =>
          new Promise<Response>((resolver, rechazar) => {
            const despierta = setTimeout(() => {
              resolver(new Response('ok', { status: 200 }));
            }, 40_000);

            opciones.signal?.addEventListener('abort', () => {
              clearTimeout(despierta);
              rechazar(new DOMException('cancelada', 'AbortError'));
            });
          }),
      ),
    );

    const respuesta = hayConexionConLaApi();

    await vi.advanceTimersByTimeAsync(40_000);

    expect(await respuesta).toBe(true);
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

describe('motivoDelUltimoFallo (SCRUM-244)', () => {
  const DESDE = `desde ${location.origin} hacia http://localhost:3000`;

  it('tras una comprobacion buena no hay motivo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 500 })));
    await hayConexionConLaApi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));

    await hayConexionConLaApi();

    expect(motivoDelUltimoFallo()).toBeNull();
  });

  it('el navegador dice que no hay red', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    await hayConexionConLaApi();

    expect(motivoDelUltimoFallo()).toBe(`el navegador dice que no hay red (${DESDE})`);
  });

  it('el servidor respondio mal: dice el estado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 503 })));

    await hayConexionConLaApi();

    expect(motivoDelUltimoFallo()).toBe(`el servidor respondió 503 (${DESDE})`);
  });

  it('un servidor que no contesta: dice cuanto se espero', async () => {
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

    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS);
    await respuesta;

    expect(motivoDelUltimoFallo()).toBe(`sin respuesta en 60 s (${DESDE})`);
  });

  it('fetch falla: dice el error del navegador, cuanto tardo y desde donde se pregunto', async () => {
    const pedir = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    vi.stubGlobal('fetch', pedir);

    await hayConexionConLaApi();

    // Una sola peticion: no hay forma fiable de saber, desde la pagina, si un fallo de `fetch` fue CORS o
    // red (Chrome tambien rechaza una peticion `no-cors` cuya respuesta es JSON con `nosniff`).
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(motivoDelUltimoFallo()).toMatch(/^TypeError: Failed to fetch en \d+ ms \(/);
    expect(motivoDelUltimoFallo()).toContain(DESDE);
  });
});
