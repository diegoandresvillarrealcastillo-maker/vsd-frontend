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

/**
 * Un navegador con Web Push y, si se pide, ya suscrito. Soltar la suscripcion la quita de verdad:
 * despues de `unsubscribe`, el navegador ya no la devuelve (salvo que se pida que se resista).
 */
function conWebPush(suscrito: boolean, opciones: { readonly seResiste?: boolean } = {}) {
  let hayUna = suscrito;
  const suscripcion = {
    endpoint: ENDPOINT,
    unsubscribe: vi.fn(() => {
      hayUna &&= opciones.seResiste === true;

      return Promise.resolve(opciones.seResiste !== true);
    }),
  };

  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'granted' });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn(() => Promise.resolve(hayUna ? suscripcion : null)) },
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

    expect(soltarEsteNavegadorDelServidor).toHaveBeenCalledWith(ENDPOINT, expect.any(AbortSignal));
    expect(suscripcion.unsubscribe).toHaveBeenCalled();
  });

  /**
   * Lo de este equipo va primero (SCRUM-271): no depende de la red, y es lo que corta los avisos aqui.
   * Antes se esperaba al servidor y se soltaba despues: con el servidor colgado, el navegador de
   * quien ya salio seguia recibiendo sus avisos.
   */
  describe('lo de aqui va primero (SCRUM-271)', () => {
    it('suelta la suscripcion de este navegador ANTES de avisar al servidor', async () => {
      const suscripcion = conWebPush(true);

      await dejarDeAvisarAEsteNavegador();

      expect(suscripcion.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
        soltarEsteNavegadorDelServidor.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('si el servidor no responde, lo de aqui ya quedo suelto', async () => {
      vi.useFakeTimers();

      const suscripcion = conWebPush(true);

      soltarEsteNavegadorDelServidor.mockReturnValue(new Promise(() => undefined));

      const salida = dejarDeAvisarAEsteNavegador();

      await vi.advanceTimersByTimeAsync(3_000);
      await salida;

      expect(suscripcion.unsubscribe).toHaveBeenCalledOnce();
      await expect(suscripcionActual()).resolves.toBeNull();
    });

    it('le da al servidor 3 segundos y cancela la llamada pasado ese tiempo', async () => {
      const limite = vi.spyOn(AbortSignal, 'timeout');

      conWebPush(true);
      await dejarDeAvisarAEsteNavegador();

      expect(limite).toHaveBeenCalledWith(3_000);
      expect(soltarEsteNavegadorDelServidor.mock.calls[0]?.[1]).toBe(limite.mock.results[0]?.value);
    });

    it('si soltar lo de aqui falla, igual avisa al servidor y no lanza', async () => {
      const suscripcion = conWebPush(true);
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      suscripcion.unsubscribe.mockRejectedValue(new Error('el navegador no pudo'));

      await expect(dejarDeAvisarAEsteNavegador()).resolves.toBeUndefined();

      expect(soltarEsteNavegadorDelServidor).toHaveBeenCalledWith(ENDPOINT, expect.anything());
      expect(aviso).toHaveBeenCalledOnce();
    });

    it('comprueba que quedo suelta, y si no, lo dice y avisa al servidor igual', async () => {
      conWebPush(true, { seResiste: true });

      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await dejarDeAvisarAEsteNavegador();

      expect(aviso).toHaveBeenCalledOnce();
      expect(soltarEsteNavegadorDelServidor).toHaveBeenCalledOnce();
    });

    it('cuando quedo suelta no dice nada', async () => {
      conWebPush(true);

      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await dejarDeAvisarAEsteNavegador();

      expect(aviso).not.toHaveBeenCalled();
    });
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
