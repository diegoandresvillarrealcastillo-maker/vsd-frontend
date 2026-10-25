import { describe, expect, it } from 'vitest';

import type { Anotacion } from '../../infraestructura/api/diario.ts';
import { nuevaOperacion, type Operacion, type TipoDeOperacion } from '../../sincronizacion/cola.ts';
import { idLocalDe } from '../../sincronizacion/ejecutores.ts';
import {
  componerElHistorial,
  mezclarAnotaciones,
  minutosQueLeQuedan,
  type EntradaDelHistorial,
} from './historial.ts';

const AHORA = new Date('2026-10-07T12:00:00.000Z');
const DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

function anotacion(extra: Record<string, unknown> = {}): Anotacion {
  return {
    id: 'a-1',
    dia: '2026-10-07',
    titulo: null,
    contenido: DOC,
    adjuntos: [],
    version: 2,
    creadaEn: '2026-10-07T11:00:00.000Z',
    editadaEn: '2026-10-07T11:10:00.000Z',
    editableHasta: '2026-10-07T12:00:00.000Z',
    ...extra,
  };
}

let orden = 0;

function operacion(
  tipo: TipoDeOperacion,
  payload: unknown,
  cambios: Partial<Operacion> = {},
): Operacion {
  orden += 1;

  return {
    ...nuevaOperacion(
      { operationId: `op-${String(orden)}`, tipo, entidad: 'diario:x', payload },
      new Date('2026-10-07T11:30:00.000Z'),
    ),
    orden,
    ...cambios,
  };
}

function escritura(payload: Record<string, unknown> = {}, cambios: Partial<Operacion> = {}) {
  return operacion(
    'diario.escribir',
    { clientOperationId: 'op-x', dia: '2026-10-07', contenido: DOC, ...payload },
    cambios,
  );
}

function correccion(payload: Record<string, unknown>, cambios: Partial<Operacion> = {}) {
  return operacion('diario.editar', payload, cambios);
}

function componer(
  parte: Partial<Parameters<typeof componerElHistorial>[0]> = {},
): readonly EntradaDelHistorial[] {
  return componerElHistorial({
    anotaciones: [],
    pendientes: [],
    marcas: {},
    sincronizando: false,
    ahora: AHORA,
    ...parte,
  });
}

describe('componerElHistorial: lo del servidor', () => {
  it('sin nada, no hay entradas', () => {
    expect(componer()).toEqual([]);
  });

  it('las anotaciones del servidor estan guardadas', () => {
    const [entrada] = componer({ anotaciones: [anotacion()] });

    expect(entrada).toEqual({ ...anotacion(), estado: 'guardada' });
  });

  it('no inventa un origen de copia donde no hay marca', () => {
    expect(componer({ anotaciones: [anotacion()] })[0]).not.toHaveProperty('copia');
  });
});

