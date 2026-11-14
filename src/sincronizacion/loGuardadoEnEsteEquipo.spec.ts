import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../pruebas/almacenDePrueba.ts';
import { cicloActual, encolar, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import type { EstadoDeOperacion, TipoDeOperacion } from './cola.ts';
import {
  cuantosCambiosSinEnviar,
  exportarLoQueNoSeHaEnviado,
  leerLoEscritoDe,
  leerLoQueNoSeHaEnviado,
} from './loGuardadoEnEsteEquipo.ts';

let contador = 0;

/** Una operacion en la cola, en el estado que se diga. */
async function guardar(
  estado: EstadoDeOperacion,
  extra: { tipo?: TipoDeOperacion; ilegible?: boolean; payload?: unknown } = {},
) {
  contador += 1;

  const guardada = await encolar({
    operationId: `op-${String(contador)}`,
    tipo: extra.tipo ?? 'pendiente.crear',
    entidad: `pendiente:${String(contador)}`,
    payload: extra.payload ?? { texto: `Algo ${String(contador)}` },
  });

  await cicloActual()?.almacen.guardarOperacion({
    ...guardada,
    estado,
    ...(extra.ilegible === true ? { ilegible: true } : {}),
  });

  return guardada;
}

beforeEach(async () => {
  contador = 0;
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  vi.restoreAllMocks();
});

describe('leerLoQueNoSeHaEnviado (SCRUM-142)', () => {
  it('sin nada guardado, no hay nada', async () => {
    expect(await leerLoQueNoSeHaEnviado()).toEqual([]);
    expect(await cuantosCambiosSinEnviar()).toBe(0);
  });

  it.each(['pendiente', 'enviando', 'requiere_atencion', 'conflicto'] as const)(
    'lo que esta %s todavia no esta en el servidor: cuenta',
    async (estado) => {
      await guardar(estado);

      expect(await cuantosCambiosSinEnviar()).toBe(1);
    },
  );

  it('lo ya enviado no cuenta: el servidor lo tiene', async () => {
    await guardar('hecha');

    expect(await cuantosCambiosSinEnviar()).toBe(0);
  });

  it('lo ilegible no cuenta: no hay nada que enviar ni que perder', async () => {
    await guardar('requiere_atencion', { ilegible: true });

    expect(await cuantosCambiosSinEnviar()).toBe(0);
  });

  it('cuenta cada cosa una vez y en el orden en que se hizo', async () => {
    const a = await guardar('pendiente');

    await guardar('hecha');

    const c = await guardar('conflicto');
    const d = await guardar('requiere_atencion', { ilegible: true });
    const e = await guardar('enviando');

    const lista = await leerLoQueNoSeHaEnviado();

    expect(lista.map((operacion) => operacion.operationId)).toEqual([
      a.operationId,
      c.operationId,
      e.operationId,
    ]);
    expect(lista.map((operacion) => operacion.operationId)).not.toContain(d.operationId);
    expect(await cuantosCambiosSinEnviar()).toBe(3);
  });

  it('sin almacen abierto no hay nada, y no falla', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLoQueNoSeHaEnviado()).toEqual([]);
    expect(await cuantosCambiosSinEnviar()).toBe(0);
  });

  it('si el almacen no se puede leer, no falla: no hay nada que decir', async () => {
    vi.spyOn(cicloActual()!.almacen, 'operaciones').mockRejectedValue(new Error('se cerro'));

    expect(await leerLoQueNoSeHaEnviado()).toEqual([]);
    expect(await cuantosCambiosSinEnviar()).toBe(0);
  });
});

describe('exportarLoQueNoSeHaEnviado', () => {
  it('lleva de cada cambio lo que hace falta y lo que se escribio, tal cual', async () => {
    const guardada = await guardar('pendiente', {
      tipo: 'diario.escribir',
      payload: { dia: '2026-10-08', titulo: 'Hoy', contenido: { type: 'doc' } },
    });

    expect(await exportarLoQueNoSeHaEnviado()).toEqual([
      {
        operationId: guardada.operationId,
        tipo: 'diario.escribir',
        estado: 'pendiente',
        creadaEn: guardada.creadaEn,
        contenido: { dia: '2026-10-08', titulo: 'Hoy', contenido: { type: 'doc' } },
      },
    ]);
  });

  it.each(['pendiente', 'enviando', 'requiere_atencion', 'conflicto'] as const)(
    'dice en que punto esta cada cambio: %s',
    async (estado) => {
      await guardar(estado);

      expect(await exportarLoQueNoSeHaEnviado()).toMatchObject([{ estado }]);
    },
  );

  it('solo lo que el servidor no tiene', async () => {
    await guardar('hecha');
    await guardar('pendiente');
    await guardar('requiere_atencion', { ilegible: true });

    expect(await exportarLoQueNoSeHaEnviado()).toHaveLength(1);
  });

  it('sin nada, una lista vacia', async () => {
    expect(await exportarLoQueNoSeHaEnviado()).toEqual([]);
  });
});

describe('leerLoEscritoDe', () => {
  const documento = (texto: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }],
  });

  it('el texto de lo que se escribio en esa anotacion', async () => {
    const guardada = await guardar('requiere_atencion', {
      tipo: 'diario.escribir',
      payload: { titulo: 'Hoy', contenido: documento('No pude dormir.') },
    });

    expect(await leerLoEscritoDe(guardada.operationId)).toEqual({
      texto: ['Hoy', '', 'No pude dormir.'].join('\n'),
      conDiagramas: false,
    });
  });

  it('el de la que se pide y no el de otra', async () => {
    await guardar('requiere_atencion', {
      tipo: 'diario.escribir',
      payload: { contenido: documento('Una') },
    });

    const otra = await guardar('requiere_atencion', {
      tipo: 'diario.escribir',
      payload: { contenido: documento('Otra') },
    });

    expect(await leerLoEscritoDe(otra.operationId)).toMatchObject({ texto: 'Otra' });
  });

  it('lo que no es del diario no tiene texto que copiar', async () => {
    const guardada = await guardar('requiere_atencion', {
      tipo: 'pendiente.crear',
      payload: { texto: 'Llamar', contenido: documento('No es del diario') },
    });

    expect(await leerLoEscritoDe(guardada.operationId)).toBeNull();
  });

  it('lo que ya no esta, tampoco', async () => {
    expect(await leerLoEscritoDe('no-existe')).toBeNull();
  });

  it('sin almacen abierto no hay nada, y no falla', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerLoEscritoDe('op-1')).toBeNull();
  });

  it('si el almacen no se puede leer, no falla', async () => {
    vi.spyOn(cicloActual()!.almacen, 'operaciones').mockRejectedValue(new Error('se cerro'));

    expect(await leerLoEscritoDe('op-1')).toBeNull();
  });
});
