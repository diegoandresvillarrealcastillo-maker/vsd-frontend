import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import contratoJson from '../asistente/contrato/reglas-locales.json';
import { ErrorDeLaApi, leerSiCambio } from '../infraestructura/api/clienteHttp.ts';
import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import {
  CLAVE_DE_LAS_REGLAS_LOCALES,
  leerLasReglasLocalesConCopia,
  leerLasReglasLocalesGuardadas,
  precargarLasReglasLocales,
} from './reglasLocalesLocal.ts';

// El resto del cliente (el tipo de error que reconoce `clasificarFallo`) es el de verdad.
vi.mock('../infraestructura/api/clienteHttp.ts', async (original) => ({
  ...(await original<typeof import('../infraestructura/api/clienteHttp.ts')>()),
  leerSiCambio: vi.fn(),
}));

/** El paquete de verdad, el que publica el servidor. */
const PAQUETE = (contratoJson as unknown as { paquete: ReglasLocales }).paquete;
const DE_OTRA_VERSION = { ...PAQUETE, esquema: 2 };

const leer = vi.mocked(leerSiCambio);
const SIN_RED = new TypeError('Failed to fetch');
const RUTA = '/api/asistente/reglas-locales';

async function guardarALaFuerza(valor: unknown) {
  await cicloActual()?.almacen.guardarLectura(
    CLAVE_DE_LAS_REGLAS_LOCALES,
    { valor, etag: 'W/"viejo"' },
    new Date(),
  );
}

beforeEach(async () => {
  leer.mockReset();
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', { persistente: false });
});

afterEach(() => {
  reiniciarElCicloParaLasPruebas();
});

