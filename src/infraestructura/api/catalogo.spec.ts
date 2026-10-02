import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { traerElCatalogo } from './catalogo.ts';

/**
 * El catalogo, comprobado sobre la peticion que sale.
 *
 * Lo que distingue a esta ruta de las demas es que es **publica**: funciona sin
 * sesion. Esa es la comprobacion que de verdad importa aqui, porque de ella
 * depende que la portada pueda ensenar lo que ofrece la aplicacion antes de
 * que nadie se registre.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

const CATALOGO = [
  {
    id: '0cat0000-0000-4000-8000-000000000001',
    nombre: 'Cognición',
    descripcion: 'Ejercicios breves de memoria, atención y concentración.',
    actividades: [
      {
        id: '0acd0000-0000-4000-8000-000000000001',
        nombre: 'Parejas de cartas',
        tipo: 'juego',
        descripcion: 'Encuentra las parejas iguales.',
        produceNivel: true,
      },
    ],
  },
];

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(CATALOGO)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('traerElCatalogo', () => {
  it('va por GET a la ruta del catalogo', async () => {
    await traerElCatalogo();

    const enviada = peticionEnviada();

    expect(enviada.method).toBe('GET');
    expect(enviada.url).toBe('http://localhost:3000/api/catalogo');
  });

  it('funciona sin sesion, porque la ruta es publica', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const catalogo = await traerElCatalogo();

    expect(catalogo).toHaveLength(1);
    expect(peticionEnviada().headers.get('Authorization')).toBeNull();
  });

  it('conserva las categorias con sus actividades dentro', async () => {
    const catalogo = await traerElCatalogo();
    const [categoria] = catalogo;

    expect(categoria?.nombre).toBe('Cognición');
    expect(categoria?.actividades).toHaveLength(1);
    expect(categoria?.actividades.map((actividad) => actividad.nombre)).toEqual([
      'Parejas de cartas',
    ]);
  });

  it('no recibe el puntaje maximo ni los cortes de nivel', async () => {
    const catalogo = await traerElCatalogo();
    const [categoria] = catalogo;
    const [actividad] = categoria?.actividades ?? [];

    // El catalogo sirve para elegir, no para interpretar. Si el cliente
    // conociera el maximo y los umbrales podria calcular el nivel por su
    // cuenta, y entonces habria dos interpretaciones del mismo dato.
    expect(actividad).not.toHaveProperty('puntajeMaximo');
    expect(actividad).not.toHaveProperty('umbrales');
    expect(actividad).not.toHaveProperty('textosNivel');

    // Lo unico que si hace falta saber de antemano, porque cambia la pantalla.
    expect(actividad?.produceNivel).toBe(true);
  });
});
