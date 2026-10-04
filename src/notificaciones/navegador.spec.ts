import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  capacidadDelNavegador,
  dejarDeAvisarAEsteNavegador,
  suscripcionActual,
} from './navegador.ts';

/**
 * Lo que los avisos necesitan del navegador (SCRUM-102). jsdom no trae Web
 * Push: lo que haga falta se simula en cada prueba.
 */
const { soltarEsteNavegadorDelServidor } = vi.hoisted(() => ({
  soltarEsteNavegadorDelServidor: vi.fn(),
}));

vi.mock('../infraestructura/api/notificaciones.ts', () => ({ soltarEsteNavegadorDelServidor }));

const ENDPOINT = 'https://push.example.com/este-navegador';

/** Un navegador con Web Push y, si se pide, ya suscrito. */
function conWebPush(suscrito: boolean) {
  const suscripcion = { endpoint: ENDPOINT, unsubscribe: vi.fn().mockResolvedValue(true) };

  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'granted' });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(suscrito ? suscripcion : null) },
      }),
    },
  });

  return suscripcion;
}

function conAgente(agente: string, toques = 0) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agente);
  // jsdom no lo trae.
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: toques });
}

beforeEach(() => {
  soltarEsteNavegadorDelServidor.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(navigator, 'maxTouchPoints');
});

describe('capacidadDelNavegador', () => {
  it('con service worker y Push, puede recibir avisos', () => {
    conWebPush(false);

    expect(capacidadDelNavegador()).toBe('lista');
  });

  it('un iPhone sin Push es Safari sin instalar', () => {
    conAgente('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

    expect(capacidadDelNavegador()).toBe('iphone-sin-instalar');
  });

  it('un iPad reciente se presenta como Mac, pero tactil', () => {
    conAgente('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5);

    expect(capacidadDelNavegador()).toBe('iphone-sin-instalar');
  });

  it('cualquier otro sin Push no los recibe', () => {
    conAgente('Mozilla/5.0 (X11; Linux x86_64)');

    expect(capacidadDelNavegador()).toBe('sin-soporte');
  });
});

describe('al cerrar sesion', () => {
  it('suelta el navegador en el servidor y aqui', async () => {
    const suscripcion = conWebPush(true);

    await dejarDeAvisarAEsteNavegador();

    expect(soltarEsteNavegadorDelServidor).toHaveBeenCalledWith(ENDPOINT);
    expect(suscripcion.unsubscribe).toHaveBeenCalled();
  });

  it('si el servidor falla, lo suelta aqui igual y no lanza', async () => {
    const suscripcion = conWebPush(true);

    soltarEsteNavegadorDelServidor.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(dejarDeAvisarAEsteNavegador()).resolves.toBeUndefined();
    expect(suscripcion.unsubscribe).toHaveBeenCalled();
  });

  it('si el servidor no responde, no deja la salida colgada', async () => {
    vi.useFakeTimers();
    conWebPush(true);
    soltarEsteNavegadorDelServidor.mockReturnValue(new Promise(() => undefined));

    const salida = dejarDeAvisarAEsteNavegador();

    await vi.advanceTimersByTimeAsync(3_000);

    await expect(salida).resolves.toBeUndefined();
  });

  it('sin suscripcion, o sin Web Push, no hace nada', async () => {
    await dejarDeAvisarAEsteNavegador();

    conWebPush(false);
    await dejarDeAvisarAEsteNavegador();

    expect(soltarEsteNavegadorDelServidor).not.toHaveBeenCalled();
    await expect(suscripcionActual()).resolves.toBeNull();
  });
});