describe('leerLasReglasLocalesConCopia (SCRUM-141)', () => {
  it('la copia se guarda bajo una clave propia, que no se comparte con otra lectura', () => {
    expect(CLAVE_DE_LAS_REGLAS_LOCALES).toBe('asistente-reglas-locales');
  });

  it('pide las reglas a la ruta publica, sin ETag la primera vez', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });

    const lectura = await leerLasReglasLocalesConCopia();

    expect(lectura.valor).toEqual(PAQUETE);
    expect(lectura.deLaCopia).toBe(false);
    expect(leer).toHaveBeenCalledWith(RUTA, { etag: null });
  });

  it('pasa la senal de cancelacion a la lectura', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: PAQUETE, etag: null });

    const control = new AbortController();

    await leerLasReglasLocalesConCopia(control.signal);

    expect(leer).toHaveBeenCalledWith(RUTA, { etag: null, senal: control.signal });
  });

  it('la segunda vez manda el ETag de la copia, y si no cambio usa la copia sin bajar nada', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
    await leerLasReglasLocalesConCopia();
    leer.mockResolvedValueOnce({ estado: 'sin_cambios' });

    const lectura = await leerLasReglasLocalesConCopia();

    expect(leer).toHaveBeenLastCalledWith(RUTA, { etag: 'W/"1"' });
    expect(lectura.valor).toEqual(PAQUETE);
    expect(lectura.deLaCopia).toBe(false);
  });

  it('SIN CONEXION usa la copia, y dice que lo es: esto es lo que hace falta', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
    await leerLasReglasLocalesConCopia();
    leer.mockRejectedValueOnce(SIN_RED);

    const lectura = await leerLasReglasLocalesConCopia();

    expect(lectura.valor).toEqual(PAQUETE);
    expect(lectura.deLaCopia).toBe(true);
    expect(lectura.guardadoEn).not.toBeNull();
  });

  it('sin conexion y sin copia no hay nada que devolver: nunca se inventan reglas', async () => {
    leer.mockRejectedValue(SIN_RED);

    await expect(leerLasReglasLocalesConCopia()).rejects.toBeInstanceOf(TypeError);
  });

  it('lo nuevo reemplaza a lo viejo', async () => {
    const otraVez = {
      ...PAQUETE,
      riesgo: { ...PAQUETE.riesgo, mensaje: 'Otro mensaje.' },
    };

    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
    await leerLasReglasLocalesConCopia();
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: otraVez, etag: 'W/"2"' });

    const lectura = await leerLasReglasLocalesConCopia();

    expect(lectura.valor.riesgo.mensaje).toBe('Otro mensaje.');
    expect((await leerLasReglasLocalesGuardadas())?.riesgo.mensaje).toBe('Otro mensaje.');
  });

  describe('un paquete que esta aplicacion no entiende', () => {
    it('de otro esquema, no se usa ni se guarda: se sigue con la copia', async () => {
      leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
      await leerLasReglasLocalesConCopia();
      leer.mockResolvedValueOnce({ estado: 'nuevo', valor: DE_OTRA_VERSION, etag: 'W/"2"' });

      const lectura = await leerLasReglasLocalesConCopia();

      expect(lectura.valor.esquema).toBe(1);
      expect(lectura.valor).toEqual(PAQUETE);
      // Y lo guardado sigue siendo lo que se entiende, con su ETag de antes.
      expect((await leerLasReglasLocalesGuardadas())?.esquema).toBe(1);
      leer.mockResolvedValueOnce({ estado: 'sin_cambios' });
      await leerLasReglasLocalesConCopia();
      expect(leer).toHaveBeenLastCalledWith(RUTA, { etag: 'W/"1"' });
    });

    it('de otro esquema y sin copia, no hay reglas: falla en lugar de aplicarlo', async () => {
      leer.mockResolvedValue({ estado: 'nuevo', valor: DE_OTRA_VERSION, etag: 'W/"2"' });

      await expect(leerLasReglasLocalesConCopia()).rejects.toThrow();
      expect(await leerLasReglasLocalesGuardadas()).toBeNull();
    });

    it('incompleto (le falta algo que el motor usa), tampoco se guarda', async () => {
      leer.mockResolvedValue({
        estado: 'nuevo',
        valor: { ...PAQUETE, riesgo: undefined } as unknown as ReglasLocales,
        etag: null,
      });

      await expect(leerLasReglasLocalesConCopia()).rejects.toThrow();
      expect(await leerLasReglasLocalesGuardadas()).toBeNull();
    });

    it('una copia guardada por otra version de la aplicacion es como no tenerla', async () => {
      await guardarALaFuerza(DE_OTRA_VERSION);
      leer.mockRejectedValue(SIN_RED);

      await expect(leerLasReglasLocalesConCopia()).rejects.toThrow(
        'Las reglas guardadas no se pueden leer.',
      );
    });

    it('pero si el servidor manda algo que se entiende, ese es el que vale', async () => {
      await guardarALaFuerza(DE_OTRA_VERSION);
      leer.mockResolvedValue({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"3"' });

      const lectura = await leerLasReglasLocalesConCopia();

      expect(lectura.valor).toEqual(PAQUETE);
      expect((await leerLasReglasLocalesGuardadas())?.esquema).toBe(1);
    });
  });

  it('una lectura cancelada no devuelve la copia: quien la cancelo ya no espera nada', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
    await leerLasReglasLocalesConCopia();

    const control = new AbortController();

    leer.mockImplementationOnce(() => {
      control.abort();

      return Promise.reject(SIN_RED);
    });

    // Sin la senal, esto se tomaria por "no hay conexion" y se devolveria la copia.
    await expect(leerLasReglasLocalesConCopia(control.signal)).rejects.toBe(SIN_RED);
  });

  it('un error del servidor sale tal cual, aunque haya copia: la copia no lo tapa', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
    await leerLasReglasLocalesConCopia();
    leer.mockRejectedValueOnce(new ErrorDeLaApi(403, 'No', undefined, 'SIN_PERMISO'));

    await expect(leerLasReglasLocalesConCopia()).rejects.toMatchObject({ estado: 403 });
  });
});

describe('leerLasReglasLocalesGuardadas', () => {
  it('sin nada guardado, nulo', async () => {
    expect(await leerLasReglasLocalesGuardadas()).toBeNull();
  });

  it('devuelve lo guardado sin preguntar a nadie', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });
    await leerLasReglasLocalesConCopia();
    leer.mockClear();

    expect(await leerLasReglasLocalesGuardadas()).toEqual(PAQUETE);
    expect(leer).not.toHaveBeenCalled();
  });

  it.each([
    ['de otro esquema', DE_OTRA_VERSION],
    ['con otra forma', 'texto'],
    ['sin riesgo', { ...PAQUETE, riesgo: null }],
  ])('lo guardado %s es como no tenerlo', async (_nombre, valor) => {
    await guardarALaFuerza(valor);

    expect(await leerLasReglasLocalesGuardadas()).toBeNull();
  });

  it('sin almacen abierto, nulo y sin fallar', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLasReglasLocalesGuardadas()).toBeNull();
  });
});

describe('precargarLasReglasLocales', () => {
  it('las lee para dejarlas guardadas', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: PAQUETE, etag: 'W/"1"' });

    await precargarLasReglasLocales();

    expect(await leerLasReglasLocalesGuardadas()).toEqual(PAQUETE);
  });
});
