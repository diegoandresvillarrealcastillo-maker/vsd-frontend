import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { nuevaOperacion, type Operacion, type TipoDeOperacion } from './cola.ts';
import {
  CLAVE_DE_LAS_COPIAS_DEL_DIARIO,
  CLAVE_DEL_DIARIO,
  conciliarElDiario,
  leerElDiarioConCopia,
  leerLoLocalDelDiario,
  precargarElDiario,
  ventanaDelDiario,
  type InstantaneaDelDiario,
} from './diarioLocal.ts';
import { leerSoloLaCopia } from './lecturas.ts';

const { consultarElDiario, consultarLaVersionDelAviso, darDeAltaLaCuenta } = vi.hoisted(() => ({
  consultarElDiario: vi.fn(),
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
}));

vi.mock('../infraestructura/api/diario.ts', async (importar) => ({
  ...(await importar<typeof import('../infraestructura/api/diario.ts')>()),
  consultarElDiario,
}));
vi.mock('../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../infraestructura/api/cuenta.ts', () => ({ darDeAltaLaCuenta }));

const NO_RECORDADA = { persistente: false };
const VENTANA = { desde: '2026-09-08', hasta: '2026-10-07' };

function anotacion(extra: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    dia: '2026-10-07',
    titulo: null,
    contenido: { type: 'doc', content: [] },
    adjuntos: [],
    version: 1,
    creadaEn: '2026-10-07T11:00:00.000Z',
    editadaEn: '2026-10-07T11:00:00.000Z',
    editableHasta: '2026-10-07T12:00:00.000Z',
    ...extra,
  };
}

let contador = 0;

/** Una operacion del diario en la cola, en el estado que se diga. */
async function agregar(
  tipo: TipoDeOperacion,
  cambios: Partial<Operacion> = {},
  payload: unknown = {},
): Promise<Operacion> {
  contador += 1;

  const almacen = cicloActual()!.almacen;
  const agregada = await almacen.agregarOperacion(
    nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo,
        entidad: `diario:e-${String(contador)}`,
        payload,
      },
      new Date('2026-10-07T11:30:00.000Z'),
    ),
  );
  const operacion = { ...agregada, ...cambios };

  await almacen.guardarOperacion(operacion);

  return operacion;
}

function hecha(tipo: TipoDeOperacion, recibo: unknown) {
  return agregar(tipo, { estado: 'hecha', recibo });
}

async function guardarInstantanea(anotaciones: unknown[], ventana = VENTANA) {
  await cicloActual()!.almacen.guardarLectura(
    CLAVE_DEL_DIARIO,
    { valor: { ...ventana, anotaciones }, etag: null },
    new Date(),
  );
}

async function laInstantanea() {
  return leerSoloLaCopia<InstantaneaDelDiario>(CLAVE_DEL_DIARIO);
}

beforeEach(async () => {
  contador = 0;
  fijarLaZonaDeLaCuenta('America/Bogota');
  consultarElDiario.mockResolvedValue([]);
  consultarLaVersionDelAviso.mockResolvedValue('1.0');
  darDeAltaLaCuenta.mockResolvedValue({ mascota: null });
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  reiniciarElCicloParaLasPruebas();
});

describe('ventanaDelDiario', () => {
  it('son los ultimos 30 dias contando hoy', () => {
    expect(ventanaDelDiario(new Date('2026-10-07T17:00:00.000Z'))).toEqual(VENTANA);
  });

  it('hoy se cuenta en la zona de la persona, no en UTC', () => {
    // 9 p. m. del 7 en Bogota: ya es 8 en UTC.
    expect(ventanaDelDiario(new Date('2026-10-08T02:00:00.000Z')).hasta).toBe('2026-10-07');
  });
});

