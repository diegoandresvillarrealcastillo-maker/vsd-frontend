import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { olvidarLaCargaDeTurnstile, type Turnstile } from '../../captcha/turnstile.ts';
import { ESPERA_DEL_CAPTCHA } from '../../captcha/useCaptcha.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Acceso } from './Acceso.tsx';
import { Recuperar } from './Recuperar.tsx';
import { Registro } from './Registro.tsx';

// Con la clave del sitio puesta: es lo que activa el CAPTCHA en las pantallas.
vi.mock('../../infraestructura/entorno.ts', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../infraestructura/entorno.ts')>();

  return {
    ...original,
    entorno: { ...original.entorno, captcha: { claveDelSitio: '1x00000000000000000000AA' } },
  };
});

/**
 * El CAPTCHA en registro, acceso y recuperacion (SCRUM-165).
 *
 * Lo que importa: no se envia nada hasta tener el token, el token viaja con lo
 * demas, y despues de **cada** intento se pide uno nuevo, porque Supabase acepta
 * cada uno una sola vez.
 */
function estado(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn(),
    ...parcial,
  };
}

function pintar(pantalla: React.ReactNode, valor: EstadoDeSesion) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[RUTAS.ACCESO]}>
        <Routes>
          <Route path={RUTAS.ACCESO} element={pantalla} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

let usuario: ReturnType<typeof userEvent.setup>;
let callbacks: ((token: string) => void)[];
let turnstile: { render: Mock<Turnstile['render']>; reset: Mock<Turnstile['reset']> };

async function escribir(campo: HTMLElement, valor: string): Promise<void> {
  await usuario.click(campo);
  await usuario.paste(valor);
}

/** Cloudflare termina la comprobacion y da su token. */
async function darElToken(token: string): Promise<void> {
  await vi.waitFor(() => {
    expect(callbacks.length).toBeGreaterThan(0);
  });

  act(() => callbacks.at(-1)?.(token));
}

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  olvidarLaCargaDeTurnstile();
  callbacks = [];
  turnstile = {
    render: vi.fn<Turnstile['render']>((_contenedor, opciones) => {
      callbacks.push(opciones.callback);

      return `widget-${callbacks.length}`;
    }),
    reset: vi.fn<Turnstile['reset']>(),
  };
  window.turnstile = { ...turnstile, remove: vi.fn() };
});

afterEach(() => {
  delete window.turnstile;
  olvidarLaCargaDeTurnstile();
});

describe('Acceso con CAPTCHA', () => {
  async function rellenar(): Promise<void> {
    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'loQueSea123');
  }

  it('muestra la verificacion', async () => {
    pintar(<Acceso />, estado());

    await vi.waitFor(() => {
      expect(turnstile.render).toHaveBeenCalled();
    });
    expect(screen.getByText(/Comprobando que eres una persona/)).toBeInTheDocument();
  });

  it('no envia nada antes de tener el token, y dice por que', async () => {
    const entrar = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Acceso />, estado({ entrar }));
    await rellenar();
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(ESPERA_DEL_CAPTCHA);
  });

  it('con el token, lo manda junto a lo demas', async () => {
    const entrar = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Acceso />, estado({ entrar }));
    await rellenar();
    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    // Sin mirar `recordar`: es otra decision (SCRUM-164) y esta prueba no depende de ella.
    expect(entrar).toHaveBeenCalledWith(
      expect.objectContaining({
        correo: 'alguien@ejemplo.com',
        contrasena: 'loQueSea123',
        captchaToken: 'token-1',
      }) as Record<string, unknown>,
    );
  });

  it('despues de un intento fallido pide un token nuevo y no reusa el viejo', async () => {
    const entrar = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, mensaje: 'El correo o la contraseña no coinciden.' })
      .mockResolvedValue({ ok: true });

    pintar(<Acceso />, estado({ entrar }));
    await rellenar();
    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no coinciden/);
    expect(turnstile.reset).toHaveBeenCalledTimes(1);

    // Hasta que Cloudflare entregue otro, no se puede volver a enviar con el viejo.
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent(ESPERA_DEL_CAPTCHA);

    await darElToken('token-2');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).toHaveBeenLastCalledWith(
      expect.objectContaining({ captchaToken: 'token-2' }) as Record<string, unknown>,
    );
  });
});

describe('Recuperar con CAPTCHA', () => {
  it('no envia antes del token y, con el, lo manda', async () => {
    const pedirRecuperacion = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Recuperar />, estado({ pedirRecuperacion }));
    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

    expect(pedirRecuperacion).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(ESPERA_DEL_CAPTCHA);

    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

    expect(pedirRecuperacion).toHaveBeenCalledWith('alguien@ejemplo.com', 'token-1');
  });

  it('si falla, muestra el mensaje y pide un token nuevo', async () => {
    const pedirRecuperacion = vi.fn().mockResolvedValue({
      ok: false,
      mensaje: 'No pudimos comprobar que eres una persona. Inténtalo de nuevo.',
    });

    pintar(<Recuperar />, estado({ pedirRecuperacion }));
    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/comprobar que eres una persona/);
    expect(turnstile.reset).toHaveBeenCalledTimes(1);
  });
});

describe('Registro con CAPTCHA', () => {
  async function rellenarTodo(): Promise<void> {
    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'UnaContrasena#2026');
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1998-03-14' },
    });
    await usuario.click(screen.getByLabelText(/Acepto el aviso de privacidad/));
    await usuario.click(screen.getByLabelText(/Acepto los términos/));
  }

  it('no crea la cuenta antes del token, y lo dice solo cuando ya no queda nada por corregir', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Registro />, estado({ registrarse }));
    await rellenarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(ESPERA_DEL_CAPTCHA);
  });

  it('con el token, lo manda junto a lo demas', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Registro />, estado({ registrarse }));
    await rellenarTodo();
    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).toHaveBeenCalledWith({
      correo: 'alguien@ejemplo.com',
      contrasena: 'UnaContrasena#2026',
      aceptaElAviso: true,
      aceptaLosTerminos: true,
      captchaToken: 'token-1',
    });
  });

  it('un error de formulario no gasta el token', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Registro />, estado({ registrarse }));
    await rellenarTodo();
    await escribir(screen.getByLabelText('Repite la contraseña'), 'otra');
    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(turnstile.reset).not.toHaveBeenCalled();
  });

  it('despues de un intento fallido pide un token nuevo', async () => {
    const registrarse = vi
      .fn()
      .mockResolvedValue({ ok: false, mensaje: 'No se pudo crear la cuenta.' });

    pintar(<Registro />, estado({ registrarse }));
    await rellenarTodo();
    await darElToken('token-1');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo crear la cuenta/);
    expect(turnstile.reset).toHaveBeenCalledTimes(1);
  });
});
