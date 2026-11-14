import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { nuevaOperacion, type Operacion, type TipoDeOperacion } from './cola.ts';
import { idLocalDe } from './ejecutores.ts';
import { leerSoloLaCopia } from './lecturas.ts';
import {
  CLAVE_DEL_SEMAFORO,
  conciliarElSemaforo,
  esDelSemaforo,
  esTipoDelSemaforo,
  leerElSemaforoConCopia,
  leerLoLocalDelSemaforo,
  precargarElSemaforo,
} from './semaforoLocal.ts';

const { consultarElSemaforo } = vi.hoisted(() => ({ consultarElSemaforo: vi.fn() }));

vi.mock('../infraestructura/api/pendientes.ts', async (importar) => ({
  ...(await importar<typeof import('../infraestructura/api/pendientes.ts')>()),
  consultarElSemaforo,
}));

const NO_RECORDADA = { persistente: false };

function pendiente(extra: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    texto: 'Llamar a la EPS',
    nivel: 'urgente',
    hecho: false,
    posponerHasta: null,
    fechaLimite: null,
    version: 1,
    creadoEn: '2026-10-07T10:00:00.000Z',
    editadoEn: '2026-10-07T10:00:00.000Z',
    ...extra,
  };
}

const RECORDATORIO = {
  pendienteId: 'p-1',
  nivel: 'urgente',
  dias: 7,
  nivelSugerido: null,
  tono: 'plazo',
  fechaLimite: null,
};

let contador = 0;

/** Una operacion en la cola, en el estado que se diga. */
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
        entidad: `pendiente:e-${String(contador)}`,
        payload,
      },
      new Date('2026-10-07T11:30:00.000Z'),
    ),
  );
  const operacion = { ...agregada, ...cambios };

  await almacen.guardarOperacion(operacion);

  return operacion;
}

const hecha = (tipo: TipoDeOperacion, recibo: unknown, payload: unknown = {}) =>
  agregar(tipo, { estado: 'hecha', recibo }, payload);

async function guardarCopia(pendientes: unknown[]) {
  await cicloActual()!.almacen.guardarLectura(
    CLAVE_DEL_SEMAFORO,
    { valor: { pendientes, recordatorio: RECORDATORIO }, etag: null },
    new Date(),
  );
}

async function losPendientes() {
  const valor = await leerSoloLaCopia<{ pendientes: { id: string }[] }>(CLAVE_DEL_SEMAFORO);

  return valor?.pendientes;
}

beforeEach(async () => {
  contador = 0;
  consultarElSemaforo.mockResolvedValue({ pendientes: [], recordatorio: null });
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  reiniciarElCicloParaLasPruebas();
});

describe('esTipoDelSemaforo / esDelSemaforo', () => {
  it.each(['pendiente.crear', 'pendiente.editar', 'pendiente.borrar'] as const)(
    '%s es de los pendientes',
    (tipo) => {
      expect(esTipoDelSemaforo(tipo)).toBe(true);
    },
  );

  it.each(['diario.escribir', 'diario.editar', 'resultado.registrar'] as const)(
    '%s no lo es',
    (tipo) => {
      expect(esTipoDelSemaforo(tipo)).toBe(false);
    },
  );

  it('una operacion se reconoce por su tipo', async () => {
    expect(esDelSemaforo(await agregar('pendiente.crear'))).toBe(true);
    expect(esDelSemaforo(await agregar('diario.escribir'))).toBe(false);
  });
});

