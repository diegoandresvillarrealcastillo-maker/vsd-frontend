import type { Session } from '@supabase/supabase-js';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarPreferenciaDePestana } from '../../infraestructura/supabase/almacenamiento.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { ProveedorDeSesion } from '../../sesion/ProveedorDeSesion.tsx';
import { Registro } from './Registro.tsx';

/**
 * El registro responde igual exista o no el correo (S-08 de la auditoria 360).
 *
 * Una pantalla que cambia segun el correo tenga cuenta o no sirve para averiguar,
 * direccion por direccion, quien usa una herramienta de salud mental. Aqui se monta
 * el registro con el proveedor de sesion de verdad y se le dan a Supabase las tres
 * respuestas que puede dar, para comparar lo que la persona acaba viendo.
 *
 * - Sin error: lo que responde con la confirmacion por correo activada, tanto para
 *   un correo nuevo como para uno que ya existe (Supabase las hace indistinguibles).
 * - `user_already_exists` y `email_exists`: lo que respondería si se configurara sin
 *   confirmacion. Se tratan igual para que ese cambio no reabra la fuga.
 */
const { getSession, onAuthStateChange, signOut, signUp, consultarLosTextosVigentes } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    consultarLosTextosVigentes: vi.fn(),
  }),
);

vi.mock('../../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, onAuthStateChange, signOut, signUp } }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLosTextosVigentes }));
vi.mock('../../notificaciones/navegador.ts', () => ({
  dejarDeAvisarAEsteNavegador: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../foto/archivosDeLaPersona.ts', () => ({ olvidarLosArchivosDeLaPersona: vi.fn() }));
vi.mock('../../sincronizacion/ciclo.ts', () => ({
  alCambiarLaSesion: vi.fn().mockResolvedValue(undefined),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
}));

const CORREO = 'ana@ejemplo.test';

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  getSession.mockResolvedValue({ data: { session: null as Session | null } });
  signOut.mockResolvedValue({ error: null });
  consultarLosTextosVigentes.mockResolvedValue({ aviso: '2026-09-1', terminos: '2026-10-1' });
  onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  olvidarPreferenciaDePestana();
});

/** Lo que devuelve Supabase cuando algo sale mal: un codigo, y a veces un estado. */
function conError(code: string, status = 422) {
  return { error: { code, status, name: 'AuthApiError', message: 'texto crudo de la libreria' } };
}

/** Rellena el registro, lo envia y espera a que la pantalla cambie. */
async function registrarConRespuesta(respuesta: unknown): Promise<void> {
  signUp.mockResolvedValue(respuesta);

  render(
    <ProveedorDeSesion>
      <MemoryRouter initialEntries={[RUTAS.REGISTRO]}>
        <Routes>
          <Route path={RUTAS.REGISTRO} element={<Registro />} />
        </Routes>
      </MemoryRouter>
    </ProveedorDeSesion>,
  );

  await usuario.type(screen.getByLabelText('Correo'), CORREO);
  await usuario.click(screen.getByLabelText('Contraseña'));
  await usuario.paste('UnaContrasena#2026');
  await usuario.click(screen.getByLabelText('Repite la contraseña'));
  await usuario.paste('UnaContrasena#2026');
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
    target: { value: '1998-03-14' },
  });
  await usuario.click(screen.getByLabelText(/Acepto el aviso de privacidad/));
  await usuario.click(screen.getByLabelText(/Acepto los términos/));
  await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

  await waitFor(() => {
    expect(signUp).toHaveBeenCalledTimes(1);
  });
}

/** Lo que se ve y a donde llevan los enlaces: lo unico que la persona puede comparar. */
function loQueSeVe(): { texto: string; enlaces: string[] } {
  return {
    texto: document.body.textContent,
    enlaces: screen.getAllByRole('link').map((enlace) => enlace.getAttribute('href') ?? ''),
  };
}

describe('Registro: la respuesta no revela si el correo ya tiene cuenta', () => {
  it('con un correo nuevo dice que revise el correo, sin afirmar que la cuenta ya existe', async () => {
    await registrarConRespuesta({ error: null });

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(`Si ${CORREO} es un correo válido`);

    // Lo que decia antes, y que era falso cuando el correo ya tenia cuenta.
    expect(document.body).not.toHaveTextContent(/ya está creada/i);
    expect(document.body).not.toHaveTextContent(/ya (está|esta) registrad/i);
  });

  it('deja a un enlace tanto entrar como recuperar la contraseña', async () => {
    await registrarConRespuesta({ error: null });

    await screen.findByRole('heading', { name: 'Revisa tu correo' });

    expect(screen.getByRole('link', { name: 'Entra' })).toHaveAttribute('href', RUTAS.ACCESO);
    expect(screen.getByRole('link', { name: 'recupera tu contraseña' })).toHaveAttribute(
      'href',
      RUTAS.RECUPERAR,
    );
  });

  it.each([['user_already_exists'], ['email_exists']])(
    'con «%s» la pantalla es idéntica a la del correo nuevo',
    async (codigo) => {
      await registrarConRespuesta({ error: null });
      await screen.findByRole('heading', { name: 'Revisa tu correo' });

      const delCorreoNuevo = loQueSeVe();

      cleanup();
      vi.clearAllMocks();
      getSession.mockResolvedValue({ data: { session: null as Session | null } });
      consultarLosTextosVigentes.mockResolvedValue({ aviso: '2026-09-1', terminos: '2026-10-1' });
      onAuthStateChange.mockImplementation(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }));

      await registrarConRespuesta(conError(codigo));
      await screen.findByRole('heading', { name: 'Revisa tu correo' });

      expect(loQueSeVe()).toEqual(delCorreoNuevo);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
});

describe('Registro: lo que sí se dice cuando algo falla de verdad', () => {
  it('con demasiados intentos avisa, y no pasa por «Revisa tu correo»', async () => {
    await registrarConRespuesta(conError('over_email_send_rate_limit', 429));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Revisa tu correo' })).not.toBeInTheDocument();
  });

  it('con un fallo desconocido da un mensaje genérico, no el texto crudo de la librería', async () => {
    await registrarConRespuesta(conError('algo_nunca_visto', 500));

    const alerta = await screen.findByRole('alert');

    expect(alerta).toHaveTextContent('No se pudo completar');
    expect(alerta).not.toHaveTextContent('texto crudo de la libreria');
    expect(screen.queryByRole('heading', { name: 'Revisa tu correo' })).not.toBeInTheDocument();
  });

  it('el mensaje de un fallo no menciona si la cuenta existe', async () => {
    await registrarConRespuesta(conError('algo_nunca_visto', 500));

    const alerta = await screen.findByRole('alert');

    expect(alerta).not.toHaveTextContent(/ya tienes una cuenta|ya está registrad|ya existe/i);
  });
});
