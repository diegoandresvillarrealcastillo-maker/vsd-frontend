import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import type { Pendiente, Recordatorio } from '../infraestructura/api/pendientes.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../pruebas/almacenDePrueba.ts';
import { avisarQueLaColaCambio, cicloActual } from '../sincronizacion/ciclo.ts';
import { seguirUnaOperacion } from '../sincronizacion/seguimiento.ts';
import { leerLoLocalDelSemaforo } from '../sincronizacion/semaforoLocal.ts';
import {
  olvidarLosRecordatoriosDejados,
  useSemaforo,
  type EstadoDelSemaforo,
} from './useSemaforo.ts';

/**
 * El gancho del semaforo (SCRUM-140), con la cola y el almacen de verdad y la API simulada.
 * Lo que recorre la pantalla entera esta en `Semaforo.spec.tsx`: aqui van los caminos que la
 * pantalla no puede provocar sola.
 */
const { api, hayConexionConLaApi } = vi.hoisted(() => ({
  api: {
    consultarElSemaforo: vi.fn(),
    crearPendiente: vi.fn(),
    editarPendiente: vi.fn(),
    borrarPendiente: vi.fn(),
  },
  hayConexionConLaApi: vi.fn(),
}));

vi.mock('../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../infraestructura/api/pendientes.ts', () => api);

// Se dejan pasar a las de verdad: solo se espian, o se retrasan cuando una prueba lo pide.
vi.mock('../sincronizacion/seguimiento.ts', async (importar) => {
  const real = await importar<typeof import('../sincronizacion/seguimiento.ts')>();

  return { ...real, seguirUnaOperacion: vi.fn(real.seguirUnaOperacion) };
});
vi.mock('../sincronizacion/semaforoLocal.ts', async (importar) => {
  const real = await importar<typeof import('../sincronizacion/semaforoLocal.ts')>();

  return { ...real, leerLoLocalDelSemaforo: vi.fn(real.leerLoLocalDelSemaforo) };
});

function pendiente(extra: Partial<Pendiente> = {}): Pendiente {
  return {
    id: 'p-1',
    texto: 'Llamar a la EPS',
    nivel: 'urgente',
    hecho: false,
    posponerHasta: null,
    fechaLimite: null,
    version: 2,
    creadoEn: '2026-10-05T10:00:00.000Z',
    editadoEn: '2026-10-05T10:00:00.000Z',
    ...extra,
  };
}

const RECORDATORIO: Recordatorio = {
  pendienteId: 'p-1',
  nivel: 'urgente',
  dias: 7,
  nivelSugerido: null,
  tono: 'plazo',
  fechaLimite: null,
};

const UNO = pendiente();
const OTRO = pendiente({ id: 'p-2', texto: 'Pagar el recibo', nivel: 'prioridad' });

beforeEach(async () => {
  olvidarLosRecordatoriosDejados();
  hayConexionConLaApi.mockResolvedValue(true);
  api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO, OTRO], recordatorio: null });
  api.crearPendiente.mockResolvedValue(pendiente({ id: 'servidor-1', texto: 'Nuevo' }));
  api.editarPendiente.mockResolvedValue(pendiente({ version: 3 }));
  api.borrarPendiente.mockResolvedValue(undefined);
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  for (const f of Object.values(api)) {
    f.mockReset();
  }
  vi.clearAllMocks();
});

async function listo() {
  const gancho = renderHook(() => useSemaforo());

  await waitFor(() => {
    expect(gancho.result.current.estado.fase).toBe('listo');
  });

  return gancho;
}

type Gancho = Awaited<ReturnType<typeof listo>>;

function lista(gancho: Gancho) {
  const { estado } = gancho.result.current;

  return estado.fase === 'listo' ? estado.pendientes : [];
}

function laDe(gancho: Gancho, id: string) {
  const entrada = lista(gancho).find((una) => una.id === id);

  if (entrada === undefined) {
    throw new Error(`No hay un pendiente ${id}`);
  }

  return entrada;
}

function listoDe(estado: EstadoDelSemaforo) {
  if (estado.fase !== 'listo') {
    throw new Error('Todavia no esta listo');
  }

  return estado;
}

async function laCola() {
  return [...((await cicloActual()?.almacen.operaciones()) ?? [])].sort(
    (una, otra) => una.orden - otra.orden,
  );
}

