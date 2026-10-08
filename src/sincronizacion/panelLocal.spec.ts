import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../infraestructura/api/progreso.ts';
import { fijarLaZonaDeLaCuenta, zonaActual } from '../tiempo/zonaHoraria.ts';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { nuevaOperacion, type Operacion, type TipoDeOperacion } from './cola.ts';
import { leerSoloLaCopia } from './lecturas.ts';
import {
  CLAVE_DEL_PANEL,
  cuantosResultadosSinEnviar,
  guardarElPanel,
  leerElPanelConCopia,
  leerLaCuentaGuardada,
  leerLosResultadosDeLaCola,
  precargarElPanel,
} from './panelLocal.ts';

const {
  consultarLaVersionDelAviso,
  darDeAltaLaCuenta,
  consultarLaCuentaPropia,
  consultarElProgreso,
} = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  consultarLaCuentaPropia: vi.fn(),
  consultarElProgreso: vi.fn(),
}));

vi.mock('../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta, consultarLaCuentaPropia }));
vi.mock('../infraestructura/api/progreso.ts', () => ({ consultarElProgreso }));

const NO_RECORDADA = { persistente: false };

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

function progreso(ids: [string, boolean][] = [['a-1', false]]): ProgresoDelModulo[] {
  return [
    {
      modulo: 'bienestar',
      sesiones: 3,
      etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
      hoy: ids.map(([id, hecha]) => ({ id, nombre: `Actividad ${id}`, hecha })),
    },
  ];
}

let contador = 0;

async function resultado(
  estado: Operacion['estado'],
  activityId: string,
  completedAt: string,
  cambios: Partial<Operacion> = {},
  tipo: TipoDeOperacion = 'resultado.registrar',
): Promise<Operacion> {
  contador += 1;

  const almacen = cicloActual()!.almacen;
  const agregada = await almacen.agregarOperacion(
    nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo,
        entidad: `resultado:${String(contador)}`,
        payload: { activityId, completedAt },
      },
      new Date('2026-10-07T11:30:00.000Z'),
    ),
  );
  const operacion = { ...agregada, estado, ...cambios };

  await almacen.guardarOperacion(operacion);

  return operacion;
}

beforeEach(async () => {
  contador = 0;
  fijarLaZonaDeLaCuenta('America/Bogota');
  consultarLaVersionDelAviso.mockResolvedValue('1.0');
  darDeAltaLaCuenta.mockResolvedValue(cuenta());
  consultarLaCuentaPropia.mockResolvedValue(cuenta());
  consultarElProgreso.mockResolvedValue(progreso());
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  reiniciarElCicloParaLasPruebas();
});

