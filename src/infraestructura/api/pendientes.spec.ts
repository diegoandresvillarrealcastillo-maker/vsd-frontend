import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  borrarPendiente,
  consultarElSemaforo,
  crearPendiente,
  editarPendiente,
} from './pendientes.ts';

/**
 * El semaforo por HTTP, comprobado sobre la peticion que sale. Como en
 * `cuenta.spec.ts`, se simula `fetch` y no el cliente.
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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(respuesta({ pendientes: [], recordatorio: null })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('el semaforo por HTTP', () => {
  it('consulta con GET y el token', async () => {
    await expect(consultarElSemaforo()).resolves.toEqual({ pendientes: [], recordatorio: null });

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('GET');
    expect(peticion.url).toBe('http://localhost:3000/api/pendientes');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('crea con POST y la operacion del dispositivo', async () => {
    const cuerpo = {
      clientOperationId: '22222222-2222-4222-8222-222222222222',
      texto: 'Pedir cita',
      nivel: 'prioridad',
    } as const;

    await crearPendiente(cuerpo);

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('POST');
    await expect(peticion.json()).resolves.toEqual(cuerpo);
  });

  it('edita con PATCH solo lo que cambia', async () => {
    await editarPendiente('p 1', { hecho: true });

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('PATCH');
    expect(peticion.url).toBe('http://localhost:3000/api/pendientes/p%201');
    await expect(peticion.json()).resolves.toEqual({ hecho: true });
  });

  it('borra con DELETE, sin cuerpo que leer', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(null, 204));

    await expect(borrarPendiente('p-1')).resolves.toBeUndefined();

    expect(peticionEnviada().method).toBe('DELETE');
  });
});
