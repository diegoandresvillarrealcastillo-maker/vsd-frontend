import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLosArchivosDeLaPersona } from '../foto/archivosDeLaPersona.ts';
import {
  CLAVE_DE_LA_SESION,
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

/**
 * Supabase avisa de un cambio. El aviso es solo la senal (SCRUM-270): el proveedor vuelve a leer la
 * sesion de este navegador, y lo que `getSession` entregue es lo que cuenta. Por omision entrega lo
 * mismo que trae el aviso, como pasa cuando el cambio es de esta misma pestana.
 */
async function avisar(evento: string, sesion: Session | null) {
  getSession.mockResolvedValue({ data: { session: sesion }, error: null });
  await emitir(evento, sesion);
}

/** El aviso tal cual, sin tocar lo que `getSession` va a contestar. */
async function emitir(evento: string, sesion: Session | null) {
  await act(async () => {
    avisarCambioDeSesion(evento, sesion);
    // El proveedor lee la sesion fuera del aviso, en una microtarea: se deja que termine.
    await new Promise<void>((resolver) => setTimeout(resolver, 0));
  });
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
  window.localStorage.clear();
  window.sessionStorage.clear();
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

    await avisar('SIGNED_OUT', null);

    expect(olvidarLosArchivosDeLaPersona).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('si solo se renueva el token, la foto se queda', async () => {
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    await avisar('TOKEN_REFRESHED', SESION);

    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });

  it('entrar tampoco la olvida: el que entra es el dueno de lo que llegue', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    await avisar('SIGNED_IN', SESION);

    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });
});

/**
 * Lo que queda y lo que no en este navegador cuando termina una sesion (SCRUM-142).
 *
 * El criterio: tras cerrar sesion **no queda nada de la persona** en IndexedDB (eso lo hace
 * `olvidarLosDatosDeLaSesionActual`, mas abajo), en la cache del service worker (que solo
 * guarda la aplicacion y la tipografia, nunca lo de una persona: SCRUM-135) ni en
 * `localStorage`. Esta prueba lo fija para `localStorage`: lo que es de la persona se va, y
 * lo que se queda son **preferencias del dispositivo** que no dicen nada de nadie.
 */
describe('lo que queda en localStorage al terminar la sesion (SCRUM-142)', () => {
  /** Lo que la mascota ya le dijo a esta persona: es suyo, no del dispositivo. */
  const LO_DE_LA_PERSONA = ['vsd-h:mascota-frases'];

  /** Preferencias de este dispositivo: el tema, donde dejo la mascota, si ya vio la induccion. */
  const DEL_DISPOSITIVO = ['vsd.tema', 'vsd-h:mascota-posicion', 'vsd-h:semaforo-induccion-vista'];

  function dejarTodoEnElNavegador() {
    for (const clave of [...LO_DE_LA_PERSONA, ...DEL_DISPOSITIVO]) {
      window.localStorage.setItem(clave, '{}');
    }
  }

  const quedan = () => Object.keys(window.localStorage).sort();

  it('al salir se va lo de la persona y se quedan las preferencias del dispositivo', async () => {
    dejarTodoEnElNavegador();
    pintar();

    await act(async () => {
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Salir' }));
    });

    expect(quedan()).toEqual([...DEL_DISPOSITIVO].sort());
  });

  it('si la sesion termina sola —caduca, se revoca, se cierra en otra pestana—, tambien', async () => {
    dejarTodoEnElNavegador();
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    await avisar('SIGNED_OUT', null);

    expect(quedan()).toEqual([...DEL_DISPOSITIVO].sort());
  });

  it('si solo se renueva el token, nada se va', async () => {
    dejarTodoEnElNavegador();
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    await avisar('TOKEN_REFRESHED', SESION);

    expect(quedan()).toEqual([...LO_DE_LA_PERSONA, ...DEL_DISPOSITIVO].sort());
  });

  it('entrar no borra nada: el que entra es el dueno de lo que llegue', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    dejarTodoEnElNavegador();
    pintar();
    await screen.findByRole('button', { name: 'Salir' });

    // Al arrancar sin sesion se olvida lo de la persona de antes.
    await avisar('INITIAL_SESSION', null);

    expect(quedan()).toEqual([...DEL_DISPOSITIVO].sort());

    window.localStorage.setItem('vsd-h:mascota-frases', '{}');

    await avisar('SIGNED_IN', SESION);

    expect(quedan()).toContain('vsd-h:mascota-frases');
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

    await avisar('SIGNED_OUT', null);

    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
    // Se cierra el almacen (ya no hay sesion con la que enviar), sin borrarlo.
    expect(alCambiarLaSesion).toHaveBeenLastCalledWith(null, { persistente: true });
  });

  it('si solo se renueva el token, no se toca el almacen', async () => {
    pintar();
    await esperarAQueLaSesionLlegue();
    vi.mocked(alCambiarLaSesion).mockClear();

    await avisar('TOKEN_REFRESHED', { ...SESION });

    expect(alCambiarLaSesion).not.toHaveBeenCalled();
  });

  it('si entra otra persona, el almacen pasa a ser el suyo', async () => {
    pintar();
    await esperarAQueLaSesionLlegue();

    await avisar('SIGNED_IN', OTRA_SESION);

    expect(alCambiarLaSesion).toHaveBeenLastCalledWith('id-de-beto', { persistente: true });
    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
  });
});

