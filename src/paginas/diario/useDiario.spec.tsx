import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { avisarQueLaColaCambio, cicloActual } from '../../sincronizacion/ciclo.ts';
import { leerLoLocalDelDiario } from '../../sincronizacion/diarioLocal.ts';
import { seguirUnaOperacion } from '../../sincronizacion/seguimiento.ts';
import { diasAntes } from '../../tiempo/dias.ts';
import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { diaDe } from './calendarioDelDiario.ts';
import {
  DIAS_POR_TANDA,
  useDiario,
  type EntradaDelHistorial,
  type FaseDelDiario,
} from './useDiario.ts';

/**
 * El gancho del diario (SCRUM-139), con la cola y el almacen de verdad y la API simulada.
 * Lo que recorre la pantalla entera esta en `Diario.spec.tsx`: aqui van los caminos que la
 * pantalla no puede provocar sola.
 */
const { api, hayConexionConLaApi, consultarLaVersionDelAviso, darDeAltaLaCuenta } = vi.hoisted(
  () => ({
    api: {
      consultarElDiario: vi.fn(),
      escribirEnElDiario: vi.fn(),
      editarAnotacion: vi.fn(),
    },
    hayConexionConLaApi: vi.fn(),
    consultarLaVersionDelAviso: vi.fn(),
    darDeAltaLaCuenta: vi.fn(),
  }),
);

vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta }));

// Se dejan pasar a las de verdad: solo se espian, o se retrasan cuando una prueba lo pide.
vi.mock('../../sincronizacion/seguimiento.ts', async (importar) => {
  const real = await importar<typeof import('../../sincronizacion/seguimiento.ts')>();

  return { ...real, seguirUnaOperacion: vi.fn(real.seguirUnaOperacion) };
});
vi.mock('../../sincronizacion/diarioLocal.ts', async (importar) => {
  const real = await importar<typeof import('../../sincronizacion/diarioLocal.ts')>();

  return { ...real, leerLoLocalDelDiario: vi.fn(real.leerLoLocalDelDiario) };
});
vi.mock('../../infraestructura/api/diario.ts', async (importar) => ({
  ...(await importar<typeof import('../../infraestructura/api/diario.ts')>()),
  ...api,
}));

fijarLaZonaDeLaCuenta('America/Bogota');

const HOY = diaDe(new Date());
const AYER = diasAntes(HOY, 1);

function documentoCon(texto: string) {
  return {
    type: 'doc' as const,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }],
  };
}

function haceMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

function anotacion(extra: Record<string, unknown>) {
  return {
    id: 'a-1',
    dia: HOY,
    titulo: null,
    contenido: documentoCon('Reciente'),
    adjuntos: [],
    version: 3,
    creadaEn: haceMinutos(10),
    editadaEn: haceMinutos(10),
    editableHasta: new Date(Date.now() + 50 * 60_000).toISOString(),
    ...extra,
  };
}

const ESCRITO = { dia: HOY, titulo: '', contenido: documentoCon('Lo nuevo'), adjuntos: [] };

const RECIENTE = anotacion({});
const VIEJA = anotacion({
  id: 'a-0',
  dia: AYER,
  contenido: documentoCon('De ayer'),
  creadaEn: haceMinutos(60 * 20),
  editableHasta: haceMinutos(60 * 19),
});

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  consultarLaVersionDelAviso.mockResolvedValue('1.0');
  darDeAltaLaCuenta.mockResolvedValue({ mascota: null });
  api.consultarElDiario.mockResolvedValue([RECIENTE, VIEJA]);
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  api.consultarElDiario.mockReset();
  api.escribirEnElDiario.mockReset();
  api.editarAnotacion.mockReset();
  vi.clearAllMocks();
});

async function listo() {
  const gancho = renderHook(() => useDiario());

  await waitFor(() => {
    expect(gancho.result.current.fase.fase).toBe('listo');
  });

  return gancho;
}