describe('leerElDiarioConCopia', () => {
  it('lee del servidor la ventana pedida y la deja guardada', async () => {
    consultarElDiario.mockResolvedValue([anotacion()]);

    const lectura = await leerElDiarioConCopia(VENTANA);

    expect(consultarElDiario).toHaveBeenCalledWith(VENTANA.desde, VENTANA.hasta, undefined);
    expect(lectura.deLaCopia).toBe(false);
    expect(lectura.valor).toEqual({ ...VENTANA, anotaciones: [anotacion()] });
    expect(await laInstantanea()).toEqual({ ...VENTANA, anotaciones: [anotacion()] });
  });

  it('no da de alta la cuenta, a menos que se pida', async () => {
    await leerElDiarioConCopia(VENTANA);

    expect(consultarLaVersionDelAviso).not.toHaveBeenCalled();
    expect(darDeAltaLaCuenta).not.toHaveBeenCalled();
  });

  it('si se pide, da de alta la cuenta con la version vigente ANTES de leer', async () => {
    const orden: string[] = [];

    consultarLaVersionDelAviso.mockImplementation(() => {
      orden.push('version');

      return Promise.resolve('2.0');
    });
    darDeAltaLaCuenta.mockImplementation(() => {
      orden.push('alta');

      return Promise.resolve({});
    });
    consultarElDiario.mockImplementation(() => {
      orden.push('lectura');

      return Promise.resolve([]);
    });

    const senal = new AbortController().signal;

    await leerElDiarioConCopia(VENTANA, { darDeAlta: true, senal });

    expect(orden).toEqual(['version', 'alta', 'lectura']);
    expect(consultarLaVersionDelAviso).toHaveBeenCalledWith(senal);
    expect(darDeAltaLaCuenta).toHaveBeenCalledWith('2.0', senal);
    expect(consultarElDiario).toHaveBeenCalledWith(VENTANA.desde, VENTANA.hasta, senal);
  });

  it('sin conexion, con copia, devuelve la copia y dice que lo es', async () => {
    consultarElDiario.mockResolvedValueOnce([anotacion({ titulo: 'Guardada' })]);
    await leerElDiarioConCopia(VENTANA);
    consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElDiarioConCopia(VENTANA);

    expect(lectura.deLaCopia).toBe(true);
    expect(lectura.guardadoEn).not.toBeNull();
    expect(lectura.valor.anotaciones).toEqual([anotacion({ titulo: 'Guardada' })]);
  });

  it('sin conexion y sin copia, el error sale: nunca se inventa un diario', async () => {
    consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(leerElDiarioConCopia(VENTANA)).rejects.toBeInstanceOf(TypeError);
  });

  it('un "no tienes permiso" del servidor sale tal cual, aunque haya copia', async () => {
    await leerElDiarioConCopia(VENTANA);
    consultarElDiario.mockRejectedValue(new ErrorDeLaApi(403, 'No', undefined, 'SIN_PERMISO'));

    await expect(leerElDiarioConCopia(VENTANA)).rejects.toMatchObject({ estado: 403 });
  });

  it('lo que el servidor acepto despues de preguntar se suma a lo que devuelve', async () => {
    await leerElDiarioConCopia(VENTANA);
    await hecha('diario.escribir', { ...anotacion({ id: 'nueva' }), sugiereAcompanamiento: false });
    consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElDiarioConCopia(VENTANA);

    expect(lectura.valor.anotaciones.map((a) => a.id)).toEqual(['nueva']);
  });

  it('una anotacion guardada con otra forma no rompe la lectura: se deja fuera', async () => {
    await guardarInstantanea([anotacion(), { id: 'rota' }, 'texto', null]);
    consultarElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElDiarioConCopia(VENTANA);

    expect(lectura.valor.anotaciones).toEqual([anotacion()]);
  });
});

