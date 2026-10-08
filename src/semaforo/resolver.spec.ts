import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alCambiarLaSesion,
  cicloActual,
  encolar,
  reiniciarElCicloParaLasPruebas,
} from '../sincronizacion/ciclo.ts';
import { cambiosEnConflicto } from './composicion.ts';
import { aplicarMiCambio, quedarseConLoDelServidor } from './resolver.ts';

const NO_RECORDADA = { persistente: false };

beforeEach(async () => {
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  vi.restoreAllMocks();
  reiniciarElCicloParaLasPruebas();
});

async function laCola() {
  return [...(await cicloActual()!.almacen.operaciones())].sort(
    (una, otra) => una.orden - otra.orden,
  );
}

/** Un cambio al pendiente `p-1` que choco, y lo que se hizo despues sobre lo mismo. */
async function unChoque(opciones: { luego?: Record<string, unknown>[]; eliminar?: boolean } = {}) {
  const choco = await encolar({
    operationId: 'op-choco',
    tipo: 'pendiente.editar',
    entidad: 'pendiente:p-1',
    payload: { id: 'p-1', cambios: { version: 2, texto: 'Lo mio', nivel: 'aplazable' } },
  });

  await cicloActual()!.almacen.guardarOperacion({ ...choco, estado: 'conflicto' });

  for (const [indice, cambios] of (opciones.luego ?? []).entries()) {
    await encolar({
      operationId: `op-luego-${String(indice)}`,
      tipo: 'pendiente.editar',
      entidad: 'pendiente:p-1',
      payload: { id: 'p-1', cambios },
    });
  }

  if (opciones.eliminar === true) {
    await encolar({
      operationId: 'op-borrar',
      tipo: 'pendiente.borrar',
      entidad: 'pendiente:p-1',
      payload: { id: 'p-1' },
    });
  }

  const conflicto = cambiosEnConflicto(await laCola(), 'p-1');

  if (conflicto === null) {
    throw new Error('Se esperaba un conflicto');
  }

  return conflicto;
}

describe('quedarseConLoDelServidor', () => {
  it('tira lo que la persona cambio aqui, y lo que quedo detenido detras', async () => {
    const conflicto = await unChoque({ luego: [{ hecho: true }, { texto: 'Mas' }] });

    await encolar({
      operationId: 'op-de-otro',
      tipo: 'pendiente.editar',
      entidad: 'pendiente:p-2',
      payload: { id: 'p-2', cambios: { hecho: true } },
    });

    await quedarseConLoDelServidor(conflicto);

    // Lo de otro pendiente no se toca.
    expect((await laCola()).map((o) => o.operationId)).toEqual(['op-de-otro']);
  });

  it('no manda nada a ningun lado', async () => {
    const conflicto = await unChoque();

    await quedarseConLoDelServidor(conflicto);

    expect((await laCola()).filter((o) => o.tipo === 'pendiente.editar')).toEqual([]);
  });
});

describe('aplicarMiCambio', () => {
  it('lo vuelve a mandar con la version que tiene el servidor ahora, sin la vieja', async () => {
    const conflicto = await unChoque({ luego: [{ hecho: true }] });

    const nueva = await aplicarMiCambio(conflicto, 5);
    const cola = await laCola();

    expect(cola.map((o) => o.operationId)).toEqual([nueva]);
    expect(cola[0]).toMatchObject({
      tipo: 'pendiente.editar',
      entidad: 'pendiente:p-1',
      estado: 'pendiente',
      payload: {
        id: 'p-1',
        cambios: { texto: 'Lo mio', nivel: 'aplazable', hecho: true, version: 5 },
      },
    });
  });

  it('la nueva no depende de la vieja: tirar la vieja no se la lleva', async () => {
    const conflicto = await unChoque();

    await aplicarMiCambio(conflicto, 5);

    expect((await laCola())[0]?.dependeDe).toBeNull();
  });

  it('sin la version del servidor, no manda ninguna', async () => {
    const conflicto = await unChoque();

    await aplicarMiCambio(conflicto, undefined);

    const [nueva] = await laCola();

    expect((nueva?.payload as { cambios: object }).cambios).not.toHaveProperty('version');
  });

  it('si lo ultimo era eliminarlo, lo elimina y no lo edita', async () => {
    const conflicto = await unChoque({ eliminar: true });

    const nueva = await aplicarMiCambio(conflicto, 5);
    const cola = await laCola();

    expect(cola.map((o) => o.operationId)).toEqual([nueva]);
    expect(cola[0]).toMatchObject({
      tipo: 'pendiente.borrar',
      entidad: 'pendiente:p-1',
      payload: { id: 'p-1' },
      dependeDe: null,
    });
  });

  it('primero guarda lo nuevo: si tirar lo viejo falla, no se pierde lo que la persona escribio', async () => {
    const conflicto = await unChoque();

    vi.spyOn(cicloActual()!.almacen, 'quitarOperacion').mockRejectedValue(new Error('se cerro'));

    await expect(aplicarMiCambio(conflicto, 5)).rejects.toThrow('se cerro');

    const cola = await laCola();

    expect(cola.map((o) => o.tipo)).toEqual(['pendiente.editar', 'pendiente.editar']);
    expect(cola[1]).toMatchObject({ payload: { cambios: { texto: 'Lo mio', version: 5 } } });
  });

  it('devuelve la operacion nueva, para poder seguirla', async () => {
    const conflicto = await unChoque();

    const nueva = await aplicarMiCambio(conflicto, 5);

    expect(nueva).toMatch(/^[0-9a-f-]{36}$/);
    expect((await cicloActual()!.almacen.operacion(nueva))?.estado).toBe('pendiente');
  });
});
