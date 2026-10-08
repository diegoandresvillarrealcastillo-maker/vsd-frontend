import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sincronizarLosArchivosDeLaPersona } from '../../foto/archivosDeLaPersona.ts';
import { olvidarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { consultarLosTextosVigentes } from './aviso.ts';
import { ErrorDeLaApi } from './clienteHttp.ts';
import {
  completarElRegistro,
  consultarElEstadoDelRegistro,
  esUnRechazoPorEdad,
} from './registro.ts';

/**
 * El registro por HTTP, comprobado sobre la peticion que sale, igual que
 * `cuenta.spec.ts`: lo que importa es lo que viaja, no el cliente que lo manda.
 */
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, signOut } }),
}));
vi.mock('../../foto/archivosDeLaPersona.ts', () => ({
  sincronizarLosArchivosDeLaPersona: vi.fn(),
}));

const CUENTA = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'alguien@ucundinamarca.edu.co',
  rol: 'usuario',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T10:00:00.000Z' },
  terminos: { versionPolitica: '2026-10-1', aceptadoEn: '2026-09-26T10:00:00.000Z' },
  registroCompleto: true,
  registradoEn: '2026-09-26T10:00:00.000Z',
  zonaHoraria: 'America/Bogota',
};

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

describe('consultarLosTextosVigentes', () => {
  it('devuelve las versiones del aviso y de los terminos que informa la API', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ version: '2026-09-1', versionTerminos: '2026-10-1' }),
    );

    await expect(consultarLosTextosVigentes()).resolves.toEqual({
      aviso: '2026-09-1',
      terminos: '2026-10-1',
    });
    expect(peticionEnviada().url).toBe('http://localhost:3000/api/aviso');
  });

  it('si la API no informa la de los terminos, no supone una', async () => {
    // Aceptar unos terminos sin version es aceptar algo que nadie puede demostrar.
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ version: '2026-09-1' }));

    await expect(consultarLosTextosVigentes()).rejects.toThrow(/términos/);
  });
});

describe('consultarElEstadoDelRegistro', () => {
  it('pregunta por POST a la ruta de cuenta, solo con la zona del dispositivo', async () => {
    await consultarElEstadoDelRegistro();

    const enviada = peticionEnviada();
    const cuerpo = (await enviada.json()) as Record<string, unknown>;

    expect(enviada.method).toBe('POST');
    expect(enviada.url).toBe('http://localhost:3000/api/cuenta');
    // Ni fecha ni casillas: preguntar no registra a nadie.
    expect(cuerpo).toEqual({ zonaHoraria: 'Europe/Madrid' });
  });

  it('una cuenta con el registro completo esta completa, y entrega sus archivos', async () => {
    const resultado = await consultarElEstadoDelRegistro();

    expect(resultado).toEqual({ estado: 'completo', cuenta: CUENTA });
    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledWith(CUENTA);
  });

  it('una API anterior, que no manda registroCompleto, se toma por completa', async () => {
    const { registroCompleto: _quitado, ...anterior } = CUENTA;
    vi.mocked(globalThis.fetch).mockResolvedValue(respuesta(anterior));

    await expect(consultarElEstadoDelRegistro()).resolves.toMatchObject({ estado: 'completo' });
  });

  it('una cuenta de antes, con registroCompleto en false, esta incompleta', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ ...CUENTA, registroCompleto: false, terminos: null }),
    );

    const resultado = await consultarElEstadoDelRegistro();

    expect(resultado.estado).toBe('incompleto');
    // Sus archivos no se piden: la API se los negaria hasta que complete.
    expect(sincronizarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });

  it('el 400 de fecha de nacimiento quiere decir que todavia no hay cuenta', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'FECHA_DE_NACIMIENTO_INVALIDA', mensaje: 'Revisa tu fecha' }, 400),
    );

    await expect(consultarElEstadoDelRegistro()).resolves.toEqual({ estado: 'sin-cuenta' });
  });

  it.each([
    ['sin sesion', 401, undefined],
    ['una cuenta de otro metodo', 409, 'CORREO_YA_REGISTRADO'],
    ['un fallo del servidor', 500, undefined],
  ])(
    'con %s no lo toma por una cuenta que falta: lo deja pasar como error',
    async (_caso, estado, codigo) => {
      vi.mocked(globalThis.fetch).mockResolvedValue(respuesta({ codigo }, estado));

      await expect(consultarElEstadoDelRegistro()).rejects.toBeInstanceOf(ErrorDeLaApi);
    },
  );

  it('sin red tampoco: el error sube tal cual', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(consultarElEstadoDelRegistro()).rejects.toThrow('Failed to fetch');
  });
});