function laDe(gancho: Awaited<ReturnType<typeof listo>>, id: string): EntradaDelHistorial {
  const entrada = gancho.result.current.entradas.find((una) => una.id === id);

  if (entrada === undefined) {
    throw new Error(`No hay una entrada ${id}`);
  }

  return entrada;
}

/** Lo que se le dice a la persona cuando no se pudo leer; vacio si no hubo error. */
function elMensaje(fase: FaseDelDiario): string {
  return fase.fase === 'error' ? fase.mensaje : '';
}

async function laCola() {
  return (await cicloActual()?.almacen.operaciones()) ?? [];
}

describe('useDiario: cargar', () => {
  it('lee los ultimos 30 dias, y con ellos arma el historial', async () => {
    const gancho = await listo();

    expect(api.consultarElDiario).toHaveBeenCalledWith(
      diasAntes(HOY, DIAS_POR_TANDA - 1),
      HOY,
      expect.any(AbortSignal),
    );
    expect(gancho.result.current.entradas.map((e) => e.id).sort()).toEqual(['a-0', 'a-1']);
    expect(gancho.result.current.deLaCopia).toBeNull();
  });

  it('ver dias anteriores lee mas atras directo del servidor, sin copia', async () => {
    const gancho = await listo();

    api.consultarElDiario.mockClear();
    api.consultarElDiario.mockResolvedValue([
      anotacion({ id: 'a-viejisima', dia: diasAntes(HOY, 40) }),
    ]);

    act(() => {
      gancho.result.current.verDiasAnteriores();
    });

    await waitFor(() => {
      expect(gancho.result.current.entradas.map((e) => e.id)).toContain('a-viejisima');
    });
    expect(api.consultarElDiario).toHaveBeenCalledWith(
      diasAntes(HOY, 2 * DIAS_POR_TANDA - 1),
      HOY,
      expect.any(AbortSignal),
    );
    expect(gancho.result.current.deLaCopia).toBeNull();
  });

  it('ver dias anteriores sin conexion lo dice: eso no tiene copia', async () => {
    const gancho = await listo();

    api.consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    act(() => {
      gancho.result.current.verDiasAnteriores();
    });

    await waitFor(() => {
      expect(gancho.result.current.fase.fase).toBe('error');
    });
    // Lo que ya se veia, se sigue viendo.
    expect(gancho.result.current.entradas.map((e) => e.id).sort()).toEqual(['a-0', 'a-1']);
    // Y dice lo que pasa: para ver mas atras hace falta conexion. No que falte la copia.
    expect(elMensaje(gancho.result.current.fase)).toMatch(
      /Para ver días anteriores hace falta conexión/,
    );
  });

  it('al ver dias anteriores ya no se dice que lo que se ve es la copia', async () => {
    (await listo()).unmount();
    api.consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();

    expect(gancho.result.current.deLaCopia).not.toBeNull();

    api.consultarElDiario.mockResolvedValue([RECIENTE]);

    act(() => {
      gancho.result.current.verDiasAnteriores();
    });

    await waitFor(() => {
      expect(gancho.result.current.deLaCopia).toBeNull();
    });
  });

  it('da de alta la cuenta con la version vigente del aviso, y antes de leer', async () => {
    await listo();

    expect(consultarLaVersionDelAviso).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(darDeAltaLaCuenta).toHaveBeenCalledWith('1.0', expect.any(AbortSignal));
    expect(darDeAltaLaCuenta.mock.invocationCallOrder[0]).toBeLessThan(
      api.consultarElDiario.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('sin conexion y sin copia, dice que hace falta conectarse una vez', async () => {
    api.consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useDiario());

    await waitFor(() => {
      expect(gancho.result.current.fase.fase).toBe('error');
    });
    expect(elMensaje(gancho.result.current.fase)).toMatch(
      /Todavía no hay una copia de tu diario en este equipo/,
    );
  });

  it('un fallo que no es de la red se explica como lo que es, no como falta de copia', async () => {
    api.consultarElDiario.mockRejectedValue(new ErrorDeLaApi(500, 'Se cayo', undefined, 'ERROR'));

    const gancho = renderHook(() => useDiario());

    await waitFor(() => {
      expect(gancho.result.current.fase.fase).toBe('error');
    });

    const { fase } = gancho.result.current;

    expect(fase.fase === 'error' ? fase.mensaje : '').not.toMatch(/copia/);
  });

  it('si no se esta viendo la copia, volver la red no vuelve a leer', async () => {
    await listo();
    api.consultarElDiario.mockClear();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(api.consultarElDiario).not.toHaveBeenCalled();
  });

  it('una carga que llega tarde no pisa a la de la ventana nueva', async () => {
    let soltar: (valor: unknown) => void = () => undefined;

    api.consultarElDiario
      .mockImplementationOnce(
        () =>
          new Promise((resolver) => {
            soltar = resolver;
          }),
      )
      .mockResolvedValue([
        RECIENTE,
        VIEJA,
        anotacion({ id: 'a-viejisima', dia: diasAntes(HOY, 40) }),
      ]);

    const gancho = renderHook(() => useDiario());

    await waitFor(() => {
      expect(api.consultarElDiario).toHaveBeenCalledTimes(1);
    });
    act(() => {
      gancho.result.current.verDiasAnteriores();
    });
    await waitFor(() => {
      expect(gancho.result.current.entradas.map((e) => e.id)).toContain('a-viejisima');
    });

    await act(async () => {
      soltar([RECIENTE, VIEJA]);
      await new Promise((resolver) => setTimeout(resolver, 60));
    });

    expect(gancho.result.current.entradas.map((e) => e.id)).toContain('a-viejisima');
  });

  it('recargar vuelve a leer', async () => {
    const gancho = await listo();

    api.consultarElDiario.mockClear();

    act(() => {
      gancho.result.current.recargar();
    });

    expect(gancho.result.current.fase.fase).toBe('cargando');
    await waitFor(() => {
      expect(gancho.result.current.fase.fase).toBe('listo');
    });
    expect(api.consultarElDiario).toHaveBeenCalledTimes(1);
  });
});

describe('useDiario: escribir', () => {
  it('guarda en la cola con la hora del dispositivo y un identificador que es el de la operacion', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.escribir({ ...ESCRITO, titulo: 'Hoy' });
    });

    const [operacion] = await laCola();
    const payload = operacion?.payload as Record<string, unknown>;

    expect(operacion).toMatchObject({ tipo: 'diario.escribir', estado: 'pendiente' });
    expect(payload.clientOperationId).toBe(operacion?.operationId);
    expect(payload).toMatchObject({ dia: HOY, titulo: 'Hoy', contenido: documentoCon('Lo nuevo') });
    expect(Date.parse(payload.escritaEn as string)).toBeGreaterThan(Date.now() - 5000);
    expect(operacion?.entidad).toBe(`diario:${operacion?.operationId ?? ''}`);
  });

  it('sin titulo ni diagramas, no los manda', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.escribir(ESCRITO);
    });

    const payload = (await laCola())[0]?.payload as Record<string, unknown>;

    expect(payload).not.toHaveProperty('titulo');
    expect(payload).not.toHaveProperty('adjuntos');
    expect(payload).not.toHaveProperty('copiaDe');
  });

  it('lo que espera su turno mientras se envia otra cosa tambien esta guardando', async () => {
    const gancho = await listo();

    api.escribirEnElDiario.mockReturnValue(new Promise(() => undefined));

    await act(async () => {
      await gancho.result.current.escribir({ ...ESCRITO, contenido: documentoCon('Primera') });
      await gancho.result.current.escribir({ ...ESCRITO, contenido: documentoCon('Segunda') });
    });

    await waitFor(() => {
      const nuevas = gancho.result.current.entradas.filter((e) => e.version === 0);

      expect(nuevas.map((e) => e.estado)).toEqual(['guardando', 'guardando']);
    });
  });

  it('cerrar la pantalla corta la espera de lo que quedo guardado', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);
    vi.mocked(seguirUnaOperacion).mockClear();

    await act(async () => {
      await gancho.result.current.escribir(ESCRITO);
    });
    await waitFor(() => {
      expect(vi.mocked(seguirUnaOperacion)).toHaveBeenCalledTimes(2);
    });

    const sinLimite = vi.mocked(seguirUnaOperacion).mock.calls[1]?.[1]?.senal;

    expect(sinLimite?.aborted).toBe(false);

    gancho.unmount();

    expect(sinLimite?.aborted).toBe(true);
  });

  it('una lectura de lo guardado que llega tarde no pisa a la mas nueva', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    let soltar: (valor: Awaited<ReturnType<typeof leerLoLocalDelDiario>>) => void = () => undefined;

    vi.mocked(leerLoLocalDelDiario).mockImplementationOnce(
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
      await gancho.result.current.escribir(ESCRITO);
    });
    await waitFor(() => {
      expect(gancho.result.current.entradas.some((e) => e.version === 0)).toBe(true);
    });

    // Y la vieja llega tarde, con lo que habia antes de escribir.
    await act(async () => {
      soltar({ instantanea: null, marcas: {}, pendientes: [] });
      await new Promise((resolver) => setTimeout(resolver, 30));
    });

    expect(gancho.result.current.entradas.some((e) => e.version === 0)).toBe(true);
  });

  it('sin almacen abierto lanza: quien llama no debe vaciar lo escrito', async () => {
    const gancho = await listo();

    cerrarElAlmacenDePrueba();

    await expect(gancho.result.current.escribir(ESCRITO)).rejects.toThrow();
  });
});