const sinConexion = () => hayConexionConLaApi.mockResolvedValue(false);

describe('useSemaforo: cargar', () => {
  it('lee el semaforo y lo ensena guardado, sin ser la copia', async () => {
    const gancho = await listo();

    expect(lista(gancho).map((e) => [e.id, e.estado])).toEqual([
      ['p-1', 'guardado'],
      ['p-2', 'guardado'],
    ]);
    expect(listoDe(gancho.result.current.estado).deLaCopia).toBeNull();
  });

  it('trae el recordatorio del servidor', async () => {
    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: RECORDATORIO });

    const gancho = await listo();

    expect(listoDe(gancho.result.current.estado).recordatorio).toEqual(RECORDATORIO);
  });

  it('el recordatorio que se dejo para luego no vuelve a salir en esta visita', async () => {
    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: RECORDATORIO });

    const primero = await listo();

    act(() => {
      primero.result.current.dejarParaLuego();
    });

    expect(listoDe(primero.result.current.estado).recordatorio).toBeNull();

    primero.unmount();

    expect(listoDe((await listo()).result.current.estado).recordatorio).toBeNull();
  });

  it('dejar para luego sin recordatorio no hace nada', async () => {
    const gancho = await listo();

    act(() => {
      gancho.result.current.dejarParaLuego();
    });

    expect(gancho.result.current.estado.fase).toBe('listo');
  });

  it('si no se puede leer y no hay copia, es un error, y reintentar vuelve a leer', async () => {
    api.consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useSemaforo());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('error');
    });

    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: null });
    act(() => {
      gancho.result.current.reintentar();
    });

    expect(gancho.result.current.estado.fase).toBe('cargando');
    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('listo');
    });
  });

  it('un error del servidor sale como error aunque haya copia: la copia no lo tapa', async () => {
    (await listo()).unmount();
    api.consultarElSemaforo.mockRejectedValue(new ErrorDeLaApi(403, 'No', undefined, 'SIN_CUENTA'));

    const gancho = renderHook(() => useSemaforo());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('error');
    });
  });
});

describe('useSemaforo: sin conexion', () => {
  it('se abre desde la copia, la dice, y no trae el recordatorio que tenia', async () => {
    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: RECORDATORIO });
    (await listo()).unmount();
    api.consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();
    const estado = listoDe(gancho.result.current.estado);

    expect(estado.deLaCopia).not.toBeNull();
    expect(estado.recordatorio).toBeNull();
    expect(estado.pendientes.map((e) => e.id)).toEqual(['p-1']);
  });

  it('en cuanto vuelve la red con la copia a la vista, se vuelve a leer', async () => {
    (await listo()).unmount();
    api.consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();

    expect(listoDe(gancho.result.current.estado).deLaCopia).not.toBeNull();

    api.consultarElSemaforo.mockResolvedValue({ pendientes: [OTRO], recordatorio: null });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(listoDe(gancho.result.current.estado).deLaCopia).toBeNull();
    });
    expect(lista(gancho).map((e) => e.id)).toEqual(['p-2']);
  });

  it('si no se esta viendo la copia, volver la red no vuelve a leer', async () => {
    await listo();
    api.consultarElSemaforo.mockClear();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(api.consultarElSemaforo).not.toHaveBeenCalled();
  });
});

describe('useSemaforo: anotar', () => {
  it('entra a la cola con un identificador que es el de la operacion, y se ve al instante', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.crear('Algo nuevo', 'prioridad', '2026-10-20');
    });

    const [operacion] = await laCola();
    const payload = operacion?.payload as Record<string, unknown>;

    expect(operacion).toMatchObject({ tipo: 'pendiente.crear', estado: 'pendiente' });
    expect(operacion?.entidad).toBe(`pendiente:${operacion?.operationId ?? ''}`);
    expect(payload).toEqual({
      clientOperationId: operacion?.operationId,
      texto: 'Algo nuevo',
      nivel: 'prioridad',
      fechaLimite: '2026-10-20',
    });
    await waitFor(() => {
      expect(lista(gancho).find((e) => e.texto === 'Algo nuevo')).toMatchObject({
        estado: 'en_este_equipo',
        nivel: 'prioridad',
        fechaLimite: '2026-10-20',
      });
    });
  });

  it('sin fecha limite, no la manda', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.crear('Sin fecha', 'aplazable');
    });

    expect((await laCola())[0]?.payload).not.toHaveProperty('fechaLimite');
  });

  it('sin almacen abierto lanza: quien llama lo cuenta y no vacia lo escrito', async () => {
    const gancho = await listo();

    cerrarElAlmacenDePrueba();

    await expect(gancho.result.current.crear('No cabe', 'urgente')).rejects.toThrow();
  });
});

