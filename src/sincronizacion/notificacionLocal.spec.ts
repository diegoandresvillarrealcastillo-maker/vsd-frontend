import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ETIQUETA_DE_LA_NOTIFICACION,
  TEXTO_DE_LA_NOTIFICACION,
  TITULO_DE_LA_NOTIFICACION,
  avisarEnSegundoPlano,
  type EntornoDeNotificaciones,
} from './notificacionLocal.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function entorno(
  permiso: NotificationPermission | undefined,
  mostrar = vi.fn(() => Promise.resolve()),
): { entorno: EntornoDeNotificaciones; mostrar: typeof mostrar } {
  return {
    mostrar,
    entorno: {
      permiso: () => permiso,
      registro: () => Promise.resolve({ showNotification: mostrar }),
    },
  };
}

describe('avisarEnSegundoPlano (SCRUM-137)', () => {
  it('con el permiso dado, muestra una notificacion neutra, sin sonido y con etiqueta', async () => {
    const { entorno: e, mostrar } = entorno('granted');

    expect(await avisarEnSegundoPlano(e)).toBe(true);
    expect(mostrar).toHaveBeenCalledTimes(1);
    expect(mostrar).toHaveBeenCalledWith(TITULO_DE_LA_NOTIFICACION, {
      body: TEXTO_DE_LA_NOTIFICACION,
      tag: ETIQUETA_DE_LA_NOTIFICACION,
      silent: true,
    });
  });

  it('el texto no dice nada de salud ni de que se envio', () => {
    expect(`${TITULO_DE_LA_NOTIFICACION} ${TEXTO_DE_LA_NOTIFICACION}`).toBe(
      'VSD Health Tus cambios guardados en este equipo ya se enviaron.',
    );
  });

  it.each(['denied', 'default'] as const)(
    'con el permiso en "%s" no muestra nada',
    async (permiso) => {
      const { entorno: e, mostrar } = entorno(permiso);

      expect(await avisarEnSegundoPlano(e)).toBe(false);
      expect(mostrar).not.toHaveBeenCalled();
    },
  );

  it('en un navegador sin notificaciones, no muestra nada', async () => {
    const { entorno: e, mostrar } = entorno(undefined);

    expect(await avisarEnSegundoPlano(e)).toBe(false);
    expect(mostrar).not.toHaveBeenCalled();
  });

  it('sin service worker, no muestra nada', async () => {
    const mostrar = vi.fn();

    expect(
      await avisarEnSegundoPlano({
        permiso: () => 'granted',
        registro: () => Promise.resolve(null),
      }),
    ).toBe(false);
    expect(mostrar).not.toHaveBeenCalled();
  });

  it('nunca pide el permiso', async () => {
    const pedir = vi.fn();

    vi.stubGlobal('Notification', { permission: 'default', requestPermission: pedir });
    await avisarEnSegundoPlano();

    expect(pedir).not.toHaveBeenCalled();
  });

  it('si mostrarla falla, no lanza', async () => {
    const { entorno: e } = entorno(
      'granted',
      vi.fn(() => Promise.reject(new Error('no se pudo'))),
    );

    await expect(avisarEnSegundoPlano(e)).resolves.toBe(false);
  });

  it('si encontrar el service worker falla, no lanza', async () => {
    await expect(
      avisarEnSegundoPlano({
        permiso: () => 'granted',
        registro: () => Promise.reject(new Error('sin service worker')),
      }),
    ).resolves.toBe(false);
  });

  describe('con el entorno real', () => {
    it('lee el permiso de Notification', async () => {
      const mostrar = vi.fn(() => Promise.resolve());

      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.stubGlobal('navigator', {
        serviceWorker: { ready: Promise.resolve({ showNotification: mostrar }) },
      });

      expect(await avisarEnSegundoPlano()).toBe(true);
      expect(mostrar).toHaveBeenCalledTimes(1);
    });

    it('sin Notification en el navegador, no hace nada', async () => {
      vi.stubGlobal('Notification', undefined);

      expect(await avisarEnSegundoPlano()).toBe(false);
    });

    it('con permiso pero sin service worker en el navegador, no hace nada', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.stubGlobal('navigator', {});

      expect(await avisarEnSegundoPlano()).toBe(false);
    });
  });
});
