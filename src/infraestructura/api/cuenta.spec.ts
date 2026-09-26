import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from './clienteHttp.ts';
import { consultarLaCuentaPropia, darDeAltaLaCuenta } from './cuenta.ts';

/**
 * El alta y la consulta de cuenta, comprobadas sobre la peticion que sale.
 *
 * Se simula `fetch` y no el cliente HTTP a proposito: lo que importa de estos
 * modulos es **la peticion que acaba viajando** —su metodo, su ruta, su cuerpo
 * y su cabecera de autorizacion—, y simular el cliente dejaria justo eso sin
 * comprobar.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

const CUENTA = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'alguien@ucundinamarca.edu.co',
  rol: 'usuario',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T10:00:00.000Z' },
  registradoEn: '2026-09-26T10:00:00.000Z',
};

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** La peticion que recibio `fetch`, para poder interrogarla. */
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(CUENTA)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('darDeAltaLaCuenta', () => {
  it('va por POST a la ruta de cuenta', async () => {
    await darDeAltaLaCuenta('2026-09-1');

    const enviada = peticionEnviada();

    expect(enviada.method).toBe('POST');
    expect(enviada.url).toBe('http://localhost:3000/api/cuenta');
  });

  it('manda la version del aviso, y nada mas', async () => {
    await darDeAltaLaCuenta('2026-09-1');

    const cuerpo = (await peticionEnviada().json()) as Record<string, unknown>;

    expect(cuerpo).toEqual({ versionPolitica: '2026-09-1' });

    // Lo que NO va es la parte que importa. El correo y la identidad salen del
    // token que verifica la API, y el rol lo fija ella: mandar `rol` aqui seria
    // pedir una escalada de privilegios, y la API responderia 400 por campo no
    // declarado. Que este modulo no lo envie nunca es la primera barrera.
    expect(Object.keys(cuerpo)).not.toContain('rol');
    expect(Object.keys(cuerpo)).not.toContain('correo');
    expect(Object.keys(cuerpo)).not.toContain('idUsuario');
  });

  it('lleva el token en la cabecera de autorizacion', async () => {
    await darDeAltaLaCuenta('2026-09-1');

    expect(peticionEnviada().headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('devuelve la cuenta que responde la API', async () => {
    const cuenta = await darDeAltaLaCuenta('2026-09-1');

    expect(cuenta.correo).toBe('alguien@ucundinamarca.edu.co');
    expect(cuenta.rol).toBe('usuario');
    expect(cuenta.consentimiento.versionPolitica).toBe('2026-09-1');
  });

  it('el conflicto de correo llega con su estado, para poder explicarlo', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'CORREO_YA_REGISTRADO', mensaje: 'Ese correo ya...' }, 409),
    );

    // Se comprueba el estado y no el texto: el texto puede cambiar sin avisar,
    // el estado es parte del contrato. La pantalla decide por el.
    await expect(darDeAltaLaCuenta('2026-09-1')).rejects.toMatchObject({ estado: 409 });
    await expect(darDeAltaLaCuenta('2026-09-1')).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});

describe('consultarLaCuentaPropia', () => {
  it('va por GET y sin cuerpo', async () => {
    await consultarLaCuentaPropia();

    const enviada = peticionEnviada();

    expect(enviada.method).toBe('GET');
    expect(enviada.url).toBe('http://localhost:3000/api/cuenta');
    expect(enviada.body).toBeNull();
  });

  it('devuelve la cuenta propia', async () => {
    const cuenta = await consultarLaCuentaPropia();

    expect(cuenta.id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('un 403 llega con su estado: hay sesion pero todavia no hay cuenta', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'CUENTA_NO_REGISTRADA', mensaje: 'Todavia no tienes...' }, 403),
    );

    // Es el caso de consultar antes de darse de alta. Se distingue del 401 a
    // proposito: el token es autentico, lo que falta es la cuenta.
    await expect(consultarLaCuentaPropia()).rejects.toMatchObject({ estado: 403 });
  });
});
