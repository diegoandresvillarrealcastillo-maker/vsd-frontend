import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  capacidadDelNavegador,
  dejarDeAvisarAEsteNavegador,
  permisoDeAvisos,
  PermisoNegadoError,
  soltarNavegador,
  suscribirNavegador,
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

describe('permisoDeAvisos', () => {
  it('es el permiso que tenga el navegador', () => {
    vi.stubGlobal('Notification', { permission: 'denied' });

    expect(permisoDeAvisos()).toBe('denied');
  });

  it('un navegador sin avisos nunca se pregunto', () => {
    expect(permisoDeAvisos()).toBe('default');
  });
});

describe('suscribirNavegador', () => {
  // Con guion bajo, guion medio y sin relleno: lo que hace falta para comprobar la conversion a bytes.
  const CLAVE = 'AQID_-8';
  const BYTES_DE_LA_CLAVE = Uint8Array.from([1, 2, 3, 255, 239]);

  type Suscripcion = ReturnType<typeof unaSuscripcion>;

  function unaSuscripcion(
    clave: Uint8Array | null,
    json: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } = {
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256dh-de-prueba', auth: 'auth-de-prueba' },
    },
  ) {
    return {
      options: { applicationServerKey: clave === null ? null : clave.buffer },
      toJSON: () => json,
      unsubscribe: vi.fn(() => Promise.resolve(true)),
    };
  }

  /** Un navegador que deja suscribirse, con espias para ver que hizo con el service worker. */
  function conPermiso(permiso: NotificationPermission, previa: Suscripcion | null = null) {
    const nueva = unaSuscripcion(BYTES_DE_LA_CLAVE);
    const pushManager = {
      getSubscription: vi.fn(() => Promise.resolve(previa)),
      subscribe: vi.fn(() => Promise.resolve(nueva)),
    };
    const registro = { pushManager };
    const register = vi.fn(() => Promise.resolve(registro));

    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn(() => Promise.resolve(permiso)),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, ready: Promise.resolve(registro) },
    });

    return { pushManager, register, nueva };
  }

  it('sin permiso no registra nada: la persona lo nego', async () => {
    const { register } = conPermiso('denied');

    const intento = suscribirNavegador(CLAVE);

    await expect(intento).rejects.toBeInstanceOf(PermisoNegadoError);
    await expect(intento).rejects.toMatchObject({ permiso: 'denied' });
    expect(register).not.toHaveBeenCalled();
  });

  it('si cerro la pregunta sin contestar tampoco hay permiso', async () => {
    conPermiso('default');

    await expect(suscribirNavegador(CLAVE)).rejects.toMatchObject({ permiso: 'default' });
  });

  it('registra el service worker y se suscribe con la clave del servidor en bytes', async () => {
    const { pushManager, register } = conPermiso('granted');

    const suscripcion = await suscribirNavegador(CLAVE);

    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: BYTES_DE_LA_CLAVE,
    });
    expect(suscripcion).toEqual({
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256dh-de-prueba', auth: 'auth-de-prueba' },
    });
  });

  it('si ya tenia una suscripcion con la misma clave, la deja como esta', async () => {
    const previa = unaSuscripcion(BYTES_DE_LA_CLAVE);
    const { pushManager } = conPermiso('granted', previa);

    await suscribirNavegador(CLAVE);

    expect(previa.unsubscribe).not.toHaveBeenCalled();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('si el servidor cambio de clave, suelta la vieja y se suscribe de nuevo', async () => {
    const previa = unaSuscripcion(Uint8Array.from([9, 9, 9, 9, 9]));
    const { pushManager } = conPermiso('granted', previa);

    await suscribirNavegador(CLAVE);

    expect(previa.unsubscribe).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it('una suscripcion sin clave guardada tampoco sirve: se renueva', async () => {
    const previa = unaSuscripcion(null);
    const { pushManager } = conPermiso('granted', previa);

    await suscribirNavegador(CLAVE);

    expect(previa.unsubscribe).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it('una clave mas corta que empieza igual no es la misma', async () => {
    const previa = unaSuscripcion(BYTES_DE_LA_CLAVE.slice(0, 3));
    const { pushManager } = conPermiso('granted', previa);

    await suscribirNavegador(CLAVE);

    expect(previa.unsubscribe).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it('una clave del mismo largo pero distinta tambien se renueva', async () => {
    const otra = Uint8Array.from(BYTES_DE_LA_CLAVE);

    otra[0] = (otra[0] ?? 0) + 1;

    const previa = unaSuscripcion(otra);
    const { pushManager } = conPermiso('granted', previa);

    await suscribirNavegador(CLAVE);

    expect(previa.unsubscribe).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it.each([
    ['sin direccion', { keys: { p256dh: 'a', auth: 'b' } }],
    ['sin llaves', { endpoint: ENDPOINT }],
    ['sin la llave p256dh', { endpoint: ENDPOINT, keys: { auth: 'b' } }],
    ['sin la llave de autenticacion', { endpoint: ENDPOINT, keys: { p256dh: 'a' } }],
  ])('una suscripcion %s no se manda al servidor', async (_caso, json) => {
    const { pushManager, nueva } = conPermiso('granted');

    pushManager.subscribe.mockResolvedValue(Object.assign(nueva, { toJSON: () => json }));

    await expect(suscribirNavegador(CLAVE)).rejects.toThrow(
      'El navegador no entrego una suscripcion completa.',
    );
  });
});

describe('soltarNavegador', () => {
  it('suelta la suscripcion y devuelve su direccion', async () => {
    const suscripcion = conWebPush(true);

    await expect(soltarNavegador()).resolves.toBe(ENDPOINT);
    expect(suscripcion.unsubscribe).toHaveBeenCalledOnce();
  });

  it('sin suscripcion no hay nada que soltar', async () => {
    conWebPush(false);

    await expect(soltarNavegador()).resolves.toBeNull();
  });
});

describe('suscripcionActual', () => {
  it('sin service worker registrado todavia, no hay suscripcion', async () => {
    conWebPush(false);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn(() => Promise.resolve(undefined)) },
    });

    await expect(suscripcionActual()).resolves.toBeNull();
  });
});
