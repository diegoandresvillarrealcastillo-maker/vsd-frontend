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

const RACHA = {
  dias: 12,
  nivel: 1,
  hechoHoy: true,
  enDescanso: false,
  congelamientosUsados: 1,
  congelamientosPorMes: 3,
  diasCubiertos: ['2026-10-11'],
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

  it('si la API falla, el error llega a quien llama', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ codigo: 'X', mensaje: 'x' }, 500));

    await expect(consultarLaRacha()).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});
