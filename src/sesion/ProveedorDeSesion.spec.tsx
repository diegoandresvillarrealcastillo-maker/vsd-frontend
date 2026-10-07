import type { Session } from '@supabase/supabase-js';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLosArchivosDeLaPersona } from '../foto/archivosDeLaPersona.ts';
import {
  olvidarPreferenciaDePestana,
  recordarEnEsteEquipo,
} from '../infraestructura/supabase/almacenamiento.ts';
import { alCambiarLaSesion, olvidarLosDatosDeLaSesionActual } from '../sincronizacion/ciclo.ts';
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
vi.mock('../sincronizacion/ciclo.ts', () => ({
  alCambiarLaSesion: vi.fn().mockResolvedValue(undefined),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
}));

const SESION = { user: { id: 'id-de-ana', email: 'ana@ejemplo.test' } } as Session;
const OTRA_SESION = { user: { id: 'id-de-beto', email: 'beto@ejemplo.test' } } as Session;

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

/** El boton esta desde el primer momento; la sesion llega un instante despues. */
async function esperarAQueLaSesionLlegue(id = 'id-de-ana') {
  await vi.waitFor(() => {
    expect(alCambiarLaSesion).toHaveBeenCalledWith(id, expect.anything());
  });
}

function SalirYAnotar({ alTerminar }: { alTerminar: () => void }) {
  const { salir } = useSesion();

  return (
    <button type="button" onClick={() => void salir().then(alTerminar)}>
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
  olvidarPreferenciaDePestana();
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

/**
 * El almacen local sigue a la sesion (SCRUM-136, HU_MF09_001).
 *
 * Hay dos finales de sesion y no son lo mismo. Si la persona sale, se olvida todo
 * lo suyo en este equipo. Si la sesion termina sola —caduco, se revoco, se cerro
 * en otra pestana—, lo guardado se conserva: lo que hizo sin conexion y no se envio
 * sigue ahi para cuando vuelva a entrar.
 */
describe('el almacen local y la sesion (SCRUM-136)', () => {
  it('al haber sesion, se abre el almacen de esa persona', async () => {
    pintar();
    await esperarAQueLaSesionLlegue();

    expect(alCambiarLaSesion).toHaveBeenLastCalledWith('id-de-ana', { persistente: true });
  });

  it('si la sesion no se recuerda en este equipo, el almacen no se escribe', async () => {
    recordarEnEsteEquipo(false);
    pintar();
    await esperarAQueLaSesionLlegue();

    expect(alCambiarLaSesion).toHaveBeenLastCalledWith('id-de-ana', { persistente: false });
  });

  it('sin sesion, no hay a quien abrirle nada', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    pintar();
    await vi.waitFor(() => {
      expect(getSession).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(alCambiarLaSesion).toHaveBeenLastCalledWith(null, { persistente: true });
    expect(alCambiarLaSesion).not.toHaveBeenCalledWith('id-de-ana', expect.anything());
  });

  it('al salir, se olvida todo lo guardado, y ANTES de soltar el token', async () => {
    pintar();
    await act(async () => {
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Salir' }));
    });

    expect(olvidarLosDatosDeLaSesionActual).toHaveBeenCalledOnce();
    expect(vi.mocked(olvidarLosDatosDeLaSesionActual).mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('salir espera a que se termine de olvidar: nada queda a medias', async () => {
    let terminar: () => void = () => undefined;
    let salio = false;

    vi.mocked(olvidarLosDatosDeLaSesionActual).mockReturnValueOnce(
      new Promise<void>((resolver) => {
        terminar = resolver;
      }),
    );
    render(
      <ProveedorDeSesion>
        <SalirYAnotar alTerminar={() => (salio = true)} />
      </ProveedorDeSesion>,
    );
    await esperarAQueLaSesionLlegue();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Salir' }));
    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledOnce();
    });

    // Ya soltó el token, pero todavía no terminó: falta olvidar lo guardado.
    expect(salio).toBe(false);
    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();

    await act(async () => {
      terminar();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(salio).toBe(true);
    });
    expect(olvidarLosArchivosDeLaPersona).toHaveBeenCalled();
  });

  it('si la sesion termina sola —caduca, se revoca, se cierra en otra pestana—, lo guardado SE CONSERVA', async () => {
    pintar();
    await esperarAQueLaSesionLlegue();

    act(() => {
      avisarCambioDeSesion('SIGNED_OUT', null);
    });

    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
    // Se cierra el almacen (ya no hay sesion con la que enviar), sin borrarlo.
    expect(alCambiarLaSesion).toHaveBeenLastCalledWith(null, { persistente: true });
  });

  it('si solo se renueva el token, no se toca el almacen', async () => {
    pintar();
    await esperarAQueLaSesionLlegue();
    vi.mocked(alCambiarLaSesion).mockClear();

    act(() => {
      avisarCambioDeSesion('TOKEN_REFRESHED', { ...SESION });
    });

    expect(alCambiarLaSesion).not.toHaveBeenCalled();
  });

  it('si entra otra persona, el almacen pasa a ser el suyo', async () => {
    pintar();
    await esperarAQueLaSesionLlegue();

    act(() => {
      avisarCambioDeSesion('SIGNED_IN', OTRA_SESION);
    });

    expect(alCambiarLaSesion).toHaveBeenLastCalledWith('id-de-beto', { persistente: true });
    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
  });
});