describe('componerElHistorial: lo escrito que todavia no se envio', () => {
  it('aparece al instante, con un id local, la hora en que se escribio y su hora para editar', () => {
    const pendiente = escritura(
      { titulo: 'Hoy', escritaEn: '2026-10-07T11:45:00.000Z' },
      { operationId: 'op-77' },
    );

    const [entrada] = componer({ pendientes: [pendiente] });

    expect(entrada).toEqual({
      id: idLocalDe('op-77'),
      dia: '2026-10-07',
      titulo: 'Hoy',
      contenido: DOC,
      adjuntos: [],
      version: 0,
      creadaEn: '2026-10-07T11:45:00.000Z',
      editadaEn: '2026-10-07T11:45:00.000Z',
      editableHasta: '2026-10-07T12:45:00.000Z',
      estado: 'en_este_equipo',
    });
  });

  it('sin la hora del dispositivo en el payload, usa la de cuando entro a la cola', () => {
    const [entrada] = componer({ pendientes: [escritura()] });

    expect(entrada?.creadaEn).toBe('2026-10-07T11:30:00.000Z');
    expect(entrada?.editableHasta).toBe('2026-10-07T12:30:00.000Z');
  });

  it('sin titulo es nulo, y sin adjuntos es una lista vacia', () => {
    const [entrada] = componer({ pendientes: [escritura()] });

    expect(entrada).toMatchObject({ titulo: null, adjuntos: [] });
  });

  it('con diagramas los lleva', () => {
    const diagrama = { id: 'd-1', tipo: 'diagrama', datos: {} };
    const [entrada] = componer({ pendientes: [escritura({ adjuntos: [diagrama] })] });

    expect(entrada?.adjuntos).toEqual([diagrama]);
  });

  it('un payload que no se entiende no rompe el historial: se deja fuera', () => {
    const malas = [
      escritura({ dia: undefined }),
      escritura({ dia: '' }),
      escritura({ contenido: 'texto' }),
      escritura({ contenido: undefined }),
      escritura({ contenido: { sinTipo: true } }),
      operacion('diario.escribir', null),
      operacion('diario.escribir', 'texto'),
    ];

    expect(componer({ pendientes: malas })).toEqual([]);
  });

  it('una hora del dispositivo que no es una hora se ignora', () => {
    const [entrada] = componer({ pendientes: [escritura({ escritaEn: 'ayer' })] });

    expect(entrada?.creadaEn).toBe('2026-10-07T11:30:00.000Z');
  });

  it('se mezcla con lo del servidor', () => {
    const entradas = componer({ anotaciones: [anotacion()], pendientes: [escritura()] });

    expect(entradas.map((e) => e.estado).sort()).toEqual(['en_este_equipo', 'guardada']);
  });

  it('dos escrituras son dos entradas', () => {
    const entradas = componer({ pendientes: [escritura(), escritura()] });

    expect(new Set(entradas.map((e) => e.id)).size).toBe(2);
  });
});

describe('componerElHistorial: el estado de lo pendiente', () => {
  const estado = (cambios: Partial<Operacion>, sincronizando = false) =>
    componer({ pendientes: [escritura({}, cambios)], sincronizando })[0]?.estado;

  it('una pendiente esta en este equipo', () => {
    expect(estado({})).toBe('en_este_equipo');
  });

  it('una que se esta enviando esta guardando', () => {
    expect(estado({ estado: 'enviando' })).toBe('guardando');
  });

  it('una pendiente mientras el motor envia esta guardando', () => {
    expect(estado({}, true)).toBe('guardando');
  });

  it('una que espera su proximo reintento no esta guardando aunque el motor este enviando otra cosa', () => {
    expect(estado({ proximoIntento: '2026-10-07T12:05:00.000Z' }, true)).toBe('en_este_equipo');
  });

  it('una cuyo reintento ya toco si esta guardando', () => {
    expect(estado({ proximoIntento: '2026-10-07T11:59:00.000Z' }, true)).toBe('guardando');
    expect(estado({ proximoIntento: '2026-10-07T12:00:00.000Z' }, true)).toBe('guardando');
  });

  it('una que la API rechazo, o que choco, es un error', () => {
    expect(estado({ estado: 'requiere_atencion' })).toBe('error');
    expect(estado({ estado: 'conflicto' })).toBe('error');
  });
});