describe('useSemaforo: cambiar', () => {
  it('manda la version que el dispositivo tenia, y solo con los cambios', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.editar('p-1', { hecho: true });
    });

    const [operacion] = await laCola();

    expect(operacion).toMatchObject({ tipo: 'pendiente.editar', entidad: 'pendiente:p-1' });
    expect(operacion?.payload).toEqual({ id: 'p-1', cambios: { version: 2, hecho: true } });
  });

  it('si ya hay algo pendiente sobre el, no fija la version: sale de lo que responda eso', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.editar('p-1', { hecho: true });
    });
    await waitFor(() => {
      expect(laDe(gancho, 'p-1').estado).not.toBe('guardado');
    });
    await act(async () => {
      await gancho.result.current.editar('p-1', { nivel: 'aplazable' });
    });

    const [primera, segunda] = await laCola();

    expect(primera?.payload).toMatchObject({ cambios: { version: 2 } });
    expect(segunda?.payload).toEqual({ id: 'p-1', cambios: { nivel: 'aplazable' } });
    expect(segunda?.dependeDe).toBe(primera?.operationId);
  });

  it('uno que no trae version (un servidor anterior) se manda sin ella', async () => {
    const { version: _version, ...sinVersion } = UNO;

    api.consultarElSemaforo.mockResolvedValue({ pendientes: [sinVersion], recordatorio: null });

    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.editar('p-1', { hecho: true });
    });

    expect((await laCola())[0]?.payload).toEqual({ id: 'p-1', cambios: { hecho: true } });
  });

  it('uno anotado aqui y todavia sin enviar se cambia en la misma cosa, con su id local', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.crear('Recien anotado', 'urgente');
    });
    await waitFor(() => {
      expect(lista(gancho).some((e) => e.estado === 'en_este_equipo')).toBe(true);
    });

    const nuevo = lista(gancho).find((e) => e.estado === 'en_este_equipo')!;

    await act(async () => {
      await gancho.result.current.editar(nuevo.id, { hecho: true });
    });

    const [creacion, cambio] = await laCola();

    expect(nuevo.id).toBe(`local:${creacion?.operationId ?? ''}`);
    expect(cambio).toMatchObject({
      tipo: 'pendiente.editar',
      entidad: creacion?.entidad,
      dependeDe: creacion?.operationId,
      payload: { id: nuevo.id, cambios: { hecho: true } },
    });
  });

  it.each([
    ['el nivel', { nivel: 'aplazable' as const }],
    ['hecho', { hecho: true }],
    ['posponerlo', { posponerHasta: '2026-10-14T12:00:00.000Z' }],
    ['la fecha limite', { fechaLimite: '2026-10-20' }],
    ['quitar la fecha limite', { fechaLimite: null }],
  ])('cambiar %s es atender el recordatorio: se va', async (_nombre, cambios) => {
    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: RECORDATORIO });

    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.editar('p-1', cambios);
    });

    expect(listoDe(gancho.result.current.estado).recordatorio).toBeNull();
  });

  it('corregir el texto no lo atiende', async () => {
    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: RECORDATORIO });

    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.editar('p-1', { texto: 'Otro texto' });
    });

    expect(listoDe(gancho.result.current.estado).recordatorio).toEqual(RECORDATORIO);
  });

  it('atender otro pendiente no hace desaparecer el recordatorio de este', async () => {
    api.consultarElSemaforo.mockResolvedValue({
      pendientes: [UNO, OTRO],
      recordatorio: RECORDATORIO,
    });

    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.editar('p-2', { hecho: true });
    });

    expect(listoDe(gancho.result.current.estado).recordatorio).toEqual(RECORDATORIO);
  });
});

