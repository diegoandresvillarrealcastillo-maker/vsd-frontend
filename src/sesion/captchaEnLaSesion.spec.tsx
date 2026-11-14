import type { Session } from '@supabase/supabase-js';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarPreferenciaDePestana } from '../infraestructura/supabase/almacenamiento.ts';
import { ProveedorDeSesion } from './ProveedorDeSesion.tsx';
import type { ResultadoDeAcceso } from './SesionContexto.ts';
import { useSesion } from './useSesion.ts';

/**
 * El token del CAPTCHA llega a Supabase en las tres operaciones que protege
 * (SCRUM-165): registrarse, entrar y pedir la recuperacion de la contraseña.
 *
 * Si alguna no lo mandara, con la proteccion activada en Supabase esa pantalla
 * dejaria de funcionar sin que ninguna otra prueba lo notara.
 */
const { getSession, onAuthStateChange, signUp, signInWithPassword, resetPasswordForEmail } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  }));

vi.mock('../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({
    auth: { getSession, onAuthStateChange, signUp, signInWithPassword, resetPasswordForEmail },
  }),
}));
vi.mock('../infraestructura/api/aviso.ts', () => ({
  consultarLosTextosVigentes: vi
    .fn()
    .mockResolvedValue({ aviso: '2026-09-1', terminos: '2026-10-1' }),
}));
vi.mock('../notificaciones/navegador.ts', () => ({
  dejarDeAvisarAEsteNavegador: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../foto/archivosDeLaPersona.ts', () => ({ olvidarLosArchivosDeLaPersona: vi.fn() }));
vi.mock('../sincronizacion/ciclo.ts', () => ({
  alCambiarLaSesion: vi.fn().mockResolvedValue(undefined),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
}));

const BIEN = { data: {}, error: null };
const TOKEN = 'token-de-turnstile-de-prueba';

let resultados: ResultadoDeAcceso[];

function Sonda({ token }: { token?: string }) {
  const { registrarse, entrar, pedirRecuperacion } = useSesion();
  const conToken = token === undefined ? {} : { captchaToken: token };

  const guardar = (promesa: Promise<ResultadoDeAcceso>) =>
    void promesa.then((resultado) => resultados.push(resultado));

  return (
    <>
      <button
        type="button"
        onClick={() =>
          guardar(
            registrarse({
              correo: 'ana@ejemplo.test',
              contrasena: 'UnaContrasena#2026',
              aceptaElAviso: true,
              aceptaLosTerminos: true,
              ...conToken,
            }),
          )
        }
      >
        Registrarse
      </button>
      <button
        type="button"
        onClick={() =>
          guardar(
            entrar({
              correo: 'ana@ejemplo.test',
              contrasena: 'UnaContrasena#2026',
              recordar: false,
              ...conToken,
            }),
          )
        }
      >
        Entrar
      </button>
      <button type="button" onClick={() => guardar(pedirRecuperacion('ana@ejemplo.test', token))}>
        Recuperar
      </button>
    </>
  );
}

async function pulsar(nombre: string, token?: string) {
  render(
    <ProveedorDeSesion>
      <Sonda {...(token === undefined ? {} : { token })} />
    </ProveedorDeSesion>,
  );

  await act(async () => {
    await userEvent.setup().click(await screen.findByRole('button', { name: nombre }));
  });
}

beforeEach(() => {
  resultados = [];
  getSession.mockResolvedValue({ data: { session: null as Session | null } });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  signUp.mockResolvedValue(BIEN);
  signInWithPassword.mockResolvedValue(BIEN);
  resetPasswordForEmail.mockResolvedValue(BIEN);
});

afterEach(() => {
  vi.clearAllMocks();
  olvidarPreferenciaDePestana();
});

describe('con CAPTCHA', () => {
  it('registrarse manda el token junto a lo demas', async () => {
    await pulsar('Registrarse', TOKEN);

    expect(signUp).toHaveBeenCalledOnce();
    expect(signUp.mock.calls[0]?.[0]).toMatchObject({
      email: 'ana@ejemplo.test',
      options: { captchaToken: TOKEN, data: { version_aviso: '2026-09-1' } },
    });
  });

  it('entrar manda el token', async () => {
    await pulsar('Entrar', TOKEN);

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@ejemplo.test',
      password: 'UnaContrasena#2026',
      options: { captchaToken: TOKEN },
    });
  });

  it('pedir la recuperacion manda el token', async () => {
    await pulsar('Recuperar', TOKEN);

    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@ejemplo.test', {
      redirectTo: expect.stringContaining('/') as string,
      captchaToken: TOKEN,
    });
  });
});

describe('sin CAPTCHA, todo es como antes', () => {
  it('registrarse no manda captchaToken', async () => {
    await pulsar('Registrarse');

    expect((signUp.mock.calls[0]?.[0] as { options: object }).options).not.toHaveProperty(
      'captchaToken',
    );
  });

  it('entrar no manda opciones', async () => {
    await pulsar('Entrar');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@ejemplo.test',
      password: 'UnaContrasena#2026',
    });
  });

  it('pedir la recuperacion no manda captchaToken', async () => {
    await pulsar('Recuperar');

    expect(resetPasswordForEmail.mock.calls[0]?.[1]).not.toHaveProperty('captchaToken');
  });
});

describe('cuando Supabase rechaza el CAPTCHA', () => {
  const FALLO = { data: {}, error: { code: 'captcha_failed', status: 400, message: 'captcha' } };
  const MENSAJE = /No pudimos comprobar que eres una persona/;

  it.each([
    ['Registrarse', signUp],
    ['Entrar', signInWithPassword],
    ['Recuperar', resetPasswordForEmail],
  ])('%s lo dice y no lo da por hecho', async (nombre, llamada) => {
    llamada.mockResolvedValue(FALLO);

    await pulsar(nombre, TOKEN);

    await vi.waitFor(() => {
      expect(resultados).toHaveLength(1);
    });

    expect(resultados[0]?.ok).toBe(false);
    expect(resultados[0]?.mensaje).toMatch(MENSAJE);
  });

  it('en la recuperacion, un fallo que no es del CAPTCHA sigue sin revelar nada', async () => {
    // Responder igual haya cuenta o no es lo que impide averiguar quien usa la
    // aplicacion probando correos; el CAPTCHA no cambia eso.
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: 'user_not_found', status: 400, message: 'no existe' },
    });

    await pulsar('Recuperar', TOKEN);

    await vi.waitFor(() => {
      expect(resultados).toHaveLength(1);
    });

    expect(resultados[0]).toEqual({ ok: true });
  });
});
