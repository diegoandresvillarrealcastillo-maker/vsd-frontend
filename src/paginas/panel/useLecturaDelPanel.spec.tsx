import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { cicloActual, encolar } from '../../sincronizacion/ciclo.ts';
import { leerSoloLaCopia } from '../../sincronizacion/lecturas.ts';
import { CLAVE_DEL_PANEL, leerLosResultadosDeLaCola } from '../../sincronizacion/panelLocal.ts';
import { diasAntes } from '../../tiempo/dias.ts';
import { diaEnLaZona, fijarLaZonaDeLaCuenta, zonaActual } from '../../tiempo/zonaHoraria.ts';
import { SIN_COPIA_DEL_PANEL, useLecturaDelPanel } from './useLecturaDelPanel.ts';

/**
 * La lectura del panel (SCRUM-140), con el almacen de verdad y la API simulada. Lo que recorre
 * cada pantalla esta en `Panel.spec.tsx` y `Sendero.spec.tsx`.
 */
const { consultarLaVersionDelAviso, darDeAltaLaCuenta, consultarElProgreso, hayConexionConLaApi } =
  vi.hoisted(() => ({
    consultarLaVersionDelAviso: vi.fn(),
    darDeAltaLaCuenta: vi.fn(),
    consultarElProgreso: vi.fn(),
    hayConexionConLaApi: vi.fn(),
  }));

vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({
  darDeAltaLaCuenta,
  consultarLaCuentaPropia: darDeAltaLaCuenta,
}));
vi.mock('../../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));

// Se deja pasar a la de verdad, salvo cuando una prueba la retrasa.
vi.mock('../../sincronizacion/panelLocal.ts', async (importar) => {
  const real = await importar<typeof import('../../sincronizacion/panelLocal.ts')>();

  return { ...real, leerLosResultadosDeLaCola: vi.fn(real.leerLosResultadosDeLaCola) };
});

function cuenta(extra: Partial<Cuenta> = {}): Cuenta {
  return {
    id: 'c-1',
    correo: 'ana@ejemplo.test',
    rol: 'usuario',
    nombre: 'Ana',
    consentimiento: { versionPolitica: '1.0', aceptadoEn: '2026-09-26T15:00:00.000Z' },
    registradoEn: '2026-09-26T15:00:00.000Z',
    modulosActivos: ['bienestar'],
    mascota: null,
    diarioConRecomendaciones: false,
    zonaHoraria: 'America/Bogota',
    ...extra,
  };
}

function progreso(): ProgresoDelModulo[] {
  return [
    {
      modulo: 'bienestar',
      sesiones: 3,
      etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
      hoy: [
        { id: 'a-1', nombre: 'Uno', hecha: false },
        { id: 'a-2', nombre: 'Dos', hecha: false },
      ],
    },
  ];
}

const HOY = () => diaEnLaZona(new Date());

async function encolarUnResultado(
  activityId: string,
  cambios: {
    completedAt?: string;
    estado?: 'pendiente' | 'enviando' | 'hecha' | 'requiere_atencion';
  } = {},
) {
  const operationId = `res-${activityId}`;
  const guardada = await encolar({
    operationId,
    tipo: 'resultado.registrar',
    entidad: `resultado:${operationId}`,
    payload: {
      clientOperationId: operationId,
      activityId,
      completedAt: cambios.completedAt ?? new Date().toISOString(),
    },
  });

  if (cambios.estado !== undefined && cambios.estado !== 'pendiente') {
    await cicloActual()!.almacen.guardarOperacion({ ...guardada, estado: cambios.estado });
  }
}

beforeEach(async () => {
  fijarLaZonaDeLaCuenta('America/Bogota');
  hayConexionConLaApi.mockResolvedValue(false);
  consultarLaVersionDelAviso.mockResolvedValue('1.0');
  darDeAltaLaCuenta.mockResolvedValue(cuenta());
  consultarElProgreso.mockResolvedValue(progreso());
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  for (const f of [consultarLaVersionDelAviso, darDeAltaLaCuenta, consultarElProgreso]) {
    f.mockReset();
  }
  vi.clearAllMocks();
});

async function listo() {
  const gancho = renderHook(() => useLecturaDelPanel());

  await waitFor(() => {
    expect(gancho.result.current.estado.fase).toBe('listo');
  });

  return gancho;
}

type Gancho = Awaited<ReturnType<typeof listo>>;

function listoDe(gancho: Gancho) {
  const { estado } = gancho.result.current;

  if (estado.fase !== 'listo') {
    throw new Error('Todavia no esta listo');
  }

  return estado;
}

const hoyDe = (gancho: Gancho) => listoDe(gancho).progreso[0]?.hoy.map((a) => [a.id, a.hecha]);

describe('useLecturaDelPanel: cargar', () => {
  it('lee la cuenta y el progreso, sin ser la copia ni tener nada por enviar', async () => {
    const gancho = await listo();
    const estado = listoDe(gancho);

    expect(estado.cuenta.nombre).toBe('Ana');
    expect(estado.progreso).toEqual(progreso());
    expect(estado.deLaCopia).toBeNull();
    expect(estado.sinEnviar).toBe(0);
  });

  it('da de alta la cuenta con la version del aviso, y antes de pedir el progreso', async () => {
    await listo();

    expect(darDeAltaLaCuenta).toHaveBeenCalledWith('1.0', expect.any(AbortSignal));
    expect(darDeAltaLaCuenta.mock.invocationCallOrder[0]).toBeLessThan(
      consultarElProgreso.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('sin red y sin copia, dice que hace falta conectarse una vez, y reintentar vuelve a leer', async () => {
    darDeAltaLaCuenta.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useLecturaDelPanel());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('error');
    });
    expect(gancho.result.current.estado).toEqual({ fase: 'error', mensaje: SIN_COPIA_DEL_PANEL });

    act(() => {
      gancho.result.current.reintentar();
    });

    expect(gancho.result.current.estado.fase).toBe('cargando');
    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('listo');
    });
  });

  it('un fallo que no es de la red se explica como lo que es, no como falta de copia', async () => {
    darDeAltaLaCuenta.mockRejectedValue(new ErrorDeLaApi(429, 'x', undefined, 'DEMASIADAS'));

    const gancho = renderHook(() => useLecturaDelPanel());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('error');
    });
    const { estado } = gancho.result.current;

    expect(estado.fase === 'error' ? estado.mensaje : '').toContain('muchas peticiones');
  });

  it('una lectura vieja que llega tarde, despues de reintentar, no pisa a la nueva', async () => {
    let soltarLaVieja: (valor: Cuenta) => void = () => undefined;

    darDeAltaLaCuenta.mockImplementationOnce(
      () =>
        new Promise<Cuenta>((resolver) => {
          soltarLaVieja = resolver;
        }),
    );

    const gancho = renderHook(() => useLecturaDelPanel());

    // La primera sigue esperando al servidor y la persona reintenta.
    darDeAltaLaCuenta.mockResolvedValue(cuenta({ nombre: 'Nueva' }));
    act(() => {
      gancho.result.current.reintentar();
    });
    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('listo');
    });
    expect(listoDe(gancho).cuenta.nombre).toBe('Nueva');

    await act(async () => {
      soltarLaVieja(cuenta({ nombre: 'Vieja' }));
      await new Promise((resolver) => setTimeout(resolver, 40));
    });

    expect(listoDe(gancho).cuenta.nombre).toBe('Nueva');
  });

  it('no se muestra hasta haber leido lo de la cola: no parpadea sin lo que se hizo', async () => {
    await encolarUnResultado('a-1');

    const leerDeVerdad = vi.mocked(leerLosResultadosDeLaCola).getMockImplementation();
    let soltar: () => void = () => undefined;
    const espera = new Promise<void>((resolver) => {
      soltar = resolver;
    });

    if (leerDeVerdad === undefined) {
      throw new Error('La lectura de la cola no esta simulada');
    }

    vi.mocked(leerLosResultadosDeLaCola).mockImplementation(async () => {
      await espera;

      return leerDeVerdad();
    });

    try {
      const gancho = renderHook(() => useLecturaDelPanel());

      // Ya se leyeron la cuenta y el progreso, pero falta lo de la cola.
      await new Promise((resolver) => setTimeout(resolver, 80));
      expect(gancho.result.current.estado.fase).toBe('cargando');

      await act(async () => {
        soltar();
        await espera;
      });
      await waitFor(() => {
        expect(gancho.result.current.estado.fase).toBe('listo');
      });
      expect(hoyDe(gancho)?.[0]).toEqual(['a-1', true]);
    } finally {
      vi.mocked(leerLosResultadosDeLaCola).mockImplementation(leerDeVerdad);
    }
  });

  it('un error del servidor sale como error aunque haya copia: la copia no lo tapa', async () => {
    (await listo()).unmount();
    darDeAltaLaCuenta.mockRejectedValue(new ErrorDeLaApi(403, 'No', undefined, 'SIN_CUENTA'));

    const gancho = renderHook(() => useLecturaDelPanel());

    await waitFor(() => {
      expect(gancho.result.current.estado.fase).toBe('error');
    });
  });
});