describe('leerElPanelConCopia', () => {
  it('lee del servidor la cuenta y el progreso, y los deja guardados juntos', async () => {
    const lectura = await leerElPanelConCopia({ darDeAlta: true });

    expect(lectura.deLaCopia).toBe(false);
    expect(lectura.valor).toEqual({ cuenta: cuenta(), progreso: progreso() });
    expect(await leerSoloLaCopia(CLAVE_DEL_PANEL)).toEqual({
      cuenta: cuenta(),
      progreso: progreso(),
    });
  });

  it('da de alta la cuenta con la version vigente ANTES de leer el progreso, si se pide', async () => {
    const orden: string[] = [];

    consultarLaVersionDelAviso.mockImplementation(() => {
      orden.push('version');

      return Promise.resolve('2.0');
    });
    darDeAltaLaCuenta.mockImplementation(() => {
      orden.push('alta');

      return Promise.resolve(cuenta());
    });
    consultarElProgreso.mockImplementation(() => {
      orden.push('progreso');

      return Promise.resolve(progreso());
    });

    const senal = new AbortController().signal;

    await leerElPanelConCopia({ darDeAlta: true, senal });

    expect(orden).toEqual(['version', 'alta', 'progreso']);
    expect(consultarLaVersionDelAviso).toHaveBeenCalledWith(senal);
    expect(darDeAltaLaCuenta).toHaveBeenCalledWith('2.0', senal);
    expect(consultarElProgreso).toHaveBeenCalledWith(senal);
    expect(consultarLaCuentaPropia).not.toHaveBeenCalled();
  });

  it('por omision no da de alta (eso registra el consentimiento): consulta la cuenta propia', async () => {
    await leerElPanelConCopia();

    expect(consultarLaCuentaPropia).toHaveBeenCalledTimes(1);
    expect(darDeAltaLaCuenta).not.toHaveBeenCalled();
    expect(consultarLaVersionDelAviso).not.toHaveBeenCalled();
  });

  it('sin conexion, con copia, devuelve la copia, dice que lo es y vuelve a fijar la zona', async () => {
    darDeAltaLaCuenta.mockResolvedValueOnce(cuenta({ zonaHoraria: 'Europe/Madrid' }));
    await leerElPanelConCopia({ darDeAlta: true });
    fijarLaZonaDeLaCuenta('America/Bogota');
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElPanelConCopia({ darDeAlta: true });

    expect(lectura.deLaCopia).toBe(true);
    expect(lectura.guardadoEn).not.toBeNull();
    expect(lectura.valor.cuenta.nombre).toBe('Ana');
    // De la zona depende que dia es hoy: la copia no la trae puesta, se pone.
    expect(zonaActual()).toBe('Europe/Madrid');
  });

  it('sin conexion y sin copia, el error sale: nunca se inventa un panel', async () => {
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(leerElPanelConCopia({ darDeAlta: true })).rejects.toBeInstanceOf(TypeError);
  });

  it('un "no tienes cuenta" del servidor sale tal cual, aunque haya copia', async () => {
    await leerElPanelConCopia({ darDeAlta: true });
    darDeAltaLaCuenta.mockRejectedValue(new ErrorDeLaApi(403, 'No', undefined, 'SIN_CUENTA'));

    await expect(leerElPanelConCopia({ darDeAlta: true })).rejects.toMatchObject({ estado: 403 });
  });

  it.each([
    ['otra cosa', 'texto'],
    ['sin cuenta', { progreso: [] }],
    ['sin progreso', { cuenta: cuenta() }],
    ['con la cuenta sin modulos', { cuenta: { id: 'c-1' }, progreso: [] }],
    ['con la cuenta sin id', { cuenta: { modulosActivos: [] }, progreso: [] }],
    ['con el progreso roto', { cuenta: cuenta(), progreso: [{ modulo: 'bienestar' }] }],
    ['con el progreso como objeto', { cuenta: cuenta(), progreso: {} }],
    ['con el progreso como texto', { cuenta: cuenta(), progreso: 'x' }],
    ['con un modulo sin nombre', { cuenta: cuenta(), progreso: [{ etapa: {}, hoy: [] }] }],
    ['con un modulo sin etapa', { cuenta: cuenta(), progreso: [{ modulo: 'bienestar', hoy: [] }] }],
    [
      'con un modulo sin lo de hoy',
      { cuenta: cuenta(), progreso: [{ modulo: 'bienestar', etapa: {} }] },
    ],
    [
      'con un modulo bueno y otro roto',
      { cuenta: cuenta(), progreso: [...progreso(), { modulo: 'x' }] },
    ],
  ])('una copia guardada con %s no se usa: es como no tenerla', async (_nombre, valor) => {
    await cicloActual()!.almacen.guardarLectura(CLAVE_DEL_PANEL, { valor, etag: null }, new Date());
    darDeAltaLaCuenta.mockRejectedValue(new TypeError('Failed to fetch'));

    // Es la copia la que se rechaza, no un fallo al recorrerla.
    await expect(leerElPanelConCopia({ darDeAlta: true })).rejects.toThrow(
      'La copia del panel no se puede leer.',
    );
  });

  it('lo que dice el servidor no se revisa aqui ni toca la zona: ya la puso la API al responder', async () => {
    fijarLaZonaDeLaCuenta('Europe/Madrid');

    const lectura = await leerElPanelConCopia({ darDeAlta: true });

    expect(lectura.deLaCopia).toBe(false);
    expect(zonaActual()).toBe('Europe/Madrid');
  });
});