describe('leerElSemaforoConCopia', () => {
  it('lee del servidor, con su recordatorio, y deja los pendientes guardados', async () => {
    consultarElSemaforo.mockResolvedValue({
      pendientes: [pendiente()],
      recordatorio: RECORDATORIO,
    });

    const lectura = await leerElSemaforoConCopia();

    expect(lectura.deLaCopia).toBe(false);
    expect(lectura.valor).toEqual({ pendientes: [pendiente()], recordatorio: RECORDATORIO });
    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
  });

  it('pasa la senal a la API', async () => {
    const senal = new AbortController().signal;

    await leerElSemaforoConCopia(senal);

    expect(consultarElSemaforo).toHaveBeenCalledWith(senal);
  });

  it('sin conexion, con copia, devuelve la copia SIN recordatorio: ese lo dice el servidor', async () => {
    consultarElSemaforo.mockResolvedValueOnce({
      pendientes: [pendiente()],
      recordatorio: RECORDATORIO,
    });
    await leerElSemaforoConCopia();
    consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElSemaforoConCopia();

    expect(lectura.deLaCopia).toBe(true);
    expect(lectura.guardadoEn).not.toBeNull();
    expect(lectura.valor.pendientes).toEqual([pendiente()]);
    expect(lectura.valor.recordatorio).toBeNull();
  });

  it('sin conexion y sin copia, el error sale: nunca se inventa un semaforo', async () => {
    consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(leerElSemaforoConCopia()).rejects.toBeInstanceOf(TypeError);
  });

  it('un "no tienes permiso" del servidor sale tal cual, aunque haya copia', async () => {
    await leerElSemaforoConCopia();
    consultarElSemaforo.mockRejectedValue(new ErrorDeLaApi(403, 'No', undefined, 'SIN_CUENTA'));

    await expect(leerElSemaforoConCopia()).rejects.toMatchObject({ estado: 403 });
  });

  it('lo que el servidor acepto despues de preguntar se suma a lo que devuelve', async () => {
    await leerElSemaforoConCopia();
    await hecha('pendiente.crear', pendiente({ id: 'nuevo', texto: 'Recien anotado' }));
    consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElSemaforoConCopia();

    expect(lectura.valor.pendientes.map((p) => p.id)).toEqual(['nuevo']);
  });

  it('un pendiente guardado con otra forma no rompe la lectura: se deja fuera', async () => {
    await guardarCopia([pendiente(), { id: 'roto' }, 'texto', null]);
    consultarElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    const lectura = await leerElSemaforoConCopia();

    expect(lectura.valor.pendientes).toEqual([pendiente()]);
  });
});

