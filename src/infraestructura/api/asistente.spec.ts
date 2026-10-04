import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { preguntarAlAsistente } from './asistente.ts';

/**
 * VSD IA por HTTP, comprobado sobre la peticion que sale. Como en
 * `cuenta.spec.ts`, se simula `fetch` y no el cliente.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

const RESPUESTA = {
  intencion: 'no_reconocida',
  mensaje: 'No estoy seguro de haberte entendido.',
  recursos: [],
  senalDeRiesgo: false,
  incluyeLineasDeAtencion: false,
};

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(RESPUESTA), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('preguntarAlAsistente', () => {
  it('va por POST con solo el texto y el token', async () => {
    await expect(preguntarAlAsistente('hola')).resolves.toEqual(RESPUESTA);

    const [url, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];
    const peticion = new Request(url, opciones);

    expect(peticion.method).toBe('POST');
    expect(peticion.url).toBe('http://localhost:3000/api/asistente');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    // Quien pregunta sale del token, nunca del cuerpo.
    await expect(peticion.json()).resolves.toEqual({ texto: 'hola' });
  });

  it('pasa la senal para poder dejar de esperar', async () => {
    const control = new AbortController();

    await preguntarAlAsistente('hola', control.signal);

    const [, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];

    expect(opciones.signal).toBe(control.signal);
  });
});