/**
 * Abrir la aplicacion SIN CONEXION con el token de acceso vencido (SCRUM-137).
 *
 * El token dura una hora. Pasada esa hora Supabase intenta renovarlo, y sin red no
 * puede: dice "sin sesion" aunque haya una guardada y valida. Sin esto, abrir la
 * aplicacion sin conexion mas de una hora despues de la ultima vez mandaria a la
 * pantalla de acceso.
 */
describe('abrir sin conexion con el token vencido (SCRUM-137)', () => {
  const GUARDADA = {
    access_token: 'token-vencido',
    refresh_token: 'refresco',
    expires_at: 1,
    token_type: 'bearer',
    user: { id: 'id-de-ana', email: 'ana@ejemplo.test' },
  };
  const SIN_RED = new AuthRetryableFetchError('Failed to fetch', 0);

  function Quien() {
    const { correo, cargando } = useSesion();

    return <p>{cargando ? 'cargando' : (correo ?? 'sin sesion')}</p>;
  }

  function pintarQuien() {
    render(
      <ProveedorDeSesion>
        <Quien />
      </ProveedorDeSesion>,
    );
  }

  beforeEach(() => {
    window.localStorage.setItem(CLAVE_DE_LA_SESION, JSON.stringify(GUARDADA));
    getSession.mockResolvedValue({ data: { session: null }, error: SIN_RED });
  });

  it('sigue siendo la misma persona: no se la manda al acceso', async () => {
    pintarQuien();

    expect(await screen.findByText('ana@ejemplo.test')).toBeInTheDocument();
  });

  it('se abre su almacen, que es lo que hace falta para usar la aplicacion', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');
    // El texto aparece al pintar; el efecto que abre el almacen corre un instante despues.
    await esperarAQueLaSesionLlegue();

    expect(alCambiarLaSesion).toHaveBeenLastCalledWith('id-de-ana', { persistente: true });
  });

  it('si Supabase tambien avisa de que empezo sin sesion, no la pierde', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');

    await emitir('INITIAL_SESSION', null);

    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument();
    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });

  it('solo en el arranque: una sesion que se cierra de verdad (SIGNED_OUT) se cierra', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');

    await avisar('SIGNED_OUT', null);

    expect(screen.getByText('sin sesion')).toBeInTheDocument();
    expect(olvidarLosArchivosDeLaPersona).toHaveBeenCalledOnce();
  });

  it('cuando vuelve la red y Supabase renueva el token, esa es la sesion', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');

    await avisar('TOKEN_REFRESHED', {
      ...GUARDADA,
      access_token: 'token-nuevo',
      user: { ...GUARDADA.user, email: 'ana-renovada@ejemplo.test' },
    } as unknown as Session);

    expect(screen.getByText('ana-renovada@ejemplo.test')).toBeInTheDocument();
  });

  it('si la renovacion falla por otra razon (no es la red), no hay sesion', async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('refresh token revocado', 400, 'refresh_token_not_found'),
    });
    pintarQuien();

    expect(await screen.findByText('sin sesion')).toBeInTheDocument();
  });

  it('si no hay sesion y no hay error, no hay sesion aunque algo hubiera quedado guardado', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    pintarQuien();

    expect(await screen.findByText('sin sesion')).toBeInTheDocument();
  });

  it('si fallo la red pero no hay nada guardado (o lo guardado no sirve), no hay sesion', async () => {
    window.localStorage.setItem(CLAVE_DE_LA_SESION, '{"user":{}}');
    pintarQuien();

    expect(await screen.findByText('sin sesion')).toBeInTheDocument();
  });

  it('sin nada guardado y sin sesion al arrancar, se olvida lo de la persona de antes', async () => {
    window.localStorage.clear();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    pintarQuien();
    await screen.findByText('sin sesion');

    await avisar('INITIAL_SESSION', null);

    expect(olvidarLosArchivosDeLaPersona).toHaveBeenCalledOnce();
  });

  it('con una sesion buena, es esa: lo guardado no se usa', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'id-de-beto', email: 'beto@ejemplo.test' } } },
      error: null,
    });
    pintarQuien();

    expect(await screen.findByText('beto@ejemplo.test')).toBeInTheDocument();
  });
});

