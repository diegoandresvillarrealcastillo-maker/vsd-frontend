import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reintentarCambio, descartarCambio, cuantosDependenDe } from './acciones.ts';
import {
  alCambiarLaSesion,
  cicloActual,
  reiniciarElCicloParaLasPruebas,
  suscribirALaCola,
} from './ciclo.ts';
import { nuevaOperacion, type EstadoDeOperacion, type Operacion } from './cola.ts';

const NO_RECORDADA = { persistente: false };
const AHORA = new Date('2026-10-07T12:00:00.000Z');

/** Guarda una operacion en el almacen abierto, en el estado que se pida. */
async function guardar(
  operationId: string,
  cambios: Partial<Operacion> & { estado?: EstadoDeOperacion } = {},
): Promise<Operacion> {
  const ciclo = cicloActual();

  if (ciclo === null) {
    throw new Error('no hay almacen abierto');
  }

  const nueva = await ciclo.almacen.agregarOperacion(
    nuevaOperacion(
      {
        operationId,
        tipo: 'pendiente.crear',
        entidad: `pendiente:${operationId}`,
        payload: { clientOperationId: operationId, texto: 'Llamar', nivel: 'urgente' },
        ...(cambios.dependeDe === undefined ? {} : { dependeDe: cambios.dependeDe }),
      },
      AHORA,
    ),
  );
  const conCambios = { ...nueva, ...cambios };

  await ciclo.almacen.guardarOperacion(conCambios);

  return conCambios;
}

async function estado(operationId: string): Promise<Operacion | null> {
  return (await cicloActual()?.almacen.operacion(operationId)) ?? null;
}

async function ids(): Promise<string[]> {
  return ((await cicloActual()?.almacen.operaciones()) ?? []).map((o) => o.operationId).sort();
}

const RECHAZADA = {
  estado: 'requiere_atencion' as const,
  intentos: 5,
  proximoIntento: '2026-10-07T13:00:00.000Z',
  error: { codigo: 'PENDIENTE_INVALIDO', estado: 400, momento: '2026-10-07T12:30:00.000Z' },
};

beforeEach(async () => {
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  reiniciarElCicloParaLasPruebas();
});

describe('reintentarCambio (SCRUM-137)', () => {
  it('devuelve a la cola lo que se rechazo, como si fuera nuevo', async () => {
    await guardar('a', RECHAZADA);

    expect(await reintentarCambio('a')).toBe(true);
    expect(await estado('a')).toMatchObject({
      estado: 'pendiente',
      intentos: 0,
      proximoIntento: null,
      error: null,
    });
  });

  it('no toca nada mas de la operacion: ni su contenido, ni su identificador, ni su sitio en la cola', async () => {
    const antes = await guardar('a', RECHAZADA);

    await reintentarCambio('a');

    expect(await estado('a')).toEqual({
      ...antes,
      estado: 'pendiente',
      intentos: 0,
      proximoIntento: null,
      error: null,
    });
  });

  it('avisa que la cola cambio', async () => {
    const oyente = vi.fn();

    await guardar('a', RECHAZADA);
    suscribirALaCola(oyente);
    await reintentarCambio('a');

    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('un conflicto no se reintenta: volveria a chocar con lo mismo', async () => {
    await guardar('a', { estado: 'conflicto' });

    expect(await reintentarCambio('a')).toBe(false);
    expect((await estado('a'))?.estado).toBe('conflicto');
  });

  it.each(['pendiente', 'enviando', 'hecha'] as const)(
    'lo que esta %s no es de la persona',
    async (valor) => {
      await guardar('a', { estado: valor, intentos: 3 });

      expect(await reintentarCambio('a')).toBe(false);
      expect(await estado('a')).toMatchObject({ estado: valor, intentos: 3 });
    },
  );

  it('lo que no se pudo leer no se reenvia: no hay con que', async () => {
    await guardar('a', { ...RECHAZADA, ilegible: true });

    expect(await reintentarCambio('a')).toBe(false);
    expect((await estado('a'))?.estado).toBe('requiere_atencion');
  });

  it('algo que ya no esta, no', async () => {
    expect(await reintentarCambio('no-existe')).toBe(false);
  });

  it('sin almacen abierto, no', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await reintentarCambio('a')).toBe(false);
  });

  it('no avisa si no hizo nada', async () => {
    const oyente = vi.fn();

    await guardar('a', { estado: 'conflicto' });
    suscribirALaCola(oyente);
    await reintentarCambio('a');
    await reintentarCambio('no-existe');

    expect(oyente).not.toHaveBeenCalled();
  });

  it('lo que dependia de ella sigue esperando a que termine', async () => {
    await guardar('crear', RECHAZADA);
    await guardar('editar', { dependeDe: 'crear' });

    await reintentarCambio('crear');

    expect((await estado('editar'))?.dependeDe).toBe('crear');
    expect((await estado('editar'))?.estado).toBe('pendiente');
  });
});

