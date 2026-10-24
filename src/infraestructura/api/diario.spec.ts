import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { abrirCarta, borrarAnotacion, consultarCartasEnEspera } from './diario.ts';

/**
 * La carta a mi de manana por HTTP (SCRUM-230), comprobada sobre la peticion que sale. Como en
 * `pendientes.spec.ts`, se simula `fetch` y no el cliente.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(estado === 204 ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

function peticionEnviada(): Request {
  const llamada = vi.mocked(globalThis.fetch).mock.calls[0];

  if (!llamada) {
    throw new Error('No se llamo a fetch.');
  }

  const [url, opciones] = llamada as [string, RequestInit];

  return new Request(url, opciones);
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta([])));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('la carta a mi de manana por HTTP (SCRUM-230)', () => {
  it('pide las cartas que esperan con GET y el token', async () => {
    const cartas = [{ id: 'c-1', dia: '2026-10-23' }];

    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(cartas));

    await expect(consultarCartasEnEspera()).resolves.toEqual(cartas);

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('GET');
    expect(peticion.url).toBe('http://localhost:3000/api/diario/cartas-en-espera');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('abre una carta con POST, sin cuerpo, y devuelve la anotacion con su texto', async () => {
    const carta = { id: 'c 1', dia: '2026-10-23', carta: true, sellada: false };

    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(carta));

    await expect(abrirCarta('c 1')).resolves.toEqual(carta);

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('POST');
    // El identificador va escapado: es lo que viaja en la ruta.
    expect(peticion.url).toBe('http://localhost:3000/api/diario/c%201/abrir');
    await expect(peticion.text()).resolves.toBe('');
  });

  it('borra con DELETE, sin cuerpo que leer ni que mandar', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(null, 204));

    await expect(borrarAnotacion('c-1')).resolves.toBeUndefined();

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('DELETE');
    expect(peticion.url).toBe('http://localhost:3000/api/diario/c-1');
    await expect(peticion.text()).resolves.toBe('');
  });
});