describe('useSemaforo: borrar', () => {
  it('entra a la cola y se va de la lista al instante', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.borrar('p-1');
    });

    expect((await laCola())[0]).toMatchObject({
      tipo: 'pendiente.borrar',
      entidad: 'pendiente:p-1',
      payload: { id: 'p-1' },
    });
    await waitFor(() => {
      expect(lista(gancho).map((e) => e.id)).toEqual(['p-2']);
    });
  });

  it('una vez enviado no reaparece: la copia manda sobre lo leido antes', async () => {
    const gancho = await listo();

    await act(async () => {
      await gancho.result.current.borrar('p-1');
    });
    await waitFor(() => {
      expect(api.borrarPendiente).toHaveBeenCalledWith('p-1');
    });
    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(lista(gancho).map((e) => e.id)).toEqual(['p-2']);
  });

  it('atiende el recordatorio de lo que se borro', async () => {
    api.consultarElSemaforo.mockResolvedValue({ pendientes: [UNO], recordatorio: RECORDATORIO });

    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.borrar('p-1');
    });

    expect(listoDe(gancho.result.current.estado).recordatorio).toBeNull();
  });

  it('uno anotado aqui se borra en la misma cosa, con su id local', async () => {
    const gancho = await listo();

    sinConexion();

    await act(async () => {
      await gancho.result.current.crear('Efimero', 'urgente');
    });
    await waitFor(() => {
      expect(lista(gancho).some((e) => e.estado === 'en_este_equipo')).toBe(true);
    });

    const nuevo = lista(gancho).find((e) => e.estado === 'en_este_equipo')!;

    await act(async () => {
      await gancho.result.current.borrar(nuevo.id);
    });

    const [creacion, borrado] = await laCola();

    expect(borrado).toMatchObject({
      tipo: 'pendiente.borrar',
      entidad: creacion?.entidad,
      dependeDe: creacion?.operationId,
      payload: { id: nuevo.id },
    });
    await waitFor(() => {
      expect(lista(gancho).some((e) => e.id === nuevo.id)).toBe(false);
    });
  });
});

describe('useSemaforo: los choques con otro dispositivo (ADR 0009)', () => {
  const CHOCA = new ErrorDeLaApi(409, 'Cambio', undefined, 'VERSION_DESACTUALIZADA');

  /** Cambia algo sin conexion y, al volver la red, el servidor dice que otro lo cambio. */
  async function conUnChoque() {
    const gancho = await listo();

    sinConexion();
    await act(async () => {
      await gancho.result.current.editar('p-1', { texto: 'Lo mio', nivel: 'aplazable' });
    });

    api.editarPendiente.mockRejectedValueOnce(CHOCA);
    // Lo que tiene el servidor ahora: otro dispositivo lo cambio (version 3).
    api.consultarElSemaforo.mockResolvedValue({
      pendientes: [pendiente({ version: 3, texto: 'Lo del otro' }), OTRO],
      recordatorio: null,
    });
    hayConexionConLaApi.mockResolvedValue(true);
    await act(async () => {
      await cicloActual()?.motor.sincronizar('conexion');
    });
    await waitFor(() => {
      expect(gancho.result.current.choques).toHaveLength(1);
    });

    return gancho;
  }

  it('el cambio queda detenido y se ofrece elegir, con lo del servidor y lo de la persona', async () => {
    const gancho = await conUnChoque();
    const [choque] = gancho.result.current.choques;

    expect(choque).toMatchObject({
      id: 'p-1',
      cambios: { texto: 'Lo mio', nivel: 'aplazable' },
      eliminar: false,
      cuantos: 1,
    });
    expect(choque?.mio).toMatchObject({ texto: 'Lo mio', estado: 'choco' });
    expect(laDe(gancho, 'p-1').estado).toBe('choco');
  });

  it('al chocar, vuelve a leer el servidor para ensenar lo de ahora', async () => {
    const gancho = await conUnChoque();

    await waitFor(() => {
      expect(gancho.result.current.choques[0]?.delServidor).toMatchObject({
        version: 3,
        texto: 'Lo del otro',
      });
    });
  });

  it('quedarse con lo del servidor tira lo de la persona y nada mas se manda', async () => {
    const gancho = await conUnChoque();

    api.editarPendiente.mockClear();

    await act(async () => {
      await gancho.result.current.resolver('p-1', 'servidor');
    });

    await waitFor(() => {
      expect(gancho.result.current.choques).toHaveLength(0);
    });
    expect(laDe(gancho, 'p-1')).toMatchObject({ texto: 'Lo del otro', estado: 'guardado' });
    expect(api.editarPendiente).not.toHaveBeenCalled();
  });

  it('aplicar lo mio lo vuelve a mandar con la version que tiene el servidor ahora', async () => {
    const gancho = await conUnChoque();

    await waitFor(() => {
      expect(gancho.result.current.choques[0]?.delServidor?.version).toBe(3);
    });
    api.editarPendiente.mockClear();
    api.editarPendiente.mockResolvedValue(
      pendiente({ version: 4, texto: 'Lo mio', nivel: 'aplazable' }),
    );

    await act(async () => {
      await gancho.result.current.resolver('p-1', 'mio');
    });

    await waitFor(() => {
      expect(api.editarPendiente).toHaveBeenCalledTimes(1);
    });
    expect(api.editarPendiente).toHaveBeenCalledWith('p-1', {
      texto: 'Lo mio',
      nivel: 'aplazable',
      version: 3,
    });
    await waitFor(() => {
      expect(gancho.result.current.choques).toHaveLength(0);
    });
    expect(laDe(gancho, 'p-1')).toMatchObject({ texto: 'Lo mio', estado: 'guardado' });
  });

  it('resolver algo que no choco no hace nada', async () => {
    const gancho = await listo();

    await act(async () => {
      await gancho.result.current.resolver('p-1', 'servidor');
      await gancho.result.current.resolver('no-existe', 'mio');
    });

    expect(await laCola()).toEqual([]);
  });

  it('un cambio que no choco y sigue pendiente no es un choque', async () => {
    const gancho = await listo();

    sinConexion();
    await act(async () => {
      await gancho.result.current.editar('p-1', { hecho: true });
    });

    expect(gancho.result.current.choques).toEqual([]);
  });
});

