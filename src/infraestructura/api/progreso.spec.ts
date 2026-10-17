import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from './clienteHttp.ts';
import { consultarElProgreso } from './progreso.ts';

/**
 * El progreso por modulo, comprobado sobre la peticion que sale.
 *
 * Como en `cuenta.spec.ts`, se simula `fetch` y no el cliente HTTP.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

const PROGRESO = [
  {
    modulo: 'cognicion',
    sesiones: 1,
    etapa: { numero: 1, esTemporada: false, sesionesHechas: 1, sesionesDeLaEtapa: 5 },
    hoy: [{ id: 'a', nombre: 'Parejas', hecha: true }],
  },
];

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(PROGRESO)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('consultarElProgreso', () => {
  it('va por GET a la ruta de progreso, con el token', async () => {
    await consultarElProgreso();

    const [url, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];
    const peticion = new Request(url, opciones);

    expect(peticion.url).toBe('http://localhost:3000/api/progreso');
    expect(peticion.method).toBe('GET');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('devuelve el motor y la sesion del dia de una actividad, tal cual (SCRUM-205 y SCRUM-208)', async () => {
    const conSesion = [
      {
        ...PROGRESO[0],
        hoy: [
          {
            id: 'a',
            nombre: 'Secuencia de números',
            hecha: false,
            frecuencia: { tipo: 'rotativa' },
            motor: 'secuencia',
            sesion: {
              id: 's-1',
              titulo: 'Secuencia de números, versión original',
              nivel: 1,
              parametros: { rondas: 12 },
            },
          },
        ],
      },
    ];

    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(conSesion));

    const progreso = await consultarElProgreso();
    const actividad = progreso[0]?.hoy[0];

    expect(actividad?.motor).toBe('secuencia');
    expect(actividad?.sesion).toEqual({
      id: 's-1',
      titulo: 'Secuencia de números, versión original',
      nivel: 1,
      parametros: { rondas: 12 },
    });
    expect(actividad?.frecuencia).toEqual({ tipo: 'rotativa' });
  });

  it('devuelve el progreso tal cual lo calcula el servidor', async () => {
    await expect(consultarElProgreso()).resolves.toEqual(PROGRESO);
  });

  it('si la API falla, el error llega a quien llama', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ codigo: 'X', mensaje: 'x' }, 500));

    await expect(consultarElProgreso()).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});