describe('useLecturaDelPanel: sin conexion', () => {
  it('se abre desde la copia, y la dice', async () => {
    (await listo()).unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();
    const estado = listoDe(gancho);

    expect(estado.deLaCopia).not.toBeNull();
    expect(estado.cuenta.nombre).toBe('Ana');
    expect(estado.progreso).toEqual(progreso());
  });

  it('en cuanto vuelve la red con la copia a la vista, se vuelve a leer', async () => {
    (await listo()).unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();

    expect(listoDe(gancho).deLaCopia).not.toBeNull();

    darDeAltaLaCuenta.mockResolvedValue(cuenta({ nombre: 'Ana Maria' }));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(listoDe(gancho).deLaCopia).toBeNull();
    });
    expect(listoDe(gancho).cuenta.nombre).toBe('Ana Maria');
  });

  it('si no se esta viendo la copia, volver la red no vuelve a leer', async () => {
    await listo();
    darDeAltaLaCuenta.mockClear();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(darDeAltaLaCuenta).not.toHaveBeenCalled();
  });

  it('la zona de la cuenta se vuelve a fijar desde la copia: de ella depende que dia es hoy', async () => {
    darDeAltaLaCuenta.mockResolvedValueOnce(cuenta({ zonaHoraria: 'Europe/Madrid' }));
    (await listo()).unmount();
    fijarLaZonaDeLaCuenta('America/Bogota');
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    await listo();

    expect(zonaActual()).toBe('Europe/Madrid');
  });
});