describe('componerElHistorial: las correcciones pendientes', () => {
  it('se ven puestas encima de la anotacion que corrigen', () => {
    const [entrada] = componer({
      anotaciones: [anotacion({ titulo: 'Antes' })],
      pendientes: [
        correccion({
          id: 'a-1',
          version: 2,
          titulo: 'Despues',
          contenido: { type: 'doc', content: [] },
          adjuntos: [{ id: 'd-1', tipo: 'diagrama', datos: {} }],
          editadaEn: '2026-10-07T11:50:00.000Z',
        }),
      ],
    });

    expect(entrada).toMatchObject({
      id: 'a-1',
      titulo: 'Despues',
      contenido: { type: 'doc', content: [] },
      adjuntos: [{ id: 'd-1', tipo: 'diagrama', datos: {} }],
      editadaEn: '2026-10-07T11:50:00.000Z',
      estado: 'en_este_equipo',
      // Lo que no cambia, se queda.
      version: 2,
      creadaEn: '2026-10-07T11:00:00.000Z',
      editableHasta: '2026-10-07T12:00:00.000Z',
    });
  });

  it('lo que la correccion no dice se queda como estaba', () => {
    const [entrada] = componer({
      anotaciones: [anotacion({ titulo: 'Antes', adjuntos: [{ id: 'd-0' }] })],
      pendientes: [correccion({ id: 'a-1' })],
    });

    expect(entrada).toMatchObject({ titulo: 'Antes', contenido: DOC, adjuntos: [{ id: 'd-0' }] });
  });

  it('quitar el titulo y los diagramas los quita', () => {
    const [entrada] = componer({
      anotaciones: [anotacion({ titulo: 'Antes', adjuntos: [{ id: 'd-0' }] })],
      pendientes: [correccion({ id: 'a-1', titulo: null, adjuntos: null })],
    });

    expect(entrada).toMatchObject({ titulo: null, adjuntos: [] });
  });

  it('sin la hora del dispositivo usa la de cuando entro a la cola', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [correccion({ id: 'a-1' })],
    });

    expect(entrada?.editadaEn).toBe('2026-10-07T11:30:00.000Z');
  });

  it('dos correcciones seguidas se suman: gana la ultima en lo que ambas dicen', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [
        correccion({ id: 'a-1', titulo: 'Primera', adjuntos: [{ id: 'd-1' }] }),
        correccion({ id: 'a-1', titulo: 'Segunda' }),
      ],
    });

    expect(entrada).toMatchObject({ titulo: 'Segunda', adjuntos: [{ id: 'd-1' }] });
  });

  it('corrige tambien una anotacion escrita aqui que todavia no se envia', () => {
    const creacion = escritura({ titulo: 'Escrita' }, { operationId: 'op-creacion' });
    const entradas = componer({
      pendientes: [creacion, correccion({ id: idLocalDe('op-creacion'), titulo: 'Corregida' })],
    });

    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      id: idLocalDe('op-creacion'),
      titulo: 'Corregida',
      version: 0,
    });
  });

  it('el estado de la entrada es el peor de sus operaciones', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [
        correccion({ id: 'a-1', titulo: 'Rechazada' }, { estado: 'requiere_atencion' }),
        correccion({ id: 'a-1', titulo: 'Esperando' }),
      ],
    });

    expect(entrada?.estado).toBe('error');
  });

  it('enviando pesa mas que esperando', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [
        correccion({ id: 'a-1', titulo: 'Una' }, { estado: 'enviando' }),
        correccion({ id: 'a-1', titulo: 'Otra' }),
      ],
    });

    expect(entrada?.estado).toBe('guardando');
  });

  it('un error no se tapa con algo que va mejor', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [
        correccion({ id: 'a-1' }, { estado: 'conflicto' }),
        correccion({ id: 'a-1' }, { estado: 'enviando' }),
      ],
    });

    expect(entrada?.estado).toBe('error');
  });

  it('una correccion de algo que no esta en el historial no inventa nada', () => {
    expect(
      componer({
        anotaciones: [anotacion()],
        pendientes: [correccion({ id: 'otra-que-no-se-ve', titulo: 'x' })],
      }),
    ).toHaveLength(1);
  });

  it('una correccion con un payload que no se entiende se deja fuera', () => {
    const [entrada] = componer({
      anotaciones: [anotacion({ titulo: 'Igual' })],
      pendientes: [
        operacion('diario.editar', null),
        operacion('diario.editar', 'texto'),
        correccion({ id: '' }),
        correccion({ titulo: 'sin id' }),
      ],
    });

    expect(entrada).toMatchObject({ titulo: 'Igual', estado: 'guardada' });
  });

  it('una operacion que no es del diario se ignora', () => {
    const entradas = componer({
      anotaciones: [anotacion()],
      pendientes: [operacion('pendiente.crear', { texto: 'x', nivel: 'urgente' })],
    });

    expect(entradas).toEqual([{ ...anotacion(), estado: 'guardada' }]);
  });
});

