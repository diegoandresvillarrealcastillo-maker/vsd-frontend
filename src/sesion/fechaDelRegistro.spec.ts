import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DE_LA_FECHA_DEL_REGISTRO,
  guardarLaFechaDelRegistro,
  leerLaFechaDelRegistro,
  olvidarLaFechaDelRegistro,
  VIGENCIA_DE_LA_FECHA_DEL_REGISTRO_EN_MS,
} from './fechaDelRegistro.ts';

/**
 * La fecha de nacimiento que se escribe al crear la cuenta (SCRUM-189, D4).
 *
 * Se guarda **en el dispositivo** y no en Supabase (ADR 0021) para no pedirla otra vez al entrar
 * por primera vez. Lo que se vigila: que sea de **un solo correo**, que **caduque**, que **nunca
 * guarde a un menor** ni algo que no sea una fecha, y que si el almacenamiento falla no pase nada.
 */
const CORREO = 'ana@ejemplo.test';
const ADULTO = '1998-03-14';
const AHORA = Date.parse('2026-10-13T12:00:00.000Z');

beforeEach(() => {
  olvidarLaFechaDelRegistro();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('la fecha del registro', () => {
  it('se guarda y se lee para el mismo correo', () => {
    guardarLaFechaDelRegistro(CORREO, ADULTO, AHORA);

    expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBe(ADULTO);
  });

  it('el correo no distingue mayusculas ni espacios, como en el acceso', () => {
    guardarLaFechaDelRegistro('  Ana@Ejemplo.TEST ', ADULTO, AHORA);

    expect(leerLaFechaDelRegistro('ana@ejemplo.test', AHORA)).toBe(ADULTO);
  });

  it('es de un solo correo: otra persona en el mismo equipo no la hereda', () => {
    guardarLaFechaDelRegistro(CORREO, ADULTO, AHORA);

    expect(leerLaFechaDelRegistro('otra@ejemplo.test', AHORA)).toBeNull();
    expect(leerLaFechaDelRegistro(undefined, AHORA)).toBeNull();
  });

  it('se olvida: despues de olvidarla ya no esta', () => {
    guardarLaFechaDelRegistro(CORREO, ADULTO, AHORA);
    olvidarLaFechaDelRegistro();

    expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBeNull();
    expect(localStorage.getItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO)).toBeNull();
  });

  it('caduca: pasados los dias de vigencia no se lee y se borra del dispositivo', () => {
    guardarLaFechaDelRegistro(CORREO, ADULTO, AHORA);

    expect(
      leerLaFechaDelRegistro(CORREO, AHORA + VIGENCIA_DE_LA_FECHA_DEL_REGISTRO_EN_MS - 1),
    ).toBe(ADULTO);
    expect(
      leerLaFechaDelRegistro(CORREO, AHORA + VIGENCIA_DE_LA_FECHA_DEL_REGISTRO_EN_MS),
    ).toBeNull();
    expect(localStorage.getItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO)).toBeNull();
  });

  it('vigencia: tres dias, lo que tarda razonablemente en abrirse un enlace de confirmacion', () => {
    expect(VIGENCIA_DE_LA_FECHA_DEL_REGISTRO_EN_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('un menor nunca se guarda: lo que no es de un mayor no queda en el dispositivo', () => {
    guardarLaFechaDelRegistro(CORREO, '2015-05-05', AHORA);

    expect(localStorage.getItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO)).toBeNull();
    expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBeNull();
  });

  it.each(['', 'ayer', '2026-02-30', '2999-01-01', '14/03/1998'])(
    'lo que no es una fecha real y pasada (%j) no se guarda',
    (basura) => {
      guardarLaFechaDelRegistro(CORREO, basura, AHORA);

      expect(localStorage.getItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO)).toBeNull();
    },
  );

  it('el 29 de febrero se trata bien', () => {
    guardarLaFechaDelRegistro(CORREO, '2000-02-29', AHORA);

    expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBe('2000-02-29');
  });

  it('lo que haya en el almacenamiento y no sea lo esperado se ignora y se borra', () => {
    for (const roto of [
      'no es json',
      '[]',
      'null',
      JSON.stringify({ correo: CORREO }),
      JSON.stringify({ correo: CORREO, fecha: '2015-05-05', guardadaEn: AHORA }),
      JSON.stringify({ correo: CORREO, fecha: ADULTO, guardadaEn: 'ayer' }),
    ]) {
      localStorage.setItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO, roto);

      expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBeNull();
      expect(localStorage.getItem(CLAVE_DE_LA_FECHA_DEL_REGISTRO)).toBeNull();
    }
  });

  it('solo hay una: guardar la de otra persona reemplaza a la anterior', () => {
    guardarLaFechaDelRegistro(CORREO, ADULTO, AHORA);
    guardarLaFechaDelRegistro('otra@ejemplo.test', '1990-01-01', AHORA);

    expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBeNull();
    expect(leerLaFechaDelRegistro('otra@ejemplo.test', AHORA)).toBe('1990-01-01');
  });

  it('si el almacenamiento falla (modo privado, sin espacio) no pasa nada', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    expect(() => {
      guardarLaFechaDelRegistro(CORREO, ADULTO, AHORA);
    }).not.toThrow();
    expect(leerLaFechaDelRegistro(CORREO, AHORA)).toBeNull();
    expect(() => {
      olvidarLaFechaDelRegistro();
    }).not.toThrow();
  });
});
