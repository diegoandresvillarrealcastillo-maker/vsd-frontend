import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { leerConCopia, leerSoloLaCopia } from './lecturas.ts';
import { conciliarElDiario, type InstantaneaDelDiario } from './diarioLocal.ts';
import { conciliarElSemaforo, type InstantaneaDelSemaforo } from './semaforoLocal.ts';
import { nuevaOperacion } from './cola.ts';

function diferida<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarElCicloParaLasPruebas();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await alCambiarLaSesion(null, { persistente: true });
  reiniciarElCicloParaLasPruebas();
});

it('descarta una lectura de A que termina cuando B ya entro', async () => {
  await alCambiarLaSesion('audit-A', { persistente: true });
  expect(cicloActual()!.almacen.persistente).toBe(true);
  const iniciada = diferida<void>();
  const respuesta = diferida<{ estado: 'nuevo'; valor: string; etag: null }>();
  const pendiente = leerConCopia('diario', () => {
    iniciada.resolve();
    return respuesta.promise;
  });
  const rechazada = expect(pendiente).rejects.toMatchObject({ name: 'AbortError' });
  await iniciada.promise;
  await alCambiarLaSesion('audit-B', { persistente: true });
  respuesta.resolve({ estado: 'nuevo', valor: 'PRIVADO_DE_A', etag: null });
  await rechazada;
  expect(await leerSoloLaCopia('diario')).toBeNull();
});

it('no concilia recibos de A dentro del diario IndexedDB de B', async () => {
  await alCambiarLaSesion('audit-A', { persistente: true });
  const almacenA = cicloActual()!.almacen;
  expect(almacenA.persistente).toBe(true);
  const fecha = '2026-10-25T12:00:00.000Z';
  const reciboA = {
    id: 'anotacion-A',
    dia: '2026-10-25',
    titulo: 'PRIVADO_DE_A',
    contenido: { type: 'doc', content: [] },
    adjuntos: [],
    version: 1,
    creadaEn: fecha,
    editadaEn: fecha,
    editableHasta: fecha,
  };
  const operacion = await almacenA.agregarOperacion(
    nuevaOperacion(
      {
        operationId: 'operacion-A',
        tipo: 'diario.escribir',
        entidad: 'diario:A',
        payload: {},
      },
      new Date(fecha),
    ),
  );
  await almacenA.guardarOperacion({ ...operacion, estado: 'hecha', recibo: reciboA });
  const consultar = almacenA.operaciones.bind(almacenA);
  const leidas = diferida<void>();
  const continuar = diferida<void>();
  vi.spyOn(almacenA, 'operaciones').mockImplementationOnce(async () => {
    const filas = await consultar();
    leidas.resolve();
    await continuar.promise;
    return filas;
  });

  const conciliacion = conciliarElDiario();
  await leidas.promise;
  await alCambiarLaSesion('audit-B', { persistente: true });
  const originalB: InstantaneaDelDiario = {
    desde: '2026-10-01',
    hasta: '2026-10-25',
    anotaciones: [],
  };
  await cicloActual()!.almacen.guardarLectura(
    'diario',
    { valor: originalB, etag: null },
    new Date(fecha),
  );
  continuar.resolve();
  await conciliacion;
  expect(await leerSoloLaCopia('diario')).toEqual(originalB);
});

it('no concilia recibos de A dentro del semaforo IndexedDB de B', async () => {
  await alCambiarLaSesion('audit-A', { persistente: true });
  const almacenA = cicloActual()!.almacen;
  const fecha = '2026-10-25T12:00:00.000Z';
  const reciboA = {
    id: 'pendiente-A',
    texto: 'PRIVADO_DE_A',
    nivel: 'urgente',
    hecho: false,
    posponerHasta: null,
    fechaLimite: null,
    creadoEn: fecha,
    editadoEn: fecha,
    version: 1,
  };
  const operacion = await almacenA.agregarOperacion(
    nuevaOperacion(
      { operationId: 'operacion-A', tipo: 'pendiente.crear', entidad: 'pendiente:A', payload: {} },
      new Date(fecha),
    ),
  );
  await almacenA.guardarOperacion({ ...operacion, estado: 'hecha', recibo: reciboA });
  const consultar = almacenA.operaciones.bind(almacenA);
  const leidas = diferida<void>();
  const continuar = diferida<void>();
  vi.spyOn(almacenA, 'operaciones').mockImplementationOnce(async () => {
    const filas = await consultar();
    leidas.resolve();
    await continuar.promise;
    return filas;
  });

  const conciliacion = conciliarElSemaforo();
  await leidas.promise;
  await alCambiarLaSesion('audit-B', { persistente: true });
  const originalB: InstantaneaDelSemaforo = { pendientes: [] };
  await cicloActual()!.almacen.guardarLectura(
    'semaforo',
    { valor: originalB, etag: null },
    new Date(fecha),
  );
  continuar.resolve();
  await conciliacion;
  expect(await leerSoloLaCopia('semaforo')).toEqual(originalB);
});
