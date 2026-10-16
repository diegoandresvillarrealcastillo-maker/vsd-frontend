import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SesionDeLaActividad } from '../../infraestructura/api/progreso.ts';
import { reintentarCambio } from '../../sincronizacion/acciones.ts';
import { buscarActividadConCopia } from '../../sincronizacion/catalogoLocal.ts';
import { encolar } from '../../sincronizacion/ciclo.ts';
import { leerLaSesionGuardada } from '../../sincronizacion/panelLocal.ts';
import { seguirUnaOperacion, type Seguimiento } from '../../sincronizacion/seguimiento.ts';
import {
  mostrarLoQuePaso,
  useCompletarActividad,
  type EstadoDeLaActividad,
} from './useCompletarActividad.ts';

/**
 * El gancho de la actividad, aislado de la cola, del motor y del catalogo (SCRUM-138):
 * aqui se prueba lo que **decide el gancho**, con dobles que cada prueba mueve a mano.
 * El recorrido completo, con todo de verdad, esta en `Actividad.spec.tsx`.
 */
vi.mock('../../sincronizacion/ciclo.ts', () => ({
  encolar: vi.fn(),
  SinAlmacenAbierto: class SinAlmacenAbierto extends Error {},
}));
vi.mock('../../sincronizacion/seguimiento.ts', () => ({ seguirUnaOperacion: vi.fn() }));
vi.mock('../../sincronizacion/catalogoLocal.ts', () => ({ buscarActividadConCopia: vi.fn() }));
vi.mock('../../sincronizacion/acciones.ts', () => ({ reintentarCambio: vi.fn() }));
vi.mock('../../sincronizacion/panelLocal.ts', () => ({ leerLaSesionGuardada: vi.fn() }));

const FICHA = {
  actividad: { id: 'a1', nombre: 'Como dormiste anoche', produceNivel: true },
  categoria: { id: 'c1', nombre: 'Bienestar', actividades: [] },
};

const seguir = vi.mocked(seguirUnaOperacion);

beforeEach(() => {
  vi.mocked(encolar).mockReset();
  vi.mocked(encolar).mockResolvedValue({} as never);
  seguir.mockReset();
  vi.mocked(buscarActividadConCopia).mockReset();
  vi.mocked(buscarActividadConCopia).mockResolvedValue(FICHA);
  vi.mocked(reintentarCambio).mockReset();
  vi.mocked(reintentarCambio).mockResolvedValue(true);
  vi.mocked(leerLaSesionGuardada).mockReset();
  vi.mocked(leerLaSesionGuardada).mockResolvedValue(null);
});

async function listo() {
  const gancho = renderHook(() => useCompletarActividad('a1'));

  await vi.waitFor(() => {
    expect(gancho.result.current.estado.fase).toBe('lista');
  });

  return gancho;
}

