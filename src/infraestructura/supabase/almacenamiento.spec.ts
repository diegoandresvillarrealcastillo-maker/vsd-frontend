import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DE_LA_SESION,
  almacenamientoDeSesion,
  esSoloDeEstaPestana,
  leerLaSesionGuardada,
  olvidarPreferenciaDePestana,
  recordarEnEsteEquipo,
} from './almacenamiento.ts';

const CLAVE = 'vsd.sesion';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('donde se guarda la sesion', () => {
  it('con "recordar", el token va al almacen que sobrevive al navegador', () => {
    recordarEnEsteEquipo(true);
    almacenamientoDeSesion.setItem(CLAVE, 'token-de-prueba');

    expect(window.localStorage.getItem(CLAVE)).toBe('token-de-prueba');
    expect(window.sessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('sin "recordar", el token vive solo en la pestana', () => {
    // Es el caso de la sala de computo de la universidad: al cerrar la
    // pestana, la siguiente persona que se siente no encuentra nada.
    recordarEnEsteEquipo(false);
    almacenamientoDeSesion.setItem(CLAVE, 'token-de-prueba');

    expect(window.sessionStorage.getItem(CLAVE)).toBe('token-de-prueba');
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
  });

  it('cerrar la pestana se lleva la sesion, y no la del equipo recordado', () => {
    recordarEnEsteEquipo(false);
    almacenamientoDeSesion.setItem(CLAVE, 'token-de-la-pestana');

    // Cerrar la pestana es, para el navegador, vaciar sessionStorage.
    window.sessionStorage.clear();

    expect(almacenamientoDeSesion.getItem(CLAVE)).toBeNull();
    expect(esSoloDeEstaPestana()).toBe(false);
  });

  it('borrar limpia los dos almacenes', () => {
    // Cerrar sesion tiene que cerrarla de verdad. Dejar una copia en el
    // almacen que hoy no toca la resucitaria en la siguiente visita.
    window.localStorage.setItem(CLAVE, 'viejo');
    window.sessionStorage.setItem(CLAVE, 'nuevo');

    almacenamientoDeSesion.removeItem(CLAVE);

    expect(window.localStorage.getItem(CLAVE)).toBeNull();
    expect(window.sessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('no expulsa a quien marca "no recordar" teniendo ya sesion guardada', () => {
    // Sin el respaldo de lectura, la aplicacion daria la sesion por perdida en
    // el momento de marcar la casilla, y la persona saldria sin motivo.
    window.localStorage.setItem(CLAVE, 'sesion-que-ya-existia');
    recordarEnEsteEquipo(false);

    expect(almacenamientoDeSesion.getItem(CLAVE)).toBe('sesion-que-ya-existia');
  });

  it('olvidar la preferencia devuelve al almacen del equipo', () => {
    recordarEnEsteEquipo(false);
    expect(esSoloDeEstaPestana()).toBe(true);

    olvidarPreferenciaDePestana();

    expect(esSoloDeEstaPestana()).toBe(false);
  });
});

describe('cuando el navegador no deja guardar', () => {
  it('no rompe si el almacen lanza al escribir', () => {
    // Pasa en ventana privada y con los datos del sitio bloqueados. La sesion
    // durara lo que dure la pagina, que es peor experiencia pero no un fallo.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('acceso denegado', 'SecurityError');
    });

    expect(() => {
      recordarEnEsteEquipo(false);
      almacenamientoDeSesion.setItem(CLAVE, 'token-de-prueba');
    }).not.toThrow();
  });

  it('no rompe si el almacen lanza al leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('acceso denegado', 'SecurityError');
    });

    expect(almacenamientoDeSesion.getItem(CLAVE)).toBeNull();
  });
});

describe('leerLaSesionGuardada: quien es, sin renovar nada (SCRUM-137)', () => {
  const SESION = {
    access_token: 'token-vencido',
    refresh_token: 'refresco',
    expires_at: 1,
    token_type: 'bearer',
    user: { id: 'id-de-ana', email: 'ana@ejemplo.test' },
  };

  function guardar(valor: unknown, en: Storage = window.localStorage): void {
    en.setItem(CLAVE_DE_LA_SESION, typeof valor === 'string' ? valor : JSON.stringify(valor));
  }

  it('la clave es la del cliente de Supabase', () => {
    expect(CLAVE_DE_LA_SESION).toBe('vsd.sesion');
  });

  it('devuelve la sesion guardada aunque el token haya vencido: sirve para saber quien es', () => {
    guardar(SESION);

    expect(leerLaSesionGuardada()).toEqual(SESION);
  });

  it('la encuentra en el almacen de la pestana si la sesion no se recuerda', () => {
    recordarEnEsteEquipo(false);
    guardar(SESION, window.sessionStorage);

    expect(leerLaSesionGuardada()?.user.id).toBe('id-de-ana');
  });

  it('la encuentra en el otro almacen (el respaldo que ya tenia la lectura)', () => {
    recordarEnEsteEquipo(false);
    guardar(SESION, window.localStorage);

    expect(leerLaSesionGuardada()?.user.id).toBe('id-de-ana');
  });

  it('sin nada guardado, nulo', () => {
    expect(leerLaSesionGuardada()).toBeNull();
  });

  it.each([
    ['texto que no es JSON', 'esto no es json'],
    ['un numero', '7'],
    ['nulo', 'null'],
    ['una lista', '[]'],
    ['un objeto vacio', '{}'],
    ['sin usuario', { refresh_token: 'refresco' }],
    ['usuario que no es un objeto', { refresh_token: 'refresco', user: 'ana' }],
    ['usuario nulo', { refresh_token: 'refresco', user: null }],
    ['usuario sin identificador', { refresh_token: 'refresco', user: { email: 'a@b.c' } }],
    ['identificador vacio', { refresh_token: 'refresco', user: { id: '' } }],
    ['identificador que no es texto', { refresh_token: 'refresco', user: { id: 7 } }],
    ['sin token de refresco', { user: { id: 'id-de-ana' } }],
    ['token de refresco vacio', { refresh_token: '', user: { id: 'id-de-ana' } }],
    ['token de refresco que no es texto', { refresh_token: 9, user: { id: 'id-de-ana' } }],
  ])('no le cree a cualquier cosa: %s', (_nombre, valor) => {
    guardar(valor);

    expect(leerLaSesionGuardada()).toBeNull();
  });

  it('si el almacen falla, nulo y sin romper nada', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(leerLaSesionGuardada()).toBeNull();
  });
});