describe('conciliarElDiario', () => {
  it('una anotacion enviada que no estaba en la copia se suma, sin lo que acompana a la respuesta', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.escribir', {
      ...anotacion({ id: 'nueva', titulo: 'Nueva' }),
      sugiereAcompanamiento: true,
      lineasDeAtencion: [{ id: 'l-1' }],
    });

    await conciliarElDiario();

    const guardada = await laInstantanea();

    expect(guardada?.anotaciones).toEqual([
      anotacion(),
      anotacion({ id: 'nueva', titulo: 'Nueva' }),
    ]);
    expect(guardada?.anotaciones[1]).not.toHaveProperty('sugiereAcompanamiento');
    expect(guardada?.anotaciones[1]).not.toHaveProperty('lineasDeAtencion');
  });

  it('una de antes de la ventana no se suma: no es de los ultimos 30 dias', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.escribir', anotacion({ id: 'vieja', dia: '2026-09-07' }));

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones.map((a) => a.id)).toEqual(['a-1']);
  });

  it('el primer dia de la ventana si entra', async () => {
    await guardarInstantanea([]);
    await hecha('diario.escribir', anotacion({ id: 'limite', dia: '2026-09-08' }));

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones.map((a) => a.id)).toEqual(['limite']);
  });

  it('una correccion enviada reemplaza a la version anterior', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.editar', anotacion({ version: 2, titulo: 'Corregida' }));

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones).toEqual([
      anotacion({ version: 2, titulo: 'Corregida' }),
    ]);
  });

  it('una version menor no pisa a una mayor', async () => {
    await guardarInstantanea([anotacion({ version: 3, titulo: 'La del servidor' })]);
    await hecha('diario.editar', anotacion({ version: 2, titulo: 'Vieja' }));

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones[0]?.titulo).toBe('La del servidor');
  });

  it('de dos correcciones, queda la ultima sin importar cual se lea primero', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.editar', anotacion({ version: 2, titulo: 'Segunda' }));
    await hecha('diario.editar', anotacion({ version: 3, titulo: 'Tercera' }));

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones[0]).toMatchObject({
      version: 3,
      titulo: 'Tercera',
    });
  });

  it('lo que ya esta igual no se vuelve a escribir', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.escribir', anotacion());

    const guardar = vi.spyOn(cicloActual()!.almacen, 'guardarLectura');

    await conciliarElDiario();
    await conciliarElDiario();

    expect(guardar).not.toHaveBeenCalled();
  });

  it('repetirla no cambia nada', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.escribir', anotacion({ id: 'nueva' }));

    await conciliarElDiario();

    const primera = await laInstantanea();

    await conciliarElDiario();
    await conciliarElDiario();

    expect(await laInstantanea()).toEqual(primera);
  });

  it.each([
    ['una que sigue pendiente', { estado: 'pendiente' as const, recibo: null }],
    ['una que se esta enviando', { estado: 'enviando' as const, recibo: null }],
    ['una que necesita atencion', { estado: 'requiere_atencion' as const, recibo: null }],
    [
      'una con un recibo que no es una anotacion',
      { estado: 'hecha' as const, recibo: { id: 'x' } },
    ],
    ['una sin recibo', { estado: 'hecha' as const, recibo: null }],
  ])('%s no suma nada', async (_nombre, cambios) => {
    await guardarInstantanea([anotacion()]);
    await agregar('diario.escribir', cambios);

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones.map((a) => a.id)).toEqual(['a-1']);
  });

  it('una operacion de otra cosa no suma nada aunque su recibo parezca una anotacion', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('pendiente.crear', anotacion({ id: 'intrusa' }));

    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones.map((a) => a.id)).toEqual(['a-1']);
  });

  it('sin una copia del diario no la arma con unas cuantas anotaciones', async () => {
    await hecha('diario.escribir', anotacion());

    await conciliarElDiario();

    expect(await laInstantanea()).toBeNull();
  });

  describe('las copias', () => {
    const COPIA = {
      ...anotacion({ id: 'copia-1' }),
      copiaDe: 'a-1',
      motivo: 'VERSION_DESACTUALIZADA',
    };

    async function lasMarcas() {
      return leerSoloLaCopia<unknown>(CLAVE_DE_LAS_COPIAS_DEL_DIARIO);
    }

    it('de cual es copia una anotacion queda guardado, y la copia entra al diario', async () => {
      await guardarInstantanea([anotacion()]);
      await hecha('diario.editar', COPIA);

      await conciliarElDiario();

      expect(await lasMarcas()).toEqual({
        'copia-1': { copiaDe: 'a-1', motivo: 'VERSION_DESACTUALIZADA' },
      });
      expect((await laInstantanea())?.anotaciones.map((a) => a.id)).toEqual(['a-1', 'copia-1']);
      expect((await laInstantanea())?.anotaciones[1]).not.toHaveProperty('copiaDe');
    });

    it('queda guardado aunque todavia no haya una copia del diario', async () => {
      await hecha('diario.editar', COPIA);

      await conciliarElDiario();

      expect(await lasMarcas()).toEqual({
        'copia-1': { copiaDe: 'a-1', motivo: 'VERSION_DESACTUALIZADA' },
      });
    });

    it('guarda el motivo de cada una', async () => {
      await hecha('diario.editar', COPIA);
      await hecha('diario.editar', {
        ...anotacion({ id: 'copia-2' }),
        copiaDe: 'a-2',
        motivo: 'EDICION_FUERA_DE_PLAZO',
      });

      await conciliarElDiario();

      expect(await lasMarcas()).toEqual({
        'copia-1': { copiaDe: 'a-1', motivo: 'VERSION_DESACTUALIZADA' },
        'copia-2': { copiaDe: 'a-2', motivo: 'EDICION_FUERA_DE_PLAZO' },
      });
    });

    it('las anteriores se conservan cuando llegan otras, aunque la operacion de aquellas ya no este', async () => {
      const primera = await hecha('diario.editar', COPIA);

      await conciliarElDiario();
      await cicloActual()!.almacen.quitarOperacion(primera.operationId);
      await hecha('diario.editar', {
        ...anotacion({ id: 'copia-2' }),
        copiaDe: 'a-2',
        motivo: 'EDICION_FUERA_DE_PLAZO',
      });
      await conciliarElDiario();

      expect(Object.keys((await lasMarcas()) as object)).toEqual(['copia-1', 'copia-2']);
    });

    it('una anotacion normal no es copia de nada', async () => {
      await hecha('diario.editar', anotacion({ id: 'normal' }));

      await conciliarElDiario();

      expect(await lasMarcas()).toBeNull();
    });

    it('sin cambios no se vuelve a escribir', async () => {
      await hecha('diario.editar', COPIA);
      await conciliarElDiario();

      const guardar = vi.spyOn(cicloActual()!.almacen, 'guardarLectura');

      await conciliarElDiario();

      expect(guardar).not.toHaveBeenCalled();
    });

    it('una marca guardada que no se entiende se deja fuera y no rompe lo demas', async () => {
      await cicloActual()!.almacen.guardarLectura(
        CLAVE_DE_LAS_COPIAS_DEL_DIARIO,
        {
          valor: {
            'mala-1': { copiaDe: '', motivo: 'VERSION_DESACTUALIZADA' },
            'mala-2': { copiaDe: 'a-0', motivo: 'OTRO' },
            'mala-3': 'texto',
          },
          etag: null,
        },
        new Date(),
      );
      await hecha('diario.editar', COPIA);

      await conciliarElDiario();

      expect(await lasMarcas()).toEqual({
        'copia-1': { copiaDe: 'a-1', motivo: 'VERSION_DESACTUALIZADA' },
      });
    });
  });

  it('dos conciliaciones a la vez no se pisan', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.escribir', anotacion({ id: 'nueva-1' }));
    await hecha('diario.escribir', anotacion({ id: 'nueva-2' }));

    await Promise.all([conciliarElDiario(), conciliarElDiario(), conciliarElDiario()]);

    expect((await laInstantanea())?.anotaciones.map((a) => a.id).sort()).toEqual([
      'a-1',
      'nueva-1',
      'nueva-2',
    ]);
  });

  it('dos conciliaciones que se solapan no se pisan: la segunda parte de lo que dejo la primera', async () => {
    const copia = (id: string) => ({
      ...anotacion({ id }),
      copiaDe: 'a-1',
      motivo: 'VERSION_DESACTUALIZADA',
    });
    const almacen = cicloActual()!.almacen;
    const guardar = almacen.guardarLectura.bind(almacen);
    let primera = true;

    await hecha('diario.editar', copia('copia-a'));

    // La primera tarda en escribir: si la segunda no la espera, lee lo de antes y la pisa.
    vi.spyOn(almacen, 'guardarLectura').mockImplementation(async (clave, valor, ahora) => {
      if (primera) {
        primera = false;
        await new Promise((resolver) => setTimeout(resolver, 40));
      }

      await guardar(clave, valor, ahora);
    });

    const una = conciliarElDiario();

    await hecha('diario.editar', copia('copia-b'));

    const otra = conciliarElDiario();

    await Promise.all([una, otra]);

    const marcas = await leerSoloLaCopia<Record<string, unknown>>(CLAVE_DE_LAS_COPIAS_DEL_DIARIO);

    expect(Object.keys(marcas ?? {}).sort()).toEqual(['copia-a', 'copia-b']);
  });

  it('sin almacen abierto no hace nada y no falla', async () => {
    reiniciarElCicloParaLasPruebas();

    await expect(conciliarElDiario()).resolves.toBeUndefined();
  });

  it('si el almacen falla, no rechaza: la siguiente vez lo intenta de nuevo', async () => {
    await guardarInstantanea([anotacion()]);
    await hecha('diario.escribir', anotacion({ id: 'nueva' }));

    const operaciones = vi
      .spyOn(cicloActual()!.almacen, 'operaciones')
      .mockRejectedValueOnce(new Error('se cerro'));

    await expect(conciliarElDiario()).resolves.toBeUndefined();

    operaciones.mockRestore();
    await conciliarElDiario();

    expect((await laInstantanea())?.anotaciones.map((a) => a.id)).toEqual(['a-1', 'nueva']);
  });
});

