import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  almacenamientoDeSesion,
  esSoloDeEstaPestana,
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