describe('useSemaforo: leer lo guardado y seguirlo', () => {
  it('una lectura de lo guardado que llega tarde no pisa a la mas nueva', async () => {
    const gancho = await listo();

    sinConexion();

    let soltar: (valor: Awaited<ReturnType<typeof leerLoLocalDelSemaforo>>) => void = () =>
      undefined;

    vi.mocked(leerLoLocalDelSemaforo).mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          soltar = resolver;
        }),
    );

    // La primera lectura se queda esperando; la de despues es la de verdad.
    act(() => {
      avisarQueLaColaCambio();
    });
    await act(async () => {
      await gancho.result.current.crear('Algo', 'urgente');
    });
    await waitFor(() => {
      expect(lista(gancho).some((e) => e.estado === 'en_este_equipo')).toBe(true);
    });

    // Y la vieja llega tarde, con lo que habia antes de anotar.
    await act(async () => {
      soltar({ instantanea: null, pendientes: [] });
      await new Promise((resolver) => setTimeout(resolver, 30));
    });

    expect(lista(gancho).some((e) => e.estado === 'en_este_equipo')).toBe(true);
  });

  it('pide enviar ya lo que se acaba de guardar, y cerrar la pantalla corta el seguimiento', async () => {
    const gancho = await listo();

    sinConexion();
    vi.mocked(seguirUnaOperacion).mockClear();

    await act(async () => {
      await gancho.result.current.editar('p-1', { hecho: true });
    });
    await waitFor(() => {
      expect(vi.mocked(seguirUnaOperacion)).toHaveBeenCalledTimes(1);
    });

    const opciones = vi.mocked(seguirUnaOperacion).mock.calls[0]?.[1];

    expect(opciones?.sincronizarYa).toBe(true);
    expect(opciones?.senal?.aborted).toBe(false);

    gancho.unmount();

    expect(opciones?.senal?.aborted).toBe(true);
  });

  it('lo que espera su turno mientras se envia otra cosa tambien esta guardando', async () => {
    const gancho = await listo();

    api.crearPendiente.mockReturnValue(new Promise(() => undefined));

    await act(async () => {
      await gancho.result.current.crear('Primero', 'urgente');
      await gancho.result.current.crear('Segundo', 'urgente');
    });

    await waitFor(() => {
      const nuevos = lista(gancho).filter((e) => e.estado !== 'guardado');

      expect(nuevos.map((e) => e.estado)).toEqual(['guardando', 'guardando']);
    });
  });
});