describe('descartarCambio (SCRUM-137)', () => {
  it('tira lo que requeria atencion y lo dice', async () => {
    await guardar('a', RECHAZADA);
    await guardar('b');

    expect(await descartarCambio('a')).toEqual(['a']);
    expect(await ids()).toEqual(['b']);
  });

  it('tira tambien un conflicto', async () => {
    await guardar('a', { estado: 'conflicto' });

    expect(await descartarCambio('a')).toEqual(['a']);
    expect(await ids()).toEqual([]);
  });

  it('se lleva lo que dependia de ello, de la que sea, y nada mas', async () => {
    await guardar('crear', RECHAZADA);
    await guardar('editar', { dependeDe: 'crear' });
    await guardar('borrar', { dependeDe: 'editar' });
    await guardar('otra');

    const quitadas = await descartarCambio('crear');

    expect(quitadas[0]).toBe('crear');
    expect([...quitadas].sort()).toEqual(['borrar', 'crear', 'editar']);
    expect(await ids()).toEqual(['otra']);
  });

  it('descartar lo de en medio no toca lo que estaba antes', async () => {
    await guardar('crear');
    await guardar('editar', { ...RECHAZADA, dependeDe: 'crear' });
    await guardar('borrar', { dependeDe: 'editar' });

    expect([...(await descartarCambio('editar'))].sort()).toEqual(['borrar', 'editar']);
    expect(await ids()).toEqual(['crear']);
  });

  it.each(['pendiente', 'enviando', 'hecha'] as const)(
    'no tira lo que esta %s: no es de la persona',
    async (valor) => {
      await guardar('a', { estado: valor });

      expect(await descartarCambio('a')).toEqual([]);
      expect(await ids()).toEqual(['a']);
    },
  );

  it('algo que ya no esta, nada', async () => {
    expect(await descartarCambio('no-existe')).toEqual([]);
  });

  it('sin almacen abierto, nada', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await descartarCambio('a')).toEqual([]);
  });

  it('avisa una sola vez, aunque sean varias', async () => {
    const oyente = vi.fn();

    await guardar('crear', RECHAZADA);
    await guardar('editar', { dependeDe: 'crear' });
    suscribirALaCola(oyente);
    await descartarCambio('crear');

    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('no avisa si no hizo nada', async () => {
    const oyente = vi.fn();

    await guardar('a');
    suscribirALaCola(oyente);
    await descartarCambio('a');

    expect(oyente).not.toHaveBeenCalled();
  });
});

describe('cuantosDependenDe (SCRUM-137)', () => {
  it('cuenta lo que se tiraria junto con el cambio, para decirselo antes', async () => {
    await guardar('crear', RECHAZADA);
    await guardar('editar', { dependeDe: 'crear' });
    await guardar('borrar', { dependeDe: 'editar' });
    await guardar('otra');

    expect(await cuantosDependenDe('crear')).toBe(2);
    expect(await cuantosDependenDe('editar')).toBe(1);
    expect(await cuantosDependenDe('otra')).toBe(0);
  });

  it('sin almacen abierto, cero', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await cuantosDependenDe('a')).toBe(0);
  });
});