describe('useDiario: corregir', () => {
  it('dentro de su hora entra como correccion, con la version del dispositivo y el dia por si hay que guardarla aparte', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    let como: string | undefined;

    await act(async () => {
      como = await gancho.result.current.corregir(laDe(gancho, 'a-1'), ESCRITO);
    });

    const [operacion] = await laCola();

    expect(como).toBe('corregida');
    expect(operacion).toMatchObject({ tipo: 'diario.editar', entidad: 'diario:a-1' });
    expect(operacion?.payload).toMatchObject({
      id: 'a-1',
      version: 3,
      dia: HOY,
      titulo: null,
      contenido: documentoCon('Lo nuevo'),
      adjuntos: null,
    });
    expect(Date.parse((operacion?.payload as { editadaEn: string }).editadaEn)).toBeGreaterThan(
      Date.now() - 5000,
    );
  });

  it('con un titulo y diagramas, los manda', async () => {
    const gancho = await listo();
    const diagrama = { id: 'd-1', tipo: 'diagrama' as const, datos: {} };

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.corregir(laDe(gancho, 'a-1'), {
        ...ESCRITO,
        titulo: 'Con titulo',
        adjuntos: [diagrama],
      });
    });

    expect((await laCola())[0]?.payload).toMatchObject({
      titulo: 'Con titulo',
      adjuntos: [diagrama],
    });
  });

  it('si ya hay algo pendiente sobre ella, no fija la version: sale de lo que responda eso', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.corregir(laDe(gancho, 'a-1'), ESCRITO);
    });
    await waitFor(() => {
      expect(laDe(gancho, 'a-1').estado).not.toBe('guardada');
    });
    await act(async () => {
      await gancho.result.current.corregir(laDe(gancho, 'a-1'), {
        ...ESCRITO,
        contenido: documentoCon('Otra vez'),
      });
    });

    const [primera, segunda] = await laCola();

    expect(primera?.payload).toMatchObject({ version: 3 });
    expect(segunda?.payload).not.toHaveProperty('version');
    expect(segunda?.dependeDe).toBe(primera?.operationId);
  });

  it('una escrita aqui y todavia sin enviar se corrige en la misma cosa, con su id local', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.escribir(ESCRITO);
    });
    await waitFor(() => {
      expect(gancho.result.current.entradas.some((e) => e.estado === 'en_este_equipo')).toBe(true);
    });

    const escrita = gancho.result.current.entradas.find((e) => e.estado === 'en_este_equipo')!;

    await act(async () => {
      await gancho.result.current.corregir(escrita, {
        ...ESCRITO,
        contenido: documentoCon('Mejor'),
      });
    });

    const [creacion, correccion] = await laCola();

    expect(escrita.id).toBe(`local:${creacion?.operationId ?? ''}`);
    expect(correccion).toMatchObject({
      tipo: 'diario.editar',
      entidad: creacion?.entidad,
      dependeDe: creacion?.operationId,
    });
    expect(correccion?.payload).toMatchObject({ id: escrita.id });
    expect(correccion?.payload).not.toHaveProperty('version');
  });

  it('lo que se guarda como nueva por la hora cae en el dia de la anotacion, no en el que diga lo escrito', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.corregir(laDe(gancho, 'a-0'), { ...ESCRITO, dia: HOY });
    });

    expect((await laCola())[0]?.payload).toMatchObject({ dia: AYER });
  });

  it('si ya paso su hora, se guarda como una nueva del mismo dia, marcada como copia de esa', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    let como: string | undefined;

    await act(async () => {
      como = await gancho.result.current.corregir(laDe(gancho, 'a-0'), {
        ...ESCRITO,
        dia: AYER,
        contenido: documentoCon('Se me olvido'),
      });
    });

    const operaciones = await laCola();

    expect(como).toBe('nueva');
    expect(operaciones).toHaveLength(1);
    expect(operaciones[0]).toMatchObject({ tipo: 'diario.escribir' });
    expect(operaciones[0]?.payload).toMatchObject({
      dia: AYER,
      contenido: documentoCon('Se me olvido'),
      copiaDe: 'a-0',
      motivo: 'EDICION_FUERA_DE_PLAZO',
    });

    // Y se ve como copia desde el primer momento, antes de que llegue al servidor.
    await waitFor(() => {
      expect(gancho.result.current.entradas.find((e) => e.copia !== undefined)).toMatchObject({
        dia: AYER,
        estado: 'en_este_equipo',
        copia: { copiaDe: 'a-0', motivo: 'EDICION_FUERA_DE_PLAZO' },
      });
    });
    // La original no se toca.
    expect(laDe(gancho, 'a-0').contenido).toEqual(documentoCon('De ayer'));
  });
});