describe('conciliarElSemaforo', () => {
  it('un pendiente anotado y enviado que no estaba en la copia se suma', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.crear', pendiente({ id: 'nuevo' }));

    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1', 'nuevo']);
  });

  it('lo que se guarda no lleva el recordatorio de antes', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.crear', pendiente({ id: 'nuevo' }));

    await conciliarElSemaforo();

    expect(await leerSoloLaCopia(CLAVE_DEL_SEMAFORO)).not.toHaveProperty('recordatorio');
  });

  it('un cambio enviado reemplaza a la version anterior', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.editar', pendiente({ version: 2, hecho: true }));

    await conciliarElSemaforo();

    expect((await losPendientes())?.[0]).toMatchObject({ version: 2, hecho: true });
  });

  it('una version menor no pisa a una mayor', async () => {
    await guardarCopia([pendiente({ version: 3, texto: 'El del servidor' })]);
    await hecha('pendiente.editar', pendiente({ version: 2, texto: 'Viejo' }));

    await conciliarElSemaforo();

    expect((await losPendientes())?.[0]).toMatchObject({ texto: 'El del servidor' });
  });

  it('la misma version con lo mismo no se vuelve a escribir', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.editar', pendiente());

    const guardar = vi.spyOn(cicloActual()!.almacen, 'guardarLectura');

    await conciliarElSemaforo();
    await conciliarElSemaforo();

    expect(guardar).not.toHaveBeenCalled();
  });

  it('un pendiente borrado y enviado sale de la copia', async () => {
    await guardarCopia([pendiente(), pendiente({ id: 'p-2' })]);
    await hecha('pendiente.borrar', null, { id: 'p-1' });

    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-2']);
  });

  it('borrar algo que ya no estaba no cambia nada ni se reescribe', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.borrar', null, { id: 'otro' });

    const guardar = vi.spyOn(cicloActual()!.almacen, 'guardarLectura');

    await conciliarElSemaforo();

    expect(guardar).not.toHaveBeenCalled();
  });

  it('uno creado sin conexion y borrado se quita con el id que respondio su creacion', async () => {
    await guardarCopia([pendiente({ id: 'servidor-7' })]);

    const creadora = await hecha('pendiente.crear', pendiente({ id: 'servidor-7' }));

    await hecha('pendiente.borrar', null, { id: idLocalDe(creadora.operationId) });
    await conciliarElSemaforo();

    expect(await losPendientes()).toEqual([]);
  });

  it('borrar uno creado sin conexion cuya creacion no dio respuesta no quita nada', async () => {
    await guardarCopia([pendiente()]);

    const creadora = await hecha('pendiente.crear', null);

    await hecha('pendiente.borrar', null, { id: idLocalDe(creadora.operationId) });
    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
  });

  it.each(['pendiente', 'enviando', 'requiere_atencion', 'conflicto'] as const)(
    'un borrado que sigue %s no quita nada: el servidor todavia no lo acepto',
    async (estado) => {
      await guardarCopia([pendiente()]);
      await agregar('pendiente.borrar', { estado }, { id: 'p-1' });

      await conciliarElSemaforo();

      expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
    },
  );

  it('un servidor sin version en los pendientes tambien se concilia: lo ultimo que dijo manda', async () => {
    await guardarCopia([pendiente({ version: undefined, texto: 'Viejo' })]);
    await hecha('pendiente.editar', pendiente({ version: undefined, texto: 'Nuevo' }));

    await conciliarElSemaforo();

    expect((await losPendientes())?.[0]).toMatchObject({ texto: 'Nuevo' });
  });

  it('un borrado sin id no quita nada', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.borrar', null, {});
    await hecha('pendiente.borrar', null, null);

    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
  });

  it.each([
    ['una que sigue pendiente', { estado: 'pendiente' as const, recibo: null }],
    ['una que necesita atencion', { estado: 'requiere_atencion' as const, recibo: null }],
    ['una que choco', { estado: 'conflicto' as const, recibo: null }],
    ['una con un recibo que no es un pendiente', { estado: 'hecha' as const, recibo: { id: 'x' } }],
  ])('%s no suma nada', async (_nombre, cambios) => {
    await guardarCopia([pendiente()]);
    await agregar('pendiente.crear', cambios);

    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
  });

  it('una operacion de otra cosa no suma nada aunque su recibo parezca un pendiente', async () => {
    await guardarCopia([pendiente()]);
    await hecha('diario.escribir', pendiente({ id: 'intruso' }));

    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
  });

  it('sin una copia no la arma con unos cuantos pendientes', async () => {
    await hecha('pendiente.crear', pendiente());

    await conciliarElSemaforo();

    expect(await losPendientes()).toBeUndefined();
  });

  it('dos conciliaciones que se solapan no se pisan', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.crear', pendiente({ id: 'nuevo-1' }));

    const almacen = cicloActual()!.almacen;
    const guardar = almacen.guardarLectura.bind(almacen);
    let primera = true;

    vi.spyOn(almacen, 'guardarLectura').mockImplementation(async (clave, valor, ahora) => {
      if (primera) {
        primera = false;
        await new Promise((resolver) => setTimeout(resolver, 40));
      }

      await guardar(clave, valor, ahora);
    });

    const una = conciliarElSemaforo();

    await hecha('pendiente.crear', pendiente({ id: 'nuevo-2' }));

    const otra = conciliarElSemaforo();

    await Promise.all([una, otra]);

    expect((await losPendientes())?.map((p) => p.id).sort()).toEqual(['nuevo-1', 'nuevo-2', 'p-1']);
  });

  it('sin almacen abierto no hace nada y no falla', async () => {
    reiniciarElCicloParaLasPruebas();

    await expect(conciliarElSemaforo()).resolves.toBeUndefined();
  });

  it('si el almacen falla, no rechaza: la siguiente vez lo intenta de nuevo', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.crear', pendiente({ id: 'nuevo' }));

    const operaciones = vi
      .spyOn(cicloActual()!.almacen, 'operaciones')
      .mockRejectedValueOnce(new Error('se cerro'));

    await expect(conciliarElSemaforo()).resolves.toBeUndefined();

    operaciones.mockRestore();
    await conciliarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1', 'nuevo']);
  });
});

