import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sincronizarLosArchivosDeLaPersona } from '../../foto/archivosDeLaPersona.ts';
import { olvidarLaZonaDeLaCuenta, zonaActual } from '../../tiempo/zonaHoraria.ts';
import { ErrorDeLaApi } from './clienteHttp.ts';
import {
  borrarMiCuenta,
  cambiarPreferencias,
  consultarLaCuentaPropia,
  darDeAltaLaCuenta,
  exportarMisDatos,
  FRASE_PARA_BORRAR,
} from './cuenta.ts';

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
// La foto (SCRUM-120) y la mascota propia (SCRUM-122) se prueban en `foto/`; aqui
// solo importa que cada cuenta que llega se les entregue.
vi.mock('../../foto/archivosDeLaPersona.ts', () => ({
  sincronizarLosArchivosDeLaPersona: vi.fn(),
}));

const CUENTA = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'alguien@ucundinamarca.edu.co',
  rol: 'usuario',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T10:00:00.000Z' },
  registradoEn: '2026-09-26T10:00:00.000Z',
  zonaHoraria: 'America/Bogota',
};

/** El dispositivo dice estar en Madrid, sea cual sea la zona de quien corre las pruebas. */
function dispositivoEn(zona: string): void {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    timeZone: zona,
  } as Intl.ResolvedDateTimeFormatOptions);
}

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** La peticion que recibio `fetch`, para poder interrogarla. */
function peticionEnviada(cual = 0): Request {
  const llamada = vi.mocked(globalThis.fetch).mock.calls[cual];

  if (!llamada) {
    throw new Error('No se llamo a fetch.');
  }

  const [url, opciones] = llamada as [string, RequestInit];

  return new Request(url, opciones);
}

beforeEach(() => {
  dispositivoEn('Europe/Madrid');
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-de-prueba' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(CUENTA)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  olvidarLaZonaDeLaCuenta();
});

describe('darDeAltaLaCuenta', () => {
  it('va por POST a la ruta de cuenta', async () => {
    await darDeAltaLaCuenta('2026-09-1');

    const enviada = peticionEnviada();

    expect(enviada.method).toBe('POST');
    expect(enviada.url).toBe('http://localhost:3000/api/cuenta');
  });

  it('manda la version del aviso y la zona del dispositivo, y nada mas', async () => {
    await darDeAltaLaCuenta('2026-09-1');

    const cuerpo = (await peticionEnviada().json()) as Record<string, unknown>;

    expect(cuerpo).toEqual({ versionPolitica: '2026-09-1', zonaHoraria: 'Europe/Madrid' });

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

describe('la zona horaria al dar de alta la cuenta (SCRUM-123)', () => {
  const ZONA_RECHAZADA = respuesta(
    { codigo: 'ZONA_HORARIA_INVALIDA', mensaje: 'No es valida.' },
    400,
  );

  it('desde que se recibe la cuenta, el dia se cuenta en la zona que tiene la cuenta', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ ...CUENTA, zonaHoraria: 'Asia/Tokyo' }),
    );

    await darDeAltaLaCuenta('2026-09-1');

    expect(zonaActual()).toBe('Asia/Tokyo');
  });

  it('si la API no acepta la zona, se repite sin ella y se entra igual', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(ZONA_RECHAZADA)
      .mockResolvedValueOnce(respuesta(CUENTA));

    const cuenta = await darDeAltaLaCuenta('2026-09-1');

    expect(cuenta.correo).toBe('alguien@ucundinamarca.edu.co');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);

    expect(await peticionEnviada(1).json()).toEqual({ versionPolitica: '2026-09-1' });
    // Se queda con la zona que la cuenta ya tenia.
    expect(zonaActual()).toBe('America/Bogota');
  });

  it('una API anterior que no conoce el campo tambien se tolera', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        respuesta({ codigo: 'VALIDACION', mensaje: 'property zonaHoraria should not exist' }, 400),
      )
      .mockResolvedValueOnce(respuesta(CUENTA));

    await expect(darDeAltaLaCuenta('2026-09-1')).resolves.toMatchObject({ rol: 'usuario' });
  });

  it('los demas errores no se reintentan: no tienen que ver con la zona', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'CORREO_YA_REGISTRADO', mensaje: 'Ese correo ya...' }, 409),
    );

    await expect(darDeAltaLaCuenta('2026-09-1')).rejects.toMatchObject({ estado: 409 });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('si el reintento tambien falla, el error llega', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(ZONA_RECHAZADA)
      .mockResolvedValueOnce(respuesta({ codigo: 'CONSENTIMIENTO_NO_REGISTRADO' }, 400));

    await expect(darDeAltaLaCuenta('2026-09-1')).rejects.toMatchObject({
      codigo: 'CONSENTIMIENTO_NO_REGISTRADO',
    });
  });
});

describe('consultarLaCuentaPropia', () => {
  it('fija la zona de la cuenta, igual que el alta', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ ...CUENTA, zonaHoraria: 'Europe/Madrid' }),
    );

    await consultarLaCuentaPropia();

    expect(zonaActual()).toBe('Europe/Madrid');
  });

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

