import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { llamadasAGtag, olvidarLaAnalitica } from '../pruebas/analitica.ts';
import {
  SEGUNDOS_DE_LA_COOKIE,
  activar,
  borrarLasCookies,
  enviarLaVisita,
  estaCargado,
  retirar,
} from './ga4.ts';

const ID = 'G-TEST123456';

beforeEach(() => {
  olvidarLaAnalitica(ID);
});

afterEach(() => {
  olvidarLaAnalitica(ID);
  window.history.replaceState({}, '', '/');
});

/** Los scripts de Google que hay en la pagina. */
function scriptsDeGoogle(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[src]')).filter(
    (script) => script.src.includes('googletagmanager.com'),
  );
}

describe('activar', () => {
  it('descarga el script de Google una sola vez, del dominio de Google y con el identificador', () => {
    activar(ID);
    activar(ID);

    const scripts = scriptsDeGoogle();

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
    expect(scripts[0]?.async).toBe(true);
    expect(estaCargado()).toBe(true);
  });

  it('antes de activar no hay nada: ni script, ni cola de datos', () => {
    expect(estaCargado()).toBe(false);
    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();
  });

  it('le pasa a Google objetos «arguments» y no arreglos: es lo unico que entiende', () => {
    activar(ID);

    expect(window.dataLayer?.length).toBeGreaterThan(0);

    for (const entrada of window.dataLayer ?? []) {
      expect(Object.prototype.toString.call(entrada)).toBe('[object Arguments]');
    }
  });

  it('configura solo la medicion: sin senales de Google, sin anuncios y sin visita automatica', () => {
    activar(ID);

    const configuracion = llamadasAGtag().find(([orden]) => orden === 'config');

    expect(configuracion?.[1]).toBe(ID);
    expect(configuracion?.[2]).toMatchObject({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: SEGUNDOS_DE_LA_COOKIE,
    });
  });

  it('niega todo el almacenamiento de anuncios y concede solo el de la medicion', () => {
    activar(ID);

    const consentimiento = llamadasAGtag().find(
      ([orden, accion]) => orden === 'consent' && accion === 'default',
    );

    expect(consentimiento?.[2]).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('las cookies duran 90 dias, no los dos anos de fabrica', () => {
    expect(SEGUNDOS_DE_LA_COOKIE).toBe(7_776_000);
  });

  it('las cookies no llevan Secure fuera de https (en local no se podrian poner)', () => {
    activar(ID);

    const configuracion = llamadasAGtag().find(([orden]) => orden === 'config');

    expect(window.location.protocol).toBe('http:');
    expect(configuracion?.[2]).toMatchObject({ cookie_flags: 'SameSite=Lax' });
  });

  it('el identificador viaja codificado: no puede cambiar la direccion del script', () => {
    activar('G-ABC&x=1');

    expect(scriptsDeGoogle()[0]?.src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-ABC%26x%3D1',
    );

    document.head.querySelector('script[data-vsd-analitica]')?.remove();
    delete window['ga-disable-G-ABC&x=1'];
  });

  it('reactivar despues de retirar no vuelve a descargar nada, solo le devuelve la voz', () => {
    activar(ID);
    retirar(ID);

    expect(window[`ga-disable-${ID}`]).toBe(true);

    activar(ID);

    expect(scriptsDeGoogle()).toHaveLength(1);
    expect(window[`ga-disable-${ID}`]).toBe(false);
    expect(llamadasAGtag().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  });
});

describe('enviarLaVisita', () => {
  it('manda la plantilla como direccion, ruta y titulo, nunca la direccion de la barra', () => {
    window.history.replaceState({}, '', '/actividad/abc-123?token=secreto#fragmento');
    activar(ID);

    enviarLaVisita('/actividad/:id');

    const visita = llamadasAGtag().find(
      ([orden, nombre]) => orden === 'event' && nombre === 'page_view',
    );

    expect(visita?.[2]).toMatchObject({
      page_location: `${window.location.origin}/actividad/:id`,
      page_path: '/actividad/:id',
      page_title: '/actividad/:id',
    });

    // Nada de lo que habia en la barra llega a Google, ni en la visita ni en el resto.
    const todo = JSON.stringify(llamadasAGtag());

    expect(todo).not.toContain('abc-123');
    expect(todo).not.toContain('secreto');
    expect(todo).not.toContain('fragmento');
  });

  it('del sitio de origen manda solo el origen, sin la ruta ni la busqueda', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://buscador.example/resultados?q=como+calmar+la+ansiedad',
      configurable: true,
    });
    activar(ID);

    enviarLaVisita('/');

    const visita = llamadasAGtag().find(
      ([orden, nombre]) => orden === 'event' && nombre === 'page_view',
    );

    expect(visita?.[2]).toMatchObject({ page_referrer: 'https://buscador.example' });
    expect(JSON.stringify(llamadasAGtag())).not.toContain('ansiedad');

    Reflect.deleteProperty(document, 'referrer');
  });

  it('si el origen es este mismo sitio (una recarga) no es una fuente de visitas: no se manda', () => {
    Object.defineProperty(document, 'referrer', {
      value: `${window.location.origin}/panel?algo=privado`,
      configurable: true,
    });
    activar(ID);

    enviarLaVisita('/');

    const visita = llamadasAGtag().find(
      ([orden, nombre]) => orden === 'event' && nombre === 'page_view',
    );

    expect(visita?.[2]).toMatchObject({ page_referrer: '' });
    expect(JSON.stringify(llamadasAGtag())).not.toContain('privado');

    Reflect.deleteProperty(document, 'referrer');
  });

  it('sin sitio de origen, o con uno ilegible, no manda nada', () => {
    activar(ID);

    for (const referente of ['', 'esto no es una direccion']) {
      Object.defineProperty(document, 'referrer', { value: referente, configurable: true });
      enviarLaVisita('/');
    }

    Reflect.deleteProperty(document, 'referrer');

    const visitas = llamadasAGtag().filter(
      ([orden, nombre]) => orden === 'event' && nombre === 'page_view',
    );

    expect(visitas).toHaveLength(2);

    for (const visita of visitas) {
      expect(visita[2]).toMatchObject({ page_referrer: '' });
    }
  });

  it('manda solo visitas: ningun otro evento ni parametro de mas', () => {
    activar(ID);
    enviarLaVisita('/panel');

    const eventos = llamadasAGtag().filter(([orden]) => orden === 'event');

    expect(eventos).toHaveLength(1);
    expect(Object.keys((eventos[0]?.[2] ?? {}) as Record<string, unknown>).sort()).toEqual([
      'page_location',
      'page_path',
      'page_referrer',
      'page_title',
    ]);
  });

  it('sin Google Analytics activado no hace nada ni falla', () => {
    expect(() => {
      enviarLaVisita('/panel');
    }).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe('retirar', () => {
  it('apaga el envio con la bandera oficial y le avisa a Google que ya no hay permiso', () => {
    activar(ID);
    retirar(ID);

    expect(window[`ga-disable-${ID}`]).toBe(true);
    expect(llamadasAGtag().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  });

  it('borra las cookies de Google Analytics y no las demas', () => {
    document.cookie = '_ga=GA1.1.123.456; Path=/';
    document.cookie = '_ga_TEST123456=GS1.1.789; Path=/';
    document.cookie = '_gid=GA1.1.1.1; Path=/';
    document.cookie = 'otra=conservar; Path=/';

    retirar(ID);

    expect(document.cookie).not.toContain('_ga');
    expect(document.cookie).not.toContain('_gid');
    expect(document.cookie).toContain('otra=conservar');
  });

  it('retirar sin haber activado no falla', () => {
    expect(() => {
      retirar(ID);
    }).not.toThrow();
    expect(window[`ga-disable-${ID}`]).toBe(true);
  });
});

describe('borrarLasCookies', () => {
  it('no toca las cookies de otro identificador de medicion', () => {
    document.cookie = '_ga_OTRO999999=GS1.1.1; Path=/';

    borrarLasCookies(ID);

    expect(document.cookie).toContain('_ga_OTRO999999');
  });
});