describe('leerLoLocalDelDiario', () => {
  it('sin nada guardado, no hay copia, ni marcas, ni pendientes', async () => {
    expect(await leerLoLocalDelDiario()).toEqual({ instantanea: null, marcas: {}, pendientes: [] });
  });

  it('sin almacen abierto, tampoco', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLoLocalDelDiario()).toEqual({ instantanea: null, marcas: {}, pendientes: [] });
  });

  it('trae la copia y lo pendiente del diario, en el orden en que se hizo', async () => {
    await guardarInstantanea([anotacion()]);

    const primera = await agregar('diario.escribir', {}, { dia: '2026-10-07' });
    const segunda = await agregar('diario.editar', { estado: 'enviando' }, { id: 'a-1' });
    const tercera = await agregar('diario.editar', { estado: 'requiere_atencion' }, { id: 'a-1' });

    const local = await leerLoLocalDelDiario();

    expect(local.instantanea?.anotaciones).toEqual([anotacion()]);
    expect(local.pendientes.map((o) => o.operationId)).toEqual([
      primera.operationId,
      segunda.operationId,
      tercera.operationId,
    ]);
  });

  it('no trae lo ya enviado, lo ilegible ni lo de otra cosa', async () => {
    await agregar('diario.escribir', { estado: 'hecha', recibo: anotacion() });
    await agregar('diario.escribir', { ilegible: true });
    await agregar('pendiente.crear');
    await agregar('resultado.registrar');
    const buena = await agregar('diario.escribir');

    expect((await leerLoLocalDelDiario()).pendientes.map((o) => o.operationId)).toEqual([
      buena.operationId,
    ]);
  });

  it('trae las marcas de copia', async () => {
    await hecha('diario.editar', {
      ...anotacion({ id: 'copia-1' }),
      copiaDe: 'a-1',
      motivo: 'EDICION_FUERA_DE_PLAZO',
    });

    expect((await leerLoLocalDelDiario()).marcas).toEqual({
      'copia-1': { copiaDe: 'a-1', motivo: 'EDICION_FUERA_DE_PLAZO' },
    });
  });

  it('una copia del diario guardada con otra forma es como no tenerla', async () => {
    await cicloActual()!.almacen.guardarLectura(
      CLAVE_DEL_DIARIO,
      { valor: 'otra cosa', etag: null },
      new Date(),
    );

    expect((await leerLoLocalDelDiario()).instantanea).toBeNull();
  });

  it('si no se pueden leer las operaciones, lo demas se lee igual', async () => {
    await guardarInstantanea([anotacion()]);
    vi.spyOn(cicloActual()!.almacen, 'operaciones').mockRejectedValue(new Error('se cerro'));

    const local = await leerLoLocalDelDiario();

    expect(local.instantanea?.anotaciones).toHaveLength(1);
    expect(local.pendientes).toEqual([]);
  });
});

describe('precargarElDiario', () => {
  it('lee los ultimos 30 dias, sin dar de alta la cuenta', async () => {
    consultarElDiario.mockResolvedValue([anotacion()]);

    await precargarElDiario();

    const hoy = ventanaDelDiario();

    expect(consultarElDiario).toHaveBeenCalledWith(hoy.desde, hoy.hasta, undefined);
    expect(darDeAltaLaCuenta).not.toHaveBeenCalled();
    expect((await laInstantanea())?.anotaciones).toHaveLength(1);
  });
});
