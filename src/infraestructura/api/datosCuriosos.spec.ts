import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from './clienteHttp.ts';
import { consultarElDatoDeHoy } from './datosCuriosos.ts';

/**
 * El dato curioso del dia, comprobado sobre la peticion que sale (SCRUM-185).
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

const DEL_DIA = {
  dia: '2026-10-13',
  dato: {
    id: 'd0000000-0000-4000-8000-000000000001',
    texto: 'Los pulpos tienen tres corazones.',
    tema: 'animales',
  },
};

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(DEL_DIA)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('consultarElDatoDeHoy', () => {
  it('va por GET a la ruta del dato de hoy, con el token', async () => {
    await consultarElDatoDeHoy();

    const [url, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];
    const peticion = new Request(url, opciones);

    expect(peticion.url).toBe('http://localhost:3000/api/datos-curiosos/hoy');
    expect(peticion.method).toBe('GET');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('devuelve el dato tal cual lo elige el servidor', async () => {
    await expect(consultarElDatoDeHoy()).resolves.toEqual(DEL_DIA);
  });

  it('acepta que todavia no haya ninguno publicado', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ dia: '2026-10-13', dato: null }));

    await expect(consultarElDatoDeHoy()).resolves.toEqual({ dia: '2026-10-13', dato: null });
  });

  it('si la API falla, el error llega a quien llama', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ codigo: 'X', mensaje: 'x' }, 500));

    await expect(consultarElDatoDeHoy()).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});