describe('mostrarLoQuePaso: lo que se le dice a la persona (SCRUM-138)', () => {
  const control = () => new AbortController();

  function mostrar(seguimiento: Seguimiento, senal = control().signal) {
    const estados: EstadoDeLaActividad[] = [];

    mostrarLoQuePaso(seguimiento, FICHA, senal, 'op-1', (estado) => estados.push(estado));

    return estados;
  }

  it('enviada: el resultado que respondio la API', () => {
    const resultado = { id: 'r1', nivelOrientativo: 'favorable' };

    expect(mostrar({ tipo: 'enviada', recibo: resultado })).toEqual([
      { fase: 'hecha', ficha: FICHA, resultado },
    ]);
  });

  it('rechazada: su motivo, por el codigo', () => {
    const [estado] = mostrar({
      tipo: 'rechazada',
      error: { codigo: 'PUNTAJE_NO_APLICABLE', estado: 400, momento: 'ahora' },
      conflicto: false,
    });

    expect(estado).toMatchObject({ fase: 'error', ficha: FICHA });
    expect(estado).toHaveProperty('mensaje', expect.stringMatching(/registra lo que haces/));
  });

  it('una sesion que no es de la actividad: dice que cambio y manda a abrirla otra vez', () => {
    const [estado] = mostrar({
      tipo: 'rechazada',
      error: { codigo: 'LA_SESION_NO_ES_DE_LA_ACTIVIDAD', estado: 400, momento: 'ahora' },
      conflicto: false,
    });

    expect(estado).toMatchObject({ fase: 'error', ficha: FICHA });
    expect(estado).toHaveProperty('mensaje', expect.stringMatching(/sesión de hoy cambió/));
    expect(estado).toHaveProperty('mensaje', expect.stringMatching(/panel/));
  });

  it('sin almacen: lo dice, y que no hay donde guardar', () => {
    const [estado] = mostrar({ tipo: 'sin_almacen' });

    expect(estado).toMatchObject({ fase: 'error', ficha: FICHA });
    expect(estado).toHaveProperty(
      'mensaje',
      expect.stringMatching(/No se pudo guardar tu resultado en este equipo/),
    );
  });

  it('guardada: lo dice, y sigue esperando a que salga, sin limite y con la misma senal', () => {
    seguir.mockReturnValue(new Promise(() => undefined));

    const senal = control().signal;
    const estados = mostrar({ tipo: 'guardada' }, senal);

    expect(estados).toEqual([{ fase: 'guardada', ficha: FICHA }]);
    expect(seguir).toHaveBeenCalledWith('op-1', { esperaMaximaEnMs: null, senal });
  });

  it('guardada y despues enviada: la pantalla se pone al dia sola', async () => {
    seguir.mockResolvedValue({ tipo: 'enviada', recibo: { id: 'r1' } });

    const estados = mostrar({ tipo: 'guardada' });

    await vi.waitFor(() => {
      expect(estados.map((e) => e.fase)).toEqual(['guardada', 'hecha']);
    });
  });

  it('guardada y despues rechazada: tambien', async () => {
    seguir.mockResolvedValue({
      tipo: 'rechazada',
      error: { codigo: 'SIN_RESPUESTA', momento: 'ahora' },
      conflicto: false,
    });

    const estados = mostrar({ tipo: 'guardada' });

    await vi.waitFor(() => {
      expect(estados.map((e) => e.fase)).toEqual(['guardada', 'error']);
    });
  });

  it('guardada y sigue guardada (se cancelo la espera): no repite el aviso ni vuelve a esperar', async () => {
    seguir.mockResolvedValue({ tipo: 'guardada' });

    const estados = mostrar({ tipo: 'guardada' });

    await Promise.resolve();
    await Promise.resolve();

    expect(estados).toEqual([{ fase: 'guardada', ficha: FICHA }]);
    expect(seguir).toHaveBeenCalledTimes(1);
  });

  it('si la pantalla ya no esta (senal cancelada), no cambia nada de nadie', () => {
    const cancelada = control();

    cancelada.abort();

    for (const seguimiento of [
      { tipo: 'enviada', recibo: {} },
      { tipo: 'guardada' },
      { tipo: 'sin_almacen' },
      { tipo: 'rechazada', error: null, conflicto: false },
    ] as const) {
      expect(mostrar(seguimiento, cancelada.signal)).toEqual([]);
    }

    expect(seguir).not.toHaveBeenCalled();
  });
});

