import type { Session } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  esSoloDeEstaPestana,
  olvidarPreferenciaDePestana,
} from '../infraestructura/supabase/almacenamiento.ts';
import { ProveedorDeSesion } from './ProveedorDeSesion.tsx';
import type { EstadoDeSesion, ResultadoDeAcceso } from './SesionContexto.ts';
import { useSesion } from './useSesion.ts';

/**
 * Lo que el proveedor de sesion contesta cuando Supabase falla o ni siquiera esta configurado.
 *
 * Una pantalla de acceso vive de estas respuestas: si falta la configuracion tiene que decirlo y
 * seguir en pie (la portada y el aviso clinico no dependen de Supabase), y ningun mensaje de error
 * puede revelar si un correo tiene cuenta. Las respuestas de los flujos que si llegan a Supabase
 * (cambiar la contrasena, el CAPTCHA, el registro) las prueban sus propios archivos.
 */
const { cliente, configuracion } = vi.hoisted(() => ({
  cliente: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      reauthenticate: vi.fn(),
      signUp: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
  configuracion: { falta: false },
}));

vi.mock('../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => {
    if (configuracion.falta) {
      throw new Error('Faltan las credenciales de Supabase');
    }

    return cliente;
  },
}));
vi.mock('../notificaciones/navegador.ts', () => ({
  dejarDeAvisarAEsteNavegador: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../foto/archivosDeLaPersona.ts', () => ({ olvidarLosArchivosDeLaPersona: vi.fn() }));
vi.mock('../sincronizacion/ciclo.ts', () => ({
  alCambiarLaSesion: vi.fn().mockResolvedValue(undefined),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
}));

const SIN_CONFIGURAR = 'La aplicación no tiene configurado el acceso. Avisa a quien la administra.';
const DEMASIADOS = 'Demasiados intentos seguidos. Espera un momento y vuelve.';
const GENERICO = 'No se pudo completar. Inténtalo de nuevo en un momento.';

const ANA = { user: { id: 'id-de-ana', email: 'ana@ejemplo.test' } } as Session;
const BETO = { user: { id: 'id-de-beto', email: 'beto@ejemplo.test' } } as Session;

type Escuchador = (evento: string, sesion: Session | null) => void;

let avisarCambioDeSesion: Escuchador;

function sesionDe(session: Session | null) {
  return { data: { session }, error: null };
}

function pintar() {
  return renderHook(() => useSesion(), { wrapper: ProveedorDeSesion });
}

/** Supabase avisa de un cambio; el proveedor lee la sesion fuera del aviso, en una microtarea. */
async function emitir(evento: string) {
  await act(async () => {
    avisarCambioDeSesion(evento, null);
    await new Promise<void>((resolver) => setTimeout(resolver, 0));
  });
}

beforeEach(() => {
  configuracion.falta = false;
  cliente.auth.getSession.mockResolvedValue(sesionDe(null));
  cliente.auth.signOut.mockResolvedValue({ error: null });
  cliente.auth.onAuthStateChange.mockImplementation((escuchador: Escuchador) => {
    avisarCambioDeSesion = escuchador;

    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

afterEach(() => {
  vi.clearAllMocks();
  olvidarPreferenciaDePestana();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('sin la configuracion de Supabase', () => {
  beforeEach(() => {
    configuracion.falta = true;
  });

  it('no se queda esperando una sesion que nunca va a llegar', () => {
    const { result } = pintar();

    expect(result.current.cargando).toBe(false);
    expect(result.current.sesion).toBeNull();
    expect(result.current.correo).toBeNull();
    expect(cliente.auth.getSession).not.toHaveBeenCalled();
  });

  const DATOS = { correo: 'ana@ejemplo.test', contrasena: 'UnaClave#Nueva9' };

  it.each<[string, (sesion: EstadoDeSesion) => Promise<ResultadoDeAcceso>]>([
    [
      'registrarse',
      (s) => s.registrarse({ ...DATOS, aceptaElAviso: true, aceptaLosTerminos: true }),
    ],
    ['entrar', (s) => s.entrar({ ...DATOS, recordar: false })],
    ['entrarConGoogle', (s) => s.entrarConGoogle(false)],
    ['pedirRecuperacion', (s) => s.pedirRecuperacion(DATOS.correo)],
    ['cambiarContrasena', (s) => s.cambiarContrasena(DATOS.contrasena)],
    ['pedirCodigoDeVerificacion', (s) => s.pedirCodigoDeVerificacion()],
    ['cambiarContrasenaConCodigo', (s) => s.cambiarContrasenaConCodigo(DATOS.contrasena, '123456')],
  ])('%s dice que falta la configuracion, sin llamar a nadie', async (_nombre, accion) => {
    const { result } = pintar();

    const resultado = await act(() => accion(result.current));

    expect(resultado).toEqual({ ok: false, mensaje: SIN_CONFIGURAR });
    for (const llamada of Object.values(cliente.auth)) {
      expect(llamada).not.toHaveBeenCalled();
    }
  });

  it('registrarse sin aceptar los dos documentos no avanza ni a mirar la configuracion', async () => {
    const { result } = pintar();

    const resultado = await act(() =>
      result.current.registrarse({ ...DATOS, aceptaElAviso: true, aceptaLosTerminos: false }),
    );

    expect(resultado).toEqual({
      ok: false,
      mensaje: 'Para crear la cuenta hace falta aceptar el aviso de privacidad y los términos.',
    });
  });

  it('salir no se rompe y deja la pantalla sin sesion', async () => {
    const { result } = pintar();

    await act(() => result.current.salir());

    expect(result.current.sesion).toBeNull();
  });
});

describe('lo que se le dice a la persona cuando Supabase rechaza', () => {
  // Ninguno revela si el correo tiene cuenta: «user_not_found» cae en el mensaje generico.
  it.each([
    [
      'un codigo que conoce',
      { code: 'invalid_credentials', status: 400 },
      'El correo o la contraseña no coinciden.',
    ],
    ['un 429 con un codigo que no conoce', { code: 'otro', status: 429 }, DEMASIADOS],
    ['un 429 sin codigo', { status: 429 }, DEMASIADOS],
    ['un codigo que no conoce', { code: 'user_not_found', status: 400 }, GENERICO],
    ['un error del servidor', { code: 'unexpected_failure', status: 500 }, GENERICO],
    ['un error sin codigo ni estado', {}, GENERICO],
  ])('al entrar, con %s', async (_caso, error, mensaje) => {
    cliente.auth.signInWithPassword.mockResolvedValue({ error });

    const { result } = pintar();
    const resultado = await act(() =>
      result.current.entrar({ correo: 'ana@ejemplo.test', contrasena: 'x', recordar: true }),
    );

    expect(resultado).toEqual({ ok: false, mensaje });
  });

  it('al entrar bien, responde que si', async () => {
    cliente.auth.signInWithPassword.mockResolvedValue({ error: null });

    const { result } = pintar();
    const resultado = await act(() =>
      result.current.entrar({ correo: 'ana@ejemplo.test', contrasena: 'x', recordar: true }),
    );

    expect(resultado).toEqual({ ok: true });
  });

  it('entrar decide donde se guarda la sesion antes de iniciarla', async () => {
    cliente.auth.signInWithPassword.mockImplementation(() => {
      // El token se escribe durante la llamada: para entonces ya tiene que estar decidido.
      expect(esSoloDeEstaPestana()).toBe(true);

      return Promise.resolve({ error: null });
    });

    const { result } = pintar();

    await act(() =>
      result.current.entrar({ correo: 'ana@ejemplo.test', contrasena: 'x', recordar: false }),
    );

    expect(cliente.auth.signInWithPassword).toHaveBeenCalledOnce();
  });
});

describe('entrar con Google', () => {
  it('manda a Google y vuelve al panel', async () => {
    cliente.auth.signInWithOAuth.mockResolvedValue({ error: null });

    const { result } = pintar();
    const resultado = await act(() => result.current.entrarConGoogle(true));

    expect(resultado).toEqual({ ok: true });
    expect(cliente.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/panel` },
    });
    expect(esSoloDeEstaPestana()).toBe(false);
  });

  it('si Supabase rechaza, lo traduce', async () => {
    cliente.auth.signInWithOAuth.mockResolvedValue({ error: { code: 'x', status: 429 } });

    const { result } = pintar();
    const resultado = await act(() => result.current.entrarConGoogle(false));

    expect(resultado).toEqual({ ok: false, mensaje: DEMASIADOS });
    expect(esSoloDeEstaPestana()).toBe(true);
  });
});

describe('pedir la recuperacion de la contrasena', () => {
  it('con demasiados intentos lo dice', async () => {
    cliente.auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'x', status: 429 } });

    const { result } = pintar();
    const resultado = await act(() => result.current.pedirRecuperacion('ana@ejemplo.test'));

    expect(resultado).toEqual({ ok: false, mensaje: DEMASIADOS });
  });

  it('responde que si aunque el correo no tenga cuenta o la llamada falle por otra cosa', async () => {
    cliente.auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'x', status: 500 } });

    const { result } = pintar();
    const resultado = await act(() => result.current.pedirRecuperacion('nadie@ejemplo.test'));

    expect(resultado).toEqual({ ok: true });
  });

  it('el enlace del correo vuelve a la pantalla de la contrasena nueva', async () => {
    cliente.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const { result } = pintar();

    await act(() => result.current.pedirRecuperacion('ana@ejemplo.test'));

    expect(cliente.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@ejemplo.test', {
      redirectTo: `${window.location.origin}/contrasena-nueva`,
    });
  });
});

describe('el codigo de verificacion del perfil', () => {
  it('lo pide a Supabase y responde que si', async () => {
    cliente.auth.reauthenticate.mockResolvedValue({ error: null });

    const { result } = pintar();
    const resultado = await act(() => result.current.pedirCodigoDeVerificacion());

    expect(resultado).toEqual({ ok: true });
    expect(cliente.auth.reauthenticate).toHaveBeenCalledOnce();
  });

  it('si Supabase rechaza, lo traduce', async () => {
    cliente.auth.reauthenticate.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });

    const { result } = pintar();
    const resultado = await act(() => result.current.pedirCodigoDeVerificacion());

    expect(resultado).toEqual({
      ok: false,
      mensaje: 'Se enviaron muchos correos seguidos. Espera unos minutos.',
    });
  });
});

describe('leer la sesion de este navegador', () => {
  it('si la lectura del arranque falla, deja de esperar y no hay sesion', async () => {
    cliente.auth.getSession.mockRejectedValue(new Error('el almacen no responde'));

    const { result } = pintar();

    await vi.waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });
    expect(result.current.sesion).toBeNull();
  });

  it('si falla al leerla despues de un aviso, se queda la sesion que habia', async () => {
    cliente.auth.getSession.mockResolvedValueOnce(sesionDe(ANA));

    const { result } = pintar();

    await vi.waitFor(() => {
      expect(result.current.sesion).toBe(ANA);
    });

    cliente.auth.getSession.mockRejectedValueOnce(new Error('el almacen no responde'));
    await emitir('TOKEN_REFRESHED');

    expect(result.current.sesion).toBe(ANA);
    expect(result.current.cargando).toBe(false);
  });

  it('si la lectura del arranque nunca contesta y la de un aviso falla, tampoco deja esperando', async () => {
    cliente.auth.getSession
      .mockReturnValueOnce(new Promise(() => undefined)) // el arranque: no contesta
      .mockRejectedValueOnce(new Error('el almacen no responde')); // la del aviso: falla

    const { result } = pintar();

    expect(result.current.cargando).toBe(true);

    await emitir('SIGNED_IN');

    expect(result.current.cargando).toBe(false);
    expect(result.current.sesion).toBeNull();
  });

  it('una lectura que contesta tarde no pisa a una mas nueva', async () => {
    let soltarLaLenta: (respuesta: ReturnType<typeof sesionDe>) => void = () => undefined;
    const lenta = new Promise<ReturnType<typeof sesionDe>>((resolver) => {
      soltarLaLenta = resolver;
    });

    cliente.auth.getSession
      .mockResolvedValueOnce(sesionDe(null)) // el arranque
      .mockReturnValueOnce(lenta) // el primer aviso: contesta cuando se suelte
      .mockResolvedValueOnce(sesionDe(BETO)); // el segundo aviso: contesta enseguida

    const { result } = pintar();

    await vi.waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    await emitir('SIGNED_IN');
    await emitir('SIGNED_IN');

    expect(result.current.sesion).toBe(BETO);

    await act(async () => {
      soltarLaLenta(sesionDe(ANA));
      await new Promise<void>((resolver) => setTimeout(resolver, 0));
    });

    expect(result.current.sesion).toBe(BETO);
  });

  it('al desmontarse deja de escuchar a Supabase', () => {
    const soltar = vi.fn();

    cliente.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: soltar } },
    });

    const { unmount } = pintar();

    unmount();

    expect(soltar).toHaveBeenCalledOnce();
  });
});
