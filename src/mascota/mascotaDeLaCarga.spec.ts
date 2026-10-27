import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DE_LA_MASCOTA_DE_LA_CARGA,
  olvidarLaMascotaDeLaCarga,
  recordarLaMascotaDeLaCarga,
} from './mascotaDeLaCarga.ts';
import HTML from '../../index.html?raw';
import { PERSONAJE_POR_DEFECTO, PERSONAJES_EN_ORDEN } from './personajes.ts';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.mascota;
  vi.restoreAllMocks();
});

describe('la mascota de la pantalla de carga (SCRUM-283)', () => {
  it('recuerda la mascota de la cuenta y la pone en el documento', () => {
    recordarLaMascotaDeLaCarga('ori');

    expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBe('ori');
    expect(document.documentElement.dataset.mascota).toBe('ori');
  });

  it.each(['propia', 'trama', '', undefined])(
    'con la forma %s se queda con la de siempre, que es la que tiene archivo a tiempo',
    (forma) => {
      recordarLaMascotaDeLaCarga(forma);

      expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBe('fungito');
      expect(document.documentElement.dataset.mascota).toBe('fungito');
    },
  );

  it('al cerrar la sesion no deja la mascota de quien salio', () => {
    recordarLaMascotaDeLaCarga('gato');

    olvidarLaMascotaDeLaCarga();

    expect(localStorage.getItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA)).toBeNull();
    expect(document.documentElement.dataset.mascota).toBe('fungito');
  });

  it('si el navegador no deja guardar, la pantalla sigue (navegacion privada)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    expect(() => recordarLaMascotaDeLaCarga('sparky')).not.toThrow();
    expect(() => olvidarLaMascotaDeLaCarga()).not.toThrow();
  });
});

describe('el index.html y la mascota de la carga van de la mano', () => {
  it('lee la misma clave que escribe este modulo', () => {
    expect(HTML).toContain(`'${CLAVE_DE_LA_MASCOTA_DE_LA_CARGA}'`);
  });

  it.each(PERSONAJES_EN_ORDEN)('conoce a %s: la acepta y le dibuja su archivo', (personaje) => {
    // La lista de formas que el script acepta.
    expect(HTML).toMatch(new RegExp(String.raw`['"]?${personaje}['"]?\s*:\s*1`));
    // Y su archivo existe en los estilos. Fungito es el de siempre: va sin condicion.
    expect(HTML).toContain(`/mascotas/${personaje}.webp`);

    if (personaje !== PERSONAJE_POR_DEFECTO) {
      expect(HTML).toContain(`[data-mascota='${personaje}']`);
    }
  });
});
