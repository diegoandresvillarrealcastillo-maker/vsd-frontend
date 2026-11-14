import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { consultarLaVersionDelAviso } from './aviso.ts';
import { ErrorDeLaApi } from './clienteHttp.ts';

/**
 * La version vigente del aviso, comprobada sobre la peticion que sale.
 *
 * Como en `cuenta.spec.ts`, se simula `fetch` y no el cliente HTTP: lo que
 * importa es a donde va la peticion y que se hace con lo que vuelve.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: null } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ version: 'version-de-la-api' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('consultarLaVersionDelAviso', () => {
  it('va a la ruta del aviso', async () => {
    await consultarLaVersionDelAviso();

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];

    expect(url).toBe('http://localhost:3000/api/aviso');
  });

  it('devuelve la version tal cual la dice la API', async () => {
    // El valor de la prueba es inventado a proposito: el frontend no conoce
    // ninguna version por su cuenta, y si devolviera otra cosa que la de la
    // API esta prueba fallaria.
    await expect(consultarLaVersionDelAviso()).resolves.toBe('version-de-la-api');
  });

  it('funciona sin sesion, porque se necesita antes de crear la cuenta', async () => {
    await expect(consultarLaVersionDelAviso()).resolves.toBe('version-de-la-api');
  });

  it('si la API falla, el error llega a quien llama', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ codigo: 'X', mensaje: 'x' }, 500));

    await expect(consultarLaVersionDelAviso()).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});
