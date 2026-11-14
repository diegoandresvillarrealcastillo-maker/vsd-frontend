import { beforeEach, describe, expect, it, vi } from 'vitest';

import { leerSiCambio } from './clienteHttp.ts';
import {
  ESQUEMA_QUE_ENTIENDE_LA_APLICACION,
  RUTA_DE_LAS_REGLAS_LOCALES,
  consultarLasReglasLocales,
} from './reglasLocales.ts';

vi.mock('./clienteHttp.ts', () => ({ leerSiCambio: vi.fn() }));

const leer = vi.mocked(leerSiCambio);

beforeEach(() => {
  leer.mockReset();
  leer.mockResolvedValue({ estado: 'sin_cambios' });
});

describe('consultarLasReglasLocales (SCRUM-141)', () => {
  it('lee la ruta publica de las reglas, que el servidor publica para esto', async () => {
    await consultarLasReglasLocales(null);

    expect(RUTA_DE_LAS_REGLAS_LOCALES).toBe('/api/asistente/reglas-locales');
    expect(leer).toHaveBeenCalledWith('/api/asistente/reglas-locales', { etag: null });
  });

  it('manda el ETag de la copia para no bajar lo que no cambio', async () => {
    await consultarLasReglasLocales('W/"abc"');

    expect(leer).toHaveBeenCalledWith(RUTA_DE_LAS_REGLAS_LOCALES, { etag: 'W/"abc"' });
  });

  it('pasa la senal de cancelacion, y solo si hay', async () => {
    const control = new AbortController();

    await consultarLasReglasLocales(null, control.signal);
    await consultarLasReglasLocales(null);

    expect(leer).toHaveBeenNthCalledWith(1, RUTA_DE_LAS_REGLAS_LOCALES, {
      etag: null,
      senal: control.signal,
    });
    expect(leer).toHaveBeenNthCalledWith(2, RUTA_DE_LAS_REGLAS_LOCALES, { etag: null });
  });

  it('sin senal, ni siquiera lleva la clave', async () => {
    await consultarLasReglasLocales('W/"1"');

    expect(leer.mock.calls[0]?.[1]).toStrictEqual({ etag: 'W/"1"' });
  });

  it('devuelve lo que responde la lectura condicional, tal cual', async () => {
    leer.mockResolvedValue({ estado: 'sin_cambios' });

    expect(await consultarLasReglasLocales('W/"1"')).toEqual({ estado: 'sin_cambios' });
  });

  it('conoce el esquema 1: el que publica el servidor hoy', () => {
    expect(ESQUEMA_QUE_ENTIENDE_LA_APLICACION).toBe(1);
  });
});