describe('leerLoLocalDelSemaforo', () => {
  it('sin nada guardado, no hay copia ni pendientes', async () => {
    expect(await leerLoLocalDelSemaforo()).toEqual({ instantanea: null, pendientes: [] });
  });

  it('sin almacen abierto, tampoco', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLoLocalDelSemaforo()).toEqual({ instantanea: null, pendientes: [] });
  });

  it('trae la copia y lo pendiente, en el orden en que se hizo', async () => {
    await guardarCopia([pendiente()]);

    const primera = await agregar('pendiente.crear');
    const segunda = await agregar('pendiente.editar', { estado: 'enviando' });
    const tercera = await agregar('pendiente.borrar', { estado: 'conflicto' });

    const local = await leerLoLocalDelSemaforo();

    expect(local.instantanea?.pendientes).toEqual([pendiente()]);
    expect(local.pendientes.map((o) => o.operationId)).toEqual([
      primera.operationId,
      segunda.operationId,
      tercera.operationId,
    ]);
  });

  it('no trae lo ya enviado, lo ilegible ni lo de otra cosa', async () => {
    await agregar('pendiente.crear', { estado: 'hecha', recibo: pendiente() });
    await agregar('pendiente.crear', { ilegible: true });
    await agregar('diario.escribir');
    await agregar('resultado.registrar');

    const buena = await agregar('pendiente.crear');

    expect((await leerLoLocalDelSemaforo()).pendientes.map((o) => o.operationId)).toEqual([
      buena.operationId,
    ]);
  });

  it('una copia guardada con otra forma es como no tenerla', async () => {
    await cicloActual()!.almacen.guardarLectura(
      CLAVE_DEL_SEMAFORO,
      { valor: 'otra cosa', etag: null },
      new Date(),
    );

    expect((await leerLoLocalDelSemaforo()).instantanea).toBeNull();
  });

  it.each([
    ['un texto', 'x'],
    ['un numero', 5],
    ['nada', null],
    ['un objeto', {}],
  ])('una copia cuya lista de pendientes es %s es como no tenerla', async (_nombre, pendientes) => {
    await cicloActual()!.almacen.guardarLectura(
      CLAVE_DEL_SEMAFORO,
      { valor: { pendientes }, etag: null },
      new Date(),
    );

    expect((await leerLoLocalDelSemaforo()).instantanea).toBeNull();
  });

  it('antes de leer, concilia: lo que ya se envio esta en la copia que devuelve', async () => {
    await guardarCopia([pendiente()]);
    await hecha('pendiente.crear', pendiente({ id: 'nuevo' }));

    const local = await leerLoLocalDelSemaforo();

    expect(local.instantanea?.pendientes.map((p) => p.id)).toEqual(['p-1', 'nuevo']);
    expect(local.pendientes).toEqual([]);
  });

  it('si no se pueden leer las operaciones, lo demas se lee igual', async () => {
    await guardarCopia([pendiente()]);
    vi.spyOn(cicloActual()!.almacen, 'operaciones').mockRejectedValue(new Error('se cerro'));

    const local = await leerLoLocalDelSemaforo();

    expect(local.instantanea?.pendientes).toHaveLength(1);
    expect(local.pendientes).toEqual([]);
  });
});

describe('precargarElSemaforo', () => {
  it('lee el semaforo para dejarlo guardado', async () => {
    consultarElSemaforo.mockResolvedValue({ pendientes: [pendiente()], recordatorio: null });

    await precargarElSemaforo();

    expect((await losPendientes())?.map((p) => p.id)).toEqual(['p-1']);
  });
});
