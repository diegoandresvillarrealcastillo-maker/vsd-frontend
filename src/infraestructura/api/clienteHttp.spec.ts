import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi, llamarALaApi } from './clienteHttp.ts';

/**
 * El cliente HTTP, comprobado sobre respuestas de verdad.
 *
 * Lo que mas se comprueba aqui no es el camino de exito, sino el de los fallos:
 * es donde un cliente puede romperse mientras informa de que algo se rompio, y
 * entonces el segundo error tapa al primero.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));

function respuesta(
  cuerpo: unknown,
  estado = 200,
  cabeceras: Record<string, string> = {},
): Response {
  return new Response(estado === 204 ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json', ...cabeceras },
  });
}

/** Una respuesta que no viene de nuestra API: un proxy, por ejemplo. */
function respuestaEnBruto(texto: string, estado: number, tipo = 'text/html'): Response {
  return new Response(texto, { status: estado, headers: { 'Content-Type': tipo } });
}

function cuandoLaApiResponde(valor: Response): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(valor));
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('llamarALaApi, cuando todo va bien', () => {
  it('devuelve el cuerpo ya interpretado', async () => {
    cuandoLaApiResponde(respuesta({ hola: 'mundo' }));

    await expect(llamarALaApi('/api/algo')).resolves.toEqual({ hola: 'mundo' });
  });

  it('no intenta interpretar un 204, que no trae cuerpo', async () => {
    cuandoLaApiResponde(respuesta(null, 204));

    await expect(llamarALaApi('/api/algo')).resolves.toBeUndefined();
  });
});

describe('llamarALaApi, cuando la API responde un error', () => {
  it('conserva el codigo estable de la API', async () => {
    cuandoLaApiResponde(
      respuesta({ codigo: 'CONSENTIMIENTO_NO_REGISTRADO', mensaje: 'Falta el aviso.' }, 400),
    );

    // Es lo que permite distinguir dos 400 que para la persona son cosas
    // distintas: una validacion de formato y un consentimiento que falta.
    await expect(llamarALaApi('/api/cuenta')).rejects.toMatchObject({
      estado: 400,
      codigo: 'CONSENTIMIENTO_NO_REGISTRADO',
    });
  });

  it('prefiere el mensaje de la API al texto fijo', async () => {
    cuandoLaApiResponde(
      respuesta({ codigo: 'PUNTAJE_FUERA_DE_RANGO', mensaje: 'El puntaje 150 está fuera.' }, 400),
    );

    await expect(llamarALaApi('/api/resultados')).rejects.toThrow('El puntaje 150 está fuera.');
  });

  it('recoge el identificador de la peticion de la cabecera', async () => {
    cuandoLaApiResponde(
      respuesta({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error.' }, 500, {
        'x-request-id': '11111111-1111-4111-8111-111111111111',
      }),
    );

    await expect(llamarALaApi('/api/algo')).rejects.toMatchObject({
      identificador: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('sigue siendo un ErrorDeLaApi y no un Error cualquiera', async () => {
    cuandoLaApiResponde(respuesta({ codigo: 'ACTIVIDAD_NO_ENCONTRADA' }, 404));

    await expect(llamarALaApi('/api/resultados')).rejects.toBeInstanceOf(ErrorDeLaApi);
  });
});

describe('llamarALaApi, cuando el error no viene con la forma esperada', () => {
  it('un cuerpo que no es JSON no se convierte en un fallo distinto', async () => {
    // La prueba que define esta tarea. Un proxy o un balanceador pueden
    // devolver su propia pagina de error sin pasar por nuestra API.
    cuandoLaApiResponde(respuestaEnBruto('<html><body>502 Bad Gateway</body></html>', 502));

    const fallo = await llamarALaApi('/api/algo').catch((error: unknown) => error);

    expect(fallo).toBeInstanceOf(ErrorDeLaApi);
    expect(fallo).toMatchObject({ estado: 502, codigo: undefined });
    expect((fallo as Error).message).toBe('No se pudo completar la petición.');
  });

  it('un cuerpo vacio tampoco rompe nada', async () => {
    cuandoLaApiResponde(new Response(null, { status: 500 }));

    await expect(llamarALaApi('/api/algo')).rejects.toMatchObject({ estado: 500 });
  });

  it('un JSON que no es un objeto tampoco', async () => {
    cuandoLaApiResponde(respuesta('solo un texto', 500));

    await expect(llamarALaApi('/api/algo')).rejects.toMatchObject({
      estado: 500,
      codigo: undefined,
    });
  });

  it('descarta un codigo o un mensaje vacios', async () => {
    // Una cadena vacia es peor que la ausencia: pasaria las comprobaciones de
    // quien llame y no diria nada.
    cuandoLaApiResponde(respuesta({ codigo: '   ', mensaje: '' }, 400));

    const fallo = await llamarALaApi('/api/algo').catch((error: unknown) => error);

    expect(fallo).toMatchObject({ codigo: undefined });
    expect((fallo as Error).message).toBe('No se pudo completar la petición.');
  });
});

describe('llamarALaApi, cuando la sesion no vale', () => {
  it('cierra la sesion, para que la aplicacion no siga pareciendo que hay alguien dentro', async () => {
    cuandoLaApiResponde(
      respuesta({ codigo: 'SESION_INVALIDA', mensaje: 'Tu sesión no vale.' }, 401),
    );

    await expect(llamarALaApi('/api/cuenta')).rejects.toMatchObject({ estado: 401 });

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('dice lo unico que le sirve a la persona, y no lo que diga la API', async () => {
    // La API distingue por dentro entre "no llego token" y "el token no vale",
    // pero responde lo mismo a las dos para no ayudar a quien este probando
    // combinaciones. Aqui se dice que vuelva a entrar, que es la accion.
    cuandoLaApiResponde(respuesta({ codigo: 'SESION_REQUERIDA', mensaje: 'Inicia sesión.' }, 401));

    await expect(llamarALaApi('/api/cuenta')).rejects.toThrow('Tu sesión caducó. Vuelve a entrar.');
  });

  it('conserva el codigo, que sirve para diagnosticar y no se ensena', async () => {
    cuandoLaApiResponde(respuesta({ codigo: 'SESION_REQUERIDA' }, 401));

    await expect(llamarALaApi('/api/cuenta')).rejects.toMatchObject({
      codigo: 'SESION_REQUERIDA',
    });
  });
});

describe('llamarALaApi, la cabecera de autorizacion', () => {
  it('manda el token cuando hay sesion', async () => {
    cuandoLaApiResponde(respuesta({}));

    await llamarALaApi('/api/cuenta');

    const [, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];

    expect(new Headers(opciones.headers).get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('no la manda cuando no hay sesion, para que las rutas publicas funcionen', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    cuandoLaApiResponde(respuesta([]));

    await llamarALaApi('/api/catalogo');

    const [, opciones] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];

    expect(new Headers(opciones.headers).get('Authorization')).toBeNull();
  });

  it('no se cae si no se puede preguntar por la sesion', async () => {
    // `supabase()` lanza cuando no encuentra sus credenciales, y eso no debe
    // tumbar una llamada a una ruta publica.
    getSession.mockRejectedValue(new Error('sin credenciales'));
    cuandoLaApiResponde(respuesta([]));

    await expect(llamarALaApi('/api/catalogo')).resolves.toEqual([]);
  });
});
