import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from './clienteHttp.ts';
import { consultarLaRacha } from './racha.ts';

/**
 * La racha, comprobada sobre la peticion que sale (SCRUM-186).
 *
 * Como en `progreso.spec.ts`, se simula `fetch` y no el cliente HTTP.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

/** Lo que mandaba el servidor antes de SCRUM-242: solo los campos de siempre. */
const RACHA_DE_UN_SERVIDOR_VIEJO = {
  dias: 12,
  nivel: 1,
  hechoHoy: true,
  enDescanso: false,
  congelamientosUsados: 1,
  congelamientosPorMes: 3,
  diasCubiertos: ['2026-10-11'],
};

/** Lo que manda ahora: los de siempre mas la escalera, la semana y los congelamientos que quedan. */
const RACHA = {
  ...RACHA_DE_UN_SERVIDOR_VIEJO,
  congelamientosDisponibles: 2,
  proximoHito: 14,
  escalera: [
    { dias: 3, logrado: true },
    { dias: 7, logrado: true },
    { dias: 14, logrado: false },
    { dias: 30, logrado: false },
    { dias: 50, logrado: false },
  ],
  semana: [
    { dia: '2026-10-19', estado: 'hecho' },
    { dia: '2026-10-20', estado: 'cubierto' },
    { dia: '2026-10-21', estado: 'hecho' },
    { dia: '2026-10-22', estado: 'futuro' },
    { dia: '2026-10-23', estado: 'futuro' },
    { dia: '2026-10-24', estado: 'futuro' },
    { dia: '2026-10-25', estado: 'futuro' },
  ],
};

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RACHA)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('consultarLaRacha', () => {
  it('va por GET a la ruta de la racha, con el token', async () => {
    await consultarLaRacha();

    const [url, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];
    const peticion = new Request(url, opciones);

    expect(peticion.url).toBe('http://localhost:3000/api/racha');
    expect(peticion.method).toBe('GET');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('devuelve la racha tal cual la calcula el servidor', async () => {
    await expect(consultarLaRacha()).resolves.toEqual(RACHA);
  });

  describe('un servidor que todavia no manda los campos nuevos (SCRUM-243)', () => {
    it('no rompe nada: los campos que faltan salen vacios o se deducen', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(RACHA_DE_UN_SERVIDOR_VIEJO));

      await expect(consultarLaRacha()).resolves.toEqual({
        ...RACHA_DE_UN_SERVIDOR_VIEJO,
        // Se deducen de lo que si manda: 3 por mes menos 1 usado.
        congelamientosDisponibles: 2,
        // 0 quiere decir «no se sabe»: la pantalla no pinta la barra.
        proximoHito: 0,
        escalera: [],
        semana: [],
      });
    });

    it('con los usados de mas, no quedan menos de cero', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        respuesta({ ...RACHA_DE_UN_SERVIDOR_VIEJO, congelamientosUsados: 5 }),
      );

      expect((await consultarLaRacha()).congelamientosDisponibles).toBe(0);
    });

    it('un campo nuevo con una forma inesperada se trata como si no estuviera', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        respuesta({
          ...RACHA_DE_UN_SERVIDOR_VIEJO,
          congelamientosDisponibles: 'dos',
          proximoHito: '14',
          escalera: null,
          semana: 'lunes',
        }),
      );

      await expect(consultarLaRacha()).resolves.toMatchObject({
        congelamientosDisponibles: 2,
        proximoHito: 0,
        escalera: [],
        semana: [],
      });
    });
  });

  it('si la API falla, el error llega a quien llama', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ codigo: 'X', mensaje: 'x' }, 500));

    await expect(consultarLaRacha()).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});