describe('useLecturaDelPanel: lo que se hizo y esta en la cola', () => {
  it('lo que se hizo hoy sin conexion sale hecho, y cuenta como por enviar', async () => {
    await encolarUnResultado('a-2');

    const gancho = await listo();

    expect(hoyDe(gancho)).toEqual([
      ['a-1', false],
      ['a-2', true],
    ]);
    expect(listoDe(gancho).sinEnviar).toBe(1);
  });

  it('se pone al dia solo mientras la pantalla esta abierta', async () => {
    const gancho = await listo();

    expect(hoyDe(gancho)).toEqual([
      ['a-1', false],
      ['a-2', false],
    ]);

    await act(async () => {
      await encolarUnResultado('a-1');
    });

    await waitFor(() => {
      expect(hoyDe(gancho)).toEqual([
        ['a-1', true],
        ['a-2', false],
      ]);
    });
    expect(listoDe(gancho).sinEnviar).toBe(1);
  });

  it('lo ya enviado sigue hecho, y ya no cuenta como por enviar', async () => {
    await encolarUnResultado('a-1', { estado: 'hecha' });

    const gancho = await listo();

    expect(hoyDe(gancho)?.[0]).toEqual(['a-1', true]);
    expect(listoDe(gancho).sinEnviar).toBe(0);
  });

  it('lo que la API rechazo no cuenta como hecho', async () => {
    await encolarUnResultado('a-1', { estado: 'requiere_atencion' });

    const gancho = await listo();

    expect(hoyDe(gancho)?.[0]).toEqual(['a-1', false]);
    expect(listoDe(gancho).sinEnviar).toBe(0);
  });

  it('lo hecho otro dia no cuenta como hecho hoy', async () => {
    await encolarUnResultado('a-1', {
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const gancho = await listo();

    expect(hoyDe(gancho)?.[0]).toEqual(['a-1', false]);
  });

  it('una copia de otro dia no se toca: lo que toca hoy en ella es lo de ese dia', async () => {
    (await listo()).unmount();

    // La copia es de ayer.
    const guardada = await leerSoloLaCopia<unknown>(CLAVE_DEL_PANEL);

    await cicloActual()!.almacen.guardarLectura(
      CLAVE_DEL_PANEL,
      { valor: guardada, etag: null },
      new Date(`${diasAntes(HOY(), 1)}T15:00:00.000Z`),
    );
    await encolarUnResultado('a-1');
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();

    expect(listoDe(gancho).deLaCopia).not.toBeNull();
    expect(hoyDe(gancho)?.[0]).toEqual(['a-1', false]);
    // Pero se sabe que hay algo por enviar.
    expect(listoDe(gancho).sinEnviar).toBe(1);
  });

  it('cada vez que se relee lo de la cola, la hora de la lectura se renueva', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });

    try {
      const gancho = await listo();
      const despues = listoDe(gancho).ahora.getTime() + 3 * 60 * 60 * 1000;

      vi.setSystemTime(new Date(despues));
      await act(async () => {
        await encolarUnResultado('a-1');
      });

      await waitFor(() => {
        expect(listoDe(gancho).ahora.getTime()).toBeGreaterThanOrEqual(despues);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('una lectura de la cola que llega tarde no pisa a la mas nueva', async () => {
    const gancho = await listo();
    let soltar: (valor: Awaited<ReturnType<typeof leerLosResultadosDeLaCola>>) => void = () =>
      undefined;

    vi.mocked(leerLosResultadosDeLaCola).mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          soltar = resolver;
        }),
    );

    // La primera lectura se queda esperando; la de despues es la de verdad.
    await act(async () => {
      await encolarUnResultado('a-1');
    });
    await act(async () => {
      await encolarUnResultado('a-2');
    });
    await waitFor(() => {
      expect(hoyDe(gancho)).toEqual([
        ['a-1', true],
        ['a-2', true],
      ]);
    });

    // Y la vieja llega tarde, con lo que habia antes.
    await act(async () => {
      soltar([]);
      await new Promise((resolver) => setTimeout(resolver, 30));
    });

    expect(hoyDe(gancho)).toEqual([
      ['a-1', true],
      ['a-2', true],
    ]);
  });
});

describe('useLecturaDelPanel: actualizar', () => {
  it('muestra lo que el servidor confirmo, deja de ser la copia y lo deja guardado', async () => {
    (await listo()).unmount();
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = await listo();

    expect(listoDe(gancho).deLaCopia).not.toBeNull();

    act(() => {
      gancho.result.current.actualizar({
        cuenta: cuenta({ nombre: 'Nuevo', modulosActivos: ['bienestar', 'cognicion'] }),
        progreso: progreso(),
      });
    });

    expect(listoDe(gancho).cuenta).toMatchObject({ nombre: 'Nuevo' });
    expect(listoDe(gancho).deLaCopia).toBeNull();
    await waitFor(async () => {
      expect(await leerSoloLaCopia(CLAVE_DEL_PANEL)).toMatchObject({ cuenta: { nombre: 'Nuevo' } });
    });
  });
});