/**
 * Un aviso de Supabase no es una sesion que adoptar (SCRUM-270).
 *
 * Con la sesion que no se recuerda, cada pestana guarda la suya, pero Supabase avisa de los cambios
 * a todas las pestanas del navegador. Si esta adoptara lo que trae el aviso, bastaria que otra
 * persona entrara en otra pestana para que esta pasara a ser suya (y se borrara lo de quien estaba).
 * El aviso solo dice que algo cambio; la sesion es la que esta pestana tiene guardada.
 */
describe('un aviso de autenticacion es una senal, no una sesion (SCRUM-270)', () => {
  function Quien() {
    const { correo, cargando } = useSesion();

    return <p>{cargando ? 'cargando' : (correo ?? 'sin sesion')}</p>;
  }

  function pintarQuien() {
    return render(
      <ProveedorDeSesion>
        <Quien />
      </ProveedorDeSesion>,
    );
  }

  /** Una lectura de la sesion que contesta cuando la prueba lo diga. */
  function lecturaLenta() {
    let contestar: (valor: unknown) => void = () => undefined;
    const lectura = new Promise((resolver) => {
      contestar = resolver;
    });

    return { lectura, contestar };
  }

  it('el aviso con la sesion de otra persona no cambia la de esta pestana', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');
    // La llamada inicial llega en un efecto, despues de pintar el correo: con la maquina cargada
    // se cruzaba con el mockClear y la prueba la tomaba por una llamada del aviso.
    await esperarAQueLaSesionLlegue();
    vi.mocked(alCambiarLaSesion).mockClear();

    // Otra pestana entro como beto; lo que esta pestana tiene guardado sigue siendo de ana.
    await emitir('SIGNED_IN', OTRA_SESION);

    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument();
    expect(alCambiarLaSesion).not.toHaveBeenCalled();
    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
  });

  it('el aviso de salida de otra pestana no cierra esta si su sesion sigue guardada', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');

    await emitir('SIGNED_OUT', null);

    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument();
    expect(olvidarLosArchivosDeLaPersona).not.toHaveBeenCalled();
  });

  it('no lee la sesion dentro del aviso: Supabase lo llama con su candado puesto', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');
    getSession.mockClear();

    act(() => {
      avisarCambioDeSesion('TOKEN_REFRESHED', SESION);
    });

    expect(getSession).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(getSession).toHaveBeenCalledOnce();
    });
  });

  it('con dos avisos seguidos vale la ultima lectura, aunque la primera conteste despues', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');

    const primera = lecturaLenta();

    getSession
      .mockReturnValueOnce(primera.lectura)
      .mockResolvedValueOnce({ data: { session: OTRA_SESION }, error: null });

    await emitir('TOKEN_REFRESHED', SESION);
    await emitir('SIGNED_IN', OTRA_SESION);

    expect(screen.getByText('beto@ejemplo.test')).toBeInTheDocument();

    await act(async () => {
      primera.contestar({ data: { session: SESION }, error: null });
      await Promise.resolve();
    });

    // La lectura vieja llega tarde y no pisa a la nueva.
    expect(screen.getByText('beto@ejemplo.test')).toBeInTheDocument();
  });

  it('si leer la sesion falla, se queda la que habia', async () => {
    pintarQuien();
    await screen.findByText('ana@ejemplo.test');
    getSession.mockRejectedValue(new Error('el almacen no responde'));

    await emitir('TOKEN_REFRESHED', SESION);

    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument();
  });

  it('si el proveedor se desmonta antes de que conteste la lectura, no adopta nada', async () => {
    const { unmount } = pintarQuien();

    await screen.findByText('ana@ejemplo.test');
    await esperarAQueLaSesionLlegue();
    vi.mocked(alCambiarLaSesion).mockClear();

    const lenta = lecturaLenta();

    getSession.mockReturnValueOnce(lenta.lectura);
    await emitir('SIGNED_IN', OTRA_SESION);
    unmount();
    await act(async () => {
      lenta.contestar({ data: { session: OTRA_SESION }, error: null });
      await Promise.resolve();
    });

    expect(alCambiarLaSesion).not.toHaveBeenCalled();
  });
});