describe('completarElRegistro', () => {
  const DATOS = {
    fechaNacimiento: '1998-03-14',
    textos: { aviso: '2026-09-1', terminos: '2026-10-1' },
  };

  it('manda la fecha, las dos casillas en true y las versiones que se vieron', async () => {
    await completarElRegistro(DATOS);

    const enviada = peticionEnviada();
    const cuerpo = (await enviada.json()) as Record<string, unknown>;

    expect(enviada.method).toBe('POST');
    expect(enviada.url).toBe('http://localhost:3000/api/cuenta');
    expect(cuerpo).toEqual({
      fechaNacimiento: '1998-03-14',
      versionPolitica: '2026-09-1',
      versionTerminos: '2026-10-1',
      aceptaAviso: true,
      aceptaTerminos: true,
      zonaHoraria: 'Europe/Madrid',
    });
  });

  it('no manda nada que no deba: ni rol, ni correo, ni identificador', async () => {
    await completarElRegistro(DATOS);

    const cuerpo = (await peticionEnviada().json()) as Record<string, unknown>;

    for (const prohibido of ['rol', 'correo', 'idUsuario', 'idProveedorAuth']) {
      expect(Object.keys(cuerpo)).not.toContain(prohibido);
    }
  });

  it('lleva el token en la cabecera de autorizacion', async () => {
    await completarElRegistro(DATOS);

    expect(peticionEnviada().headers.get('Authorization')).toBe('Bearer token-de-prueba');
  });

  it('devuelve la cuenta y entrega sus archivos', async () => {
    await expect(completarElRegistro(DATOS)).resolves.toEqual(CUENTA);
    expect(sincronizarLosArchivosDeLaPersona).toHaveBeenCalledWith(CUENTA);
  });

  it('si la API no acepta la zona, repite sin ella: es una comodidad, no una condicion', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respuesta({ codigo: 'ZONA_HORARIA_INVALIDA' }, 400))
      .mockResolvedValueOnce(respuesta(CUENTA));

    await completarElRegistro(DATOS);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(Object.keys((await peticionEnviada(1).json()) as object)).not.toContain('zonaHoraria');
  });

  it('otros 400 no se reintentan: no tienen que ver con la zona', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'FECHA_DE_NACIMIENTO_INVALIDA' }, 400),
    );

    await expect(completarElRegistro(DATOS)).rejects.toMatchObject({ estado: 400 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('un menor llega como MENOR_DE_EDAD, que se reconoce con esUnRechazoPorEdad', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'MENOR_DE_EDAD', mensaje: 'VSD Health es solo para mayores' }, 403),
    );

    const fallo = await completarElRegistro(DATOS).catch((error: unknown) => error);

    expect(esUnRechazoPorEdad(fallo)).toBe(true);
    // Y no se confunde con otro 403.
    expect(esUnRechazoPorEdad(new ErrorDeLaApi(403, 'x', undefined, 'REGISTRO_INCOMPLETO'))).toBe(
      false,
    );
    expect(esUnRechazoPorEdad(new Error('MENOR_DE_EDAD'))).toBe(false);
  });

  it('los textos que ya no son los vigentes llegan con su estado, para poder explicarlo', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta({ codigo: 'VERSION_DE_LOS_TERMINOS_NO_VIGENTE' }, 409),
    );

    await expect(completarElRegistro(DATOS)).rejects.toMatchObject({
      estado: 409,
      codigo: 'VERSION_DE_LOS_TERMINOS_NO_VIGENTE',
    });
  });
});
