import type { Session } from '@supabase/supabase-js';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLosArchivosDeLaPersona } from '../foto/archivosDeLaPersona.ts';
import { ProveedorDeSesion } from './ProveedorDeSesion.tsx';
import { useSesion } from './useSesion.ts';

/**
 * Lo que el proveedor de sesion hace con lo que es de una persona cuando la
 * sesion termina (SCRUM-120).
 *
 * La foto de perfil es de quien la puso: la siguiente persona que use este
 * navegador no puede encontrarla. Por eso se prueba por los dos caminos por los
 * que una sesion termina: cuando la persona sale, y cuando Supabase avisa de que
 * ya no hay sesion sin que ella haya hecho nada.
 */
const { getSession, onAuthStateChange, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../infraestructura/supabase/cliente.ts', () => ({
  supabase: () => ({ auth: { getSession, onAuthStateChange, signOut } }),
}));
vi.mock('../notificaciones/navegador.ts', () => ({
  dejarDeAvisarAEsteNavegador: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../foto/archivosDeLaPersona.ts', () => ({ olvidarLosArchivosDeLaPersona: vi.fn() }));

const SESION = { user: { email: 'ana@ejemplo.test' } } as Session;

type Escuchador = (evento: string, sesion: Session | null) => void;

let avisarCambioDeSesion: Escuchador;

function Salir() {
  const { salir } = useSesion();

  return (
    <button type="button" onClick={() => void salir()}>
      Salir
    </button>
  );
}

function pintar() {
  render(
    <ProveedorDeSesion>
      <Salir />
    </ProveedorDeSesion>,
  );
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: SESION } });
  signOut.mockResolvedValue({ error: null });
  onAuthStateChange.mockImplementation((escuchador: Escuchador) => {
    avisarCambioDeSesion = escuchador;

    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('la foto de perfil al terminar la sesion (SCRUM-120)', () => {
  it('al salir, se olvida la foto', async () => {
    pintar();

    await act(async () => {
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Salir' }));
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(olvidarLosArchivosDeLaPersona).toHaveBeenCalled();
  });

  it('si la sesion termina sin que la persona salga —caduca, se revoca, se cierra en otra pestana—, tambien', async () => {
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    act(() => {
      avisarCambioDeSesion('SIGNED_OUT', null);
    });

    expect(olvidarLosArchivosDeLaPersona).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('si solo se renueva el token, la foto se queda', async () => {
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    act(() => {
      avisarCambioDeSesion('TOKEN_REFRESHED', SESION);
    });

    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });

  it('entrar tampoco la olvida: el que entra es el dueno de lo que llegue', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    act(() => {
      avisarCambioDeSesion('SIGNED_IN', SESION);
    });

    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });
});