describe('leerLaCuentaGuardada (SCRUM-142)', () => {
  it('devuelve la cuenta que dejo el panel y cuando la dejo, sin preguntar a la API', async () => {
    await guardarElPanel({ cuenta: cuenta({ nombre: 'Guardada' }), progreso: progreso() });

    const guardada = await leerLaCuentaGuardada();

    expect(guardada?.cuenta).toEqual(cuenta({ nombre: 'Guardada' }));
    expect(Number.isNaN(Date.parse(guardada?.guardadoEn ?? ''))).toBe(false);
    expect(consultarLaCuentaPropia).not.toHaveBeenCalled();
    expect(darDeAltaLaCuenta).not.toHaveBeenCalled();
  });

  it('sin nada guardado, nulo: nunca se inventa una cuenta', async () => {
    expect(await leerLaCuentaGuardada()).toBeNull();
  });

  it('sin almacen abierto, nulo', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLaCuentaGuardada()).toBeNull();
  });

  it('vuelve a fijar la zona de la cuenta: de ella depende lo que dice la pantalla', async () => {
    await guardarElPanel({
      cuenta: cuenta({ zonaHoraria: 'Europe/Madrid' }),
      progreso: progreso(),
    });
    fijarLaZonaDeLaCuenta('America/Bogota');

    await leerLaCuentaGuardada();

    expect(zonaActual()).toBe('Europe/Madrid');
  });

  it('una copia que no se entiende no se usa y no toca la zona', async () => {
    await cicloActual()!.almacen.guardarLectura(
      CLAVE_DEL_PANEL,
      { valor: { cuenta: { id: 'c-1' }, progreso: [] }, etag: null },
      new Date(),
    );
    fijarLaZonaDeLaCuenta('America/Bogota');

    expect(await leerLaCuentaGuardada()).toBeNull();
    expect(zonaActual()).toBe('America/Bogota');
  });
});

describe('guardarElPanel', () => {
  it('deja guardado lo ultimo que se supo', async () => {
    await guardarElPanel({ cuenta: cuenta({ nombre: 'Otro' }), progreso: progreso() });

    expect(await leerSoloLaCopia(CLAVE_DEL_PANEL)).toMatchObject({ cuenta: { nombre: 'Otro' } });
  });

  it('sin almacen abierto no hace nada y no falla', async () => {
    reiniciarElCicloParaLasPruebas();

    await expect(
      guardarElPanel({ cuenta: cuenta(), progreso: progreso() }),
    ).resolves.toBeUndefined();
  });
});

describe('precargarElPanel', () => {
  it('lee la cuenta y el progreso sin dar de alta la cuenta', async () => {
    await precargarElPanel();

    expect(consultarLaCuentaPropia).toHaveBeenCalledTimes(1);
    expect(darDeAltaLaCuenta).not.toHaveBeenCalled();
    expect(await leerSoloLaCopia(CLAVE_DEL_PANEL)).toBeTruthy();
  });
});

describe('leerLosResultadosDeLaCola', () => {
  it('trae los resultados enviados o por enviar, y no los que la API rechazo', async () => {
    await resultado('pendiente', 'a-1', '2026-10-07T11:00:00.000Z');
    await resultado('enviando', 'a-2', '2026-10-07T11:00:00.000Z');
    await resultado('hecha', 'a-3', '2026-10-07T11:00:00.000Z');
    await resultado('requiere_atencion', 'a-4', '2026-10-07T11:00:00.000Z');
    await resultado('conflicto', 'a-5', '2026-10-07T11:00:00.000Z');

    const resultados = await leerLosResultadosDeLaCola();

    expect(resultados.map((o) => o.estado).sort()).toEqual(['enviando', 'hecha', 'pendiente']);
  });

  it('no trae lo ilegible ni lo de otra cosa', async () => {
    await resultado('pendiente', 'a-1', '2026-10-07T11:00:00.000Z', { ilegible: true });
    await resultado('pendiente', 'a-2', '2026-10-07T11:00:00.000Z', {}, 'diario.escribir');
    const buena = await resultado('pendiente', 'a-3', '2026-10-07T11:00:00.000Z');

    expect((await leerLosResultadosDeLaCola()).map((o) => o.operationId)).toEqual([
      buena.operationId,
    ]);
  });

  it('sin almacen abierto, nada', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLosResultadosDeLaCola()).toEqual([]);
  });

  it('si el almacen falla, nada: no rompe la pantalla', async () => {
    vi.spyOn(cicloActual()!.almacen, 'operaciones').mockRejectedValue(new Error('se cerro'));

    expect(await leerLosResultadosDeLaCola()).toEqual([]);
  });
});

describe('cuantosResultadosSinEnviar', () => {
  it('cuenta los que esperan o se estan enviando; los ya enviados no', async () => {
    const todos = [
      await resultado('pendiente', 'a-1', '2026-10-07T11:00:00.000Z'),
      await resultado('enviando', 'a-2', '2026-10-07T11:00:00.000Z'),
      await resultado('hecha', 'a-3', '2026-10-07T11:00:00.000Z'),
    ];

    expect(cuantosResultadosSinEnviar(todos)).toBe(2);
    expect(cuantosResultadosSinEnviar([])).toBe(0);
  });
});