describe('componerElHistorial: las copias', () => {
  const MARCA = { copiaDe: 'a-1', motivo: 'VERSION_DESACTUALIZADA' as const };

  it('una anotacion marcada dice de cual es copia, por que, y cuando se escribio la original', () => {
    const entradas = componer({
      anotaciones: [
        anotacion(),
        anotacion({ id: 'copia-1', creadaEn: '2026-10-07T11:40:00.000Z' }),
      ],
      marcas: { 'copia-1': MARCA },
    });

    expect(entradas.find((e) => e.id === 'copia-1')?.copia).toEqual({
      ...MARCA,
      creadaEnLaOriginal: '2026-10-07T11:00:00.000Z',
    });
    expect(entradas.find((e) => e.id === 'a-1')).not.toHaveProperty('copia');
  });

  it('si la original ya no se ve, no se sabe cuando se escribio', () => {
    const [entrada] = componer({
      anotaciones: [anotacion({ id: 'copia-1' })],
      marcas: { 'copia-1': { copiaDe: 'borrada', motivo: 'EDICION_FUERA_DE_PLAZO' } },
    });

    expect(entrada?.copia).toEqual({
      copiaDe: 'borrada',
      motivo: 'EDICION_FUERA_DE_PLAZO',
      creadaEnLaOriginal: null,
    });
  });

  it('una marca de algo que no esta en el historial no inventa una entrada', () => {
    expect(componer({ marcas: { 'copia-1': MARCA } })).toEqual([]);
  });

  describe('una copia que decidio el propio dispositivo (ya paso la hora al guardar)', () => {
    const copia = (payload: Record<string, unknown> = {}) =>
      escritura({ copiaDe: 'a-1', motivo: 'EDICION_FUERA_DE_PLAZO', ...payload });

    it('se sabe de cual es desde que se escribe, sin esperar a la API', () => {
      const entradas = componer({ anotaciones: [anotacion()], pendientes: [copia()] });
      const nueva = entradas.find((e) => e.id !== 'a-1');

      expect(nueva?.copia).toEqual({
        copiaDe: 'a-1',
        motivo: 'EDICION_FUERA_DE_PLAZO',
        creadaEnLaOriginal: '2026-10-07T11:00:00.000Z',
      });
    });

    it('si la original no se ve, no se sabe cuando se escribio', () => {
      const [nueva] = componer({ pendientes: [copia()] });

      expect(nueva?.copia?.creadaEnLaOriginal).toBeNull();
    });

    it('una escritura normal no es copia', () => {
      expect(componer({ pendientes: [escritura()] })[0]).not.toHaveProperty('copia');
    });

    it.each([
      ['sin de cual es copia', { copiaDe: undefined }],
      ['con de cual es copia vacio', { copiaDe: '' }],
      ['sin motivo', { motivo: undefined }],
      ['con un motivo que no se conoce', { motivo: 'OTRO' }],
    ])('%s no es copia', (_nombre, extra) => {
      expect(componer({ pendientes: [copia(extra)] })[0]).not.toHaveProperty('copia');
    });
  });
});