describe('useDiario: reintentar', () => {
  it('reintentar algo que no se puede reintentar no vuelve a enviar nada', async () => {
    const gancho = await listo();

    hayConexionConLaApi.mockResolvedValue(false);

    await act(async () => {
      await gancho.result.current.escribir(ESCRITO);
    });

    const [operacion] = await laCola();

    // Choco con otro dispositivo: reintentarlo volveria a chocar con lo mismo.
    await cicloActual()?.almacen.guardarOperacion({ ...operacion!, estado: 'conflicto' });
    act(() => {
      avisarQueLaColaCambio();
    });
    await waitFor(() => {
      expect(gancho.result.current.entradas.some((e) => e.estado === 'error')).toBe(true);
    });

    const entrada = gancho.result.current.entradas.find((e) => e.estado === 'error')!;
    vi.mocked(seguirUnaOperacion).mockClear();

    act(() => {
      gancho.result.current.reintentar(entrada);
    });
    await new Promise((resolver) => setTimeout(resolver, 60));

    // No hay nada que seguir: la operacion sigue como estaba, esperando a la persona.
    expect(vi.mocked(seguirUnaOperacion)).not.toHaveBeenCalled();
  });

  it('una entrada sin nada que reintentar no hace nada', async () => {
    const gancho = await listo();

    act(() => {
      gancho.result.current.reintentar(laDe(gancho, 'a-1'));
    });

    expect(await laCola()).toEqual([]);
    expect(api.escribirEnElDiario).not.toHaveBeenCalled();
  });
});