describe('cambiarPreferencias', () => {
  it('va por PATCH a la ruta de preferencias con solo lo que cambia', async () => {
    await cambiarPreferencias({ modulosActivos: ['cognicion', 'emociones'] });

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('PATCH');
    expect(peticion.url).toBe('http://localhost:3000/api/cuenta/preferencias');
    await expect(peticion.json()).resolves.toEqual({ modulosActivos: ['cognicion', 'emociones'] });
  });

  it('el permiso del diario viaja solo, sin arrastrar lo demas (SCRUM-108)', async () => {
    await cambiarPreferencias({ diarioConRecomendaciones: true });

    await expect(peticionEnviada().json()).resolves.toEqual({ diarioConRecomendaciones: true });
  });

  it('lleva el token en la cabecera de autorizacion', async () => {
    await cambiarPreferencias({ nombre: 'Marina' });

    expect(peticionEnviada().headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('un modulo que no existe llega con su codigo, para poder explicarlo', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'SIN_MODULOS_ACTIVOS', mensaje: 'x' }, 400),
    );

    await expect(cambiarPreferencias({ modulosActivos: [] })).rejects.toMatchObject({
      estado: 400,
      codigo: 'SIN_MODULOS_ACTIVOS',
    });
  });
});

describe('exportarMisDatos', () => {
  it('va por GET a la ruta de exportacion, con el token', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ cuenta: CUENTA, resultados: [] }));

    await expect(exportarMisDatos()).resolves.toEqual({ cuenta: CUENTA, resultados: [] });

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('GET');
    expect(peticion.url).toBe('http://localhost:3000/api/cuenta/exportacion');
    expect(peticion.headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });
});

describe('borrarMiCuenta', () => {
  it('va por DELETE con la frase de confirmacion en el cuerpo', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(borrarMiCuenta(FRASE_PARA_BORRAR)).resolves.toBeUndefined();

    const peticion = peticionEnviada();

    expect(peticion.method).toBe('DELETE');
    expect(peticion.url).toBe('http://localhost:3000/api/cuenta');
    await expect(peticion.json()).resolves.toEqual({ confirmacion: 'BORRAR MI CUENTA' });
  });

  it('si el proveedor falla, el codigo llega para poder explicarlo', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'BORRADO_NO_COMPLETADO', mensaje: 'x' }, 503),
    );

    await expect(borrarMiCuenta(FRASE_PARA_BORRAR)).rejects.toMatchObject({
      estado: 503,
      codigo: 'BORRADO_NO_COMPLETADO',
    });
  });
});

describe('los archivos de la persona en cada cuenta que llega (SCRUM-120 y SCRUM-122)', () => {
  const CON_FOTO = { ...CUENTA, foto: { actualizadaEl: '2026-10-09T15:30:00.000Z' } };
  const SIN_FOTO = { ...CUENTA, foto: null };

  it('al darse de alta, la cuenta se entrega para que se pida su foto', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(CON_FOTO));

    await darDeAltaLaCuenta('2026-09-1');

    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledExactlyOnceWith(CON_FOTO);
  });

  it('al consultar la cuenta propia, tambien', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(CON_FOTO));

    await consultarLaCuentaPropia();

    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledExactlyOnceWith(CON_FOTO);
  });

  it('al cambiar las preferencias, tambien: la cuenta que vuelve trae la marca de la foto', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(CON_FOTO));

    await cambiarPreferencias({ nombre: 'Ana' });

    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledExactlyOnceWith(CON_FOTO);
  });

  it('una cuenta sin foto tambien se entrega: es lo que hace que se deje de mostrar la que hubiera', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(SIN_FOTO));

    await consultarLaCuentaPropia();

    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledExactlyOnceWith(SIN_FOTO);
  });

  it('una cuenta de una API anterior, sin el campo, se entrega igual', async () => {
    await consultarLaCuentaPropia();

    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledExactlyOnceWith(CUENTA);
  });

  it('si el alta se repite sin la zona, la cuenta se entrega una sola vez', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        respuesta({ codigo: 'ZONA_HORARIA_INVALIDA', mensaje: 'No es valida.' }, 400),
      )
      .mockResolvedValueOnce(respuesta(CON_FOTO));

    await darDeAltaLaCuenta('2026-09-1');

    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledExactlyOnceWith(CON_FOTO);
  });

  it.each([
    ['el alta', () => darDeAltaLaCuenta('2026-09-1')],
    ['la consulta', () => consultarLaCuentaPropia()],
    ['el cambio de preferencias', () => cambiarPreferencias({ nombre: 'Ana' })],
  ])('si %s falla, no se entrega nada', async (_cual, llamar) => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'ERROR_INTERNO', mensaje: 'x' }, 500),
    );

    await expect(llamar()).rejects.toBeInstanceOf(ErrorDeLaApi);

    expect(sincronizarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });
});