describe('useCompletarActividad: la espera de lo guardado', () => {
  async function terminar(gancho: Awaited<ReturnType<typeof listo>>) {
    await act(async () => {
      gancho.result.current.completar({ score: 9 });
      await Promise.resolve();
    });
  }

  it('al terminar, guarda en la cola y sigue lo guardado pidiendo enviar ya', async () => {
    seguir.mockResolvedValue({ tipo: 'enviada', recibo: { id: 'r1' } });

    const gancho = await listo();

    await terminar(gancho);
    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('hecha');
    });

    expect(encolar).toHaveBeenCalledTimes(1);
    expect(seguir).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sincronizarYa: true }),
    );
  });

  it('cerrar la pantalla corta la espera de lo que quedo guardado', async () => {
    seguir.mockResolvedValueOnce({ tipo: 'guardada' });
    seguir.mockReturnValue(new Promise(() => undefined));

    const gancho = await listo();

    await terminar(gancho);
    await vi.waitFor(() => {
      expect(seguir).toHaveBeenCalledTimes(2);
    });

    const esperaSinLimite = seguir.mock.calls[1]?.[1]?.senal;

    expect(esperaSinLimite?.aborted).toBe(false);

    gancho.unmount();

    expect(esperaSinLimite?.aborted).toBe(true);
  });

  it('hacerla otra vez corta la espera del intento anterior y no la del nuevo', async () => {
    seguir.mockResolvedValueOnce({ tipo: 'guardada' });
    seguir.mockReturnValue(new Promise(() => undefined));

    const gancho = await listo();

    await terminar(gancho);
    await vi.waitFor(() => {
      expect(seguir).toHaveBeenCalledTimes(2);
    });

    const delIntentoAnterior = seguir.mock.calls[1]?.[1]?.senal;

    await act(async () => {
      gancho.result.current.empezarDeNuevo();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('lista');
    });

    expect(delIntentoAnterior?.aborted).toBe(true);

    // El intento nuevo tiene su propia senal, que sigue viva.
    seguir.mockResolvedValueOnce({ tipo: 'guardada' });
    await terminar(gancho);
    await vi.waitFor(() => {
      expect(seguir.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    expect(seguir.mock.calls[2]?.[1]?.senal?.aborted).toBe(false);
  });
});

describe('useCompletarActividad: la sesion del dia (SCRUM-208, ADR 0030)', () => {
  const SESION: SesionDeLaActividad = {
    id: 's-1',
    titulo: 'Secuencia de números, versión original',
    nivel: 1,
    parametros: { rondas: 12 },
  };

  async function terminar(gancho: Awaited<ReturnType<typeof listo>>) {
    await act(async () => {
      gancho.result.current.completar({ score: 9 });
      await Promise.resolve();
    });
  }

  function loQueSeGuardo(n = 0): Record<string, unknown> {
    return (vi.mocked(encolar).mock.calls[n]?.[0] as { payload: Record<string, unknown> }).payload;
  }

  beforeEach(() => {
    seguir.mockResolvedValue({ tipo: 'enviada', recibo: { id: 'r1' } });
  });

  it('lee la sesion de la actividad que se abre, de lo que dejo guardado el panel', async () => {
    vi.mocked(leerLaSesionGuardada).mockResolvedValue(SESION);

    await listo();

    expect(leerLaSesionGuardada).toHaveBeenCalledWith('a1');
  });

  it('entrega la sesion para que la mecanica la pinte, ya cuando la actividad esta lista', async () => {
    vi.mocked(leerLaSesionGuardada).mockResolvedValue(SESION);

    const gancho = await listo();

    expect(gancho.result.current.sesion).toEqual(SESION);
  });

  it('el resultado lleva el idSesion de la sesion que se hizo', async () => {
    vi.mocked(leerLaSesionGuardada).mockResolvedValue(SESION);

    const gancho = await listo();

    await terminar(gancho);

    expect(loQueSeGuardo()).toMatchObject({ activityId: 'a1', score: 9, idSesion: 's-1' });
  });

  it('sin sesion guardada, el resultado no lleva idSesion y la pantalla es la de siempre', async () => {
    const gancho = await listo();

    expect(gancho.result.current.sesion).toBeUndefined();

    await terminar(gancho);

    expect(loQueSeGuardo()).not.toHaveProperty('idSesion');
  });

  it('si no se puede leer la sesion, la actividad carga igual, sin sesion', async () => {
    vi.mocked(leerLaSesionGuardada).mockRejectedValue(new Error('el almacen fallo'));

    const gancho = await listo();

    expect(gancho.result.current.sesion).toBeUndefined();

    await terminar(gancho);

    expect(loQueSeGuardo()).not.toHaveProperty('idSesion');
  });

  it('no sale a pintar la mecanica sin saber antes cual es la sesion', async () => {
    let entregar: (valor: SesionDeLaActividad) => void = () => undefined;

    vi.mocked(leerLaSesionGuardada).mockReturnValue(
      new Promise((resolver) => {
        entregar = resolver;
      }),
    );

    const gancho = renderHook(() => useCompletarActividad('a1'));

    // Con la ficha ya leida pero sin saber aun la sesion, sigue cargando: pintar la mecanica con
    // lo de siempre y cambiarla despues haria perder lo que la persona lleve hecho.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(gancho.result.current.estado.fase).toBe('cargando');

    await act(async () => {
      entregar(SESION);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('lista');
    });

    expect(gancho.result.current.sesion).toEqual(SESION);
  });

  it('una actividad que no existe no tiene sesion', async () => {
    vi.mocked(buscarActividadConCopia).mockResolvedValue(null);
    vi.mocked(leerLaSesionGuardada).mockResolvedValue(SESION);

    const gancho = renderHook(() => useCompletarActividad('a1'));

    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('no-existe');
    });

    expect(gancho.result.current.sesion).toBeUndefined();
  });

  it('reintentar guardar manda la misma sesion', async () => {
    vi.mocked(leerLaSesionGuardada).mockResolvedValue(SESION);
    seguir.mockResolvedValueOnce({
      tipo: 'rechazada',
      error: { codigo: 'SIN_RESPUESTA', momento: 'ahora' },
      conflicto: false,
    });

    const gancho = await listo();

    await terminar(gancho);
    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('error');
    });

    await act(async () => {
      gancho.result.current.reintentar();
      await Promise.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(encolar).toHaveBeenCalledTimes(2);
    });

    expect(loQueSeGuardo(0)).toMatchObject({ idSesion: 's-1' });
    expect(loQueSeGuardo(1)).toMatchObject({ idSesion: 's-1' });
  });

  it('hacerla otra vez vuelve a leer la sesion: la de ahora, no la del intento anterior', async () => {
    vi.mocked(leerLaSesionGuardada).mockResolvedValueOnce(SESION);
    vi.mocked(leerLaSesionGuardada).mockResolvedValueOnce({ ...SESION, id: 's-2' });

    const gancho = await listo();

    await terminar(gancho);
    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('hecha');
    });

    await act(async () => {
      gancho.result.current.empezarDeNuevo();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('lista');
    });

    expect(gancho.result.current.sesion).toMatchObject({ id: 's-2' });

    await terminar(gancho);

    expect(loQueSeGuardo(0)).toMatchObject({ idSesion: 's-1' });
    expect(loQueSeGuardo(1)).toMatchObject({ idSesion: 's-2' });
  });
});