describe('componerElHistorial: la operacion que fallo', () => {
  it('una entrada con error dice cual operacion fallo, para poder reintentarla', () => {
    const [entrada] = componer({
      pendientes: [escritura({}, { estado: 'requiere_atencion', operationId: 'op-mala' })],
    });

    expect(entrada).toMatchObject({ estado: 'error', operacionConError: 'op-mala' });
  });

  it('una correccion que fallo tambien', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [correccion({ id: 'a-1' }, { estado: 'requiere_atencion', operationId: 'op-c' })],
    });

    expect(entrada).toMatchObject({ estado: 'error', operacionConError: 'op-c' });
  });

  it('si fallaron dos, es la primera: reintentarla desbloquea a las que dependen de ella', () => {
    const [entrada] = componer({
      anotaciones: [anotacion()],
      pendientes: [
        correccion({ id: 'a-1' }, { estado: 'requiere_atencion', operationId: 'op-1a' }),
        correccion({ id: 'a-1' }, { estado: 'requiere_atencion', operationId: 'op-2a' }),
      ],
    });

    expect(entrada?.operacionConError).toBe('op-1a');
  });

  it('lo que no fallo no la lleva', () => {
    const entradas = componer({
      anotaciones: [anotacion()],
      pendientes: [escritura(), correccion({ id: 'a-1' }, { estado: 'enviando' })],
    });

    for (const entrada of entradas) {
      expect(entrada).not.toHaveProperty('operacionConError');
    }
  });
});

describe('mezclarAnotaciones', () => {
  it('de dos listas sin nada en comun, las junta', () => {
    const mezcla = mezclarAnotaciones([anotacion({ id: 'a' })], [anotacion({ id: 'b' })]);

    expect(mezcla.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('de la misma anotacion se queda con la version mas nueva, venga de donde venga', () => {
    const vieja = anotacion({ version: 1, titulo: 'Vieja' });
    const nueva = anotacion({ version: 3, titulo: 'Nueva' });

    expect(mezclarAnotaciones([vieja], [nueva])[0]?.titulo).toBe('Nueva');
    expect(mezclarAnotaciones([nueva], [vieja])[0]?.titulo).toBe('Nueva');
  });

  it('con la misma version se queda con la de la segunda lista', () => {
    const una = anotacion({ titulo: 'Una' });
    const otra = anotacion({ titulo: 'Otra' });

    expect(mezclarAnotaciones([una], [otra])[0]?.titulo).toBe('Otra');
  });

  it('sin la segunda lista, es la primera', () => {
    expect(mezclarAnotaciones([anotacion()], [])).toEqual([anotacion()]);
    expect(mezclarAnotaciones([], [])).toEqual([]);
  });
});

describe('minutosQueLeQuedan', () => {
  const entrada = (cambios: Partial<EntradaDelHistorial>): EntradaDelHistorial => ({
    ...anotacion(),
    estado: 'guardada',
    ...cambios,
  });

  it('los minutos hasta que pase su hora, redondeando hacia arriba', () => {
    expect(minutosQueLeQuedan(entrada({}), new Date('2026-10-07T11:30:00.000Z'))).toBe(30);
    expect(minutosQueLeQuedan(entrada({}), new Date('2026-10-07T11:59:30.000Z'))).toBe(1);
  });

  it('pasada su hora, cero', () => {
    expect(minutosQueLeQuedan(entrada({}), AHORA)).toBe(0);
    expect(minutosQueLeQuedan(entrada({}), new Date('2026-10-07T13:00:00.000Z'))).toBe(0);
  });

  it('lo que esta en este equipo o se esta enviando tambien se puede corregir', () => {
    const antes = new Date('2026-10-07T11:30:00.000Z');

    expect(minutosQueLeQuedan(entrada({ estado: 'en_este_equipo' }), antes)).toBe(30);
    expect(minutosQueLeQuedan(entrada({ estado: 'guardando' }), antes)).toBe(30);
  });

  it('lo que fallo no se puede corregir: primero hay que resolver eso', () => {
    expect(
      minutosQueLeQuedan(entrada({ estado: 'error' }), new Date('2026-10-07T11:30:00.000Z')),
    ).toBe(0);
  });
});
