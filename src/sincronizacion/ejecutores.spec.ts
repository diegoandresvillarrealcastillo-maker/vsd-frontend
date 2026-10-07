import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nuevaOperacion, type Operacion, type TipoDeOperacion } from './cola.ts';
import {
  EJECUTORES,
  OperacionInvalida,
  comprobarLaOperacion,
  esIdLocal,
  idLocalDe,
  resolverElId,
  type ContextoDeEjecucion,
} from './ejecutores.ts';

const {
  registrarResultado,
  escribirEnElDiario,
  editarAnotacion,
  crearPendiente,
  editarPendiente,
  borrarPendiente,
} = vi.hoisted(() => ({
  registrarResultado: vi.fn(),
  escribirEnElDiario: vi.fn(),
  editarAnotacion: vi.fn(),
  crearPendiente: vi.fn(),
  editarPendiente: vi.fn(),
  borrarPendiente: vi.fn(),
}));

vi.mock('../infraestructura/api/resultados.ts', () => ({ registrarResultado }));
vi.mock('../infraestructura/api/diario.ts', () => ({ escribirEnElDiario, editarAnotacion }));
vi.mock('../infraestructura/api/pendientes.ts', () => ({
  crearPendiente,
  editarPendiente,
  borrarPendiente,
}));

const AHORA = new Date('2026-10-07T12:00:00.000Z');

beforeEach(() => {
  for (const f of [
    registrarResultado,
    escribirEnElDiario,
    editarAnotacion,
    crearPendiente,
    editarPendiente,
    borrarPendiente,
  ]) {
    f.mockResolvedValue({ respuesta: 'de la api' });
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

function operacion(
  tipo: TipoDeOperacion,
  payload: unknown,
  cambios: Partial<Operacion> = {},
): Operacion {
  return {
    ...nuevaOperacion({ operationId: 'op-1', tipo, entidad: 'e:1', payload }, AHORA),
    ...cambios,
  };
}

function contextoCon(recibos: Record<string, unknown> = {}): ContextoDeEjecucion {
  return { reciboDe: (id) => recibos[id] ?? null };
}

// Un payload valido de cada tipo.
const VALIDOS: Record<TipoDeOperacion, unknown> = {
  'resultado.registrar': {
    activityId: 'actividad-1',
    clientOperationId: 'op-1',
    score: 7,
    completedAt: '2026-10-07T11:00:00.000Z',
    metadata: { horas: 7 },
  },
  'diario.escribir': {
    clientOperationId: 'op-1',
    dia: '2026-10-07',
    titulo: 'Hoy',
    contenido: { type: 'doc', content: [] },
  },
  'diario.editar': { id: 'anotacion-1', version: 2, contenido: { type: 'doc', content: [] } },
  'pendiente.crear': { clientOperationId: 'op-1', texto: 'Llamar', nivel: 'urgente' },
  'pendiente.editar': { id: 'pendiente-1', cambios: { hecho: true } },
  'pendiente.borrar': { id: 'pendiente-1' },
};

describe('comprobarLaOperacion', () => {
  it.each(Object.keys(VALIDOS) as TipoDeOperacion[])(
    'un payload valido de %s se puede enviar',
    (tipo) => {
      expect(comprobarLaOperacion(operacion(tipo, VALIDOS[tipo]))).toBeNull();
    },
  );

  describe('antes que nada', () => {
    it('una operacion ilegible no se envia', () => {
      expect(comprobarLaOperacion(operacion('pendiente.crear', null, { ilegible: true }))).toBe(
        'ALMACEN_ILEGIBLE',
      );
    });

    it('una forma de payload mas nueva que la que se entiende no se adivina ni se descarta', () => {
      expect(
        comprobarLaOperacion(
          operacion('pendiente.crear', VALIDOS['pendiente.crear'], { payloadVersion: 2 }),
        ),
      ).toBe('PAYLOAD_VERSION_NO_SOPORTADA');
    });

    it('lo ilegible manda sobre todo lo demas', () => {
      expect(
        comprobarLaOperacion(
          operacion('pendiente.crear', 'basura', { ilegible: true, payloadVersion: 9 }),
        ),
      ).toBe('ALMACEN_ILEGIBLE');
    });

    it.each([
      ['nulo', null],
      ['un texto', 'hola'],
      ['un numero', 3],
      ['una lista', [1, 2]],
      ['indefinido', undefined],
    ])('un payload que es %s es invalido', (_nombre, payload) => {
      expect(comprobarLaOperacion(operacion('pendiente.borrar', payload))).toBe('PAYLOAD_INVALIDO');
    });
  });

  describe('el identificador de la operacion', () => {
    it.each(['resultado.registrar', 'diario.escribir', 'pendiente.crear'] as const)(
      '%s: el clientOperationId que viaja tiene que ser el de la operacion',
      (tipo) => {
        const distinto = { ...(VALIDOS[tipo] as object), clientOperationId: 'otro-id' };

        // Es lo que hace seguro reintentar: si no coincidieran, una operacion podria
        // duplicarse o confundirse con otra.
        expect(comprobarLaOperacion(operacion(tipo, distinto))).toBe(
          'IDENTIFICADOR_DE_OPERACION_NO_COINCIDE',
        );
      },
    );

    it.each(['resultado.registrar', 'diario.escribir', 'pendiente.crear'] as const)(
      '%s: sin clientOperationId tampoco',
      (tipo) => {
        const { clientOperationId: _quitado, ...sin } = VALIDOS[tipo] as Record<string, unknown>;

        expect(comprobarLaOperacion(operacion(tipo, sin))).toBe(
          'IDENTIFICADOR_DE_OPERACION_NO_COINCIDE',
        );
      },
    );

    it.each(['diario.editar', 'pendiente.editar', 'pendiente.borrar'] as const)(
      '%s: no lleva clientOperationId y no se le exige',
      (tipo) => {
        expect(comprobarLaOperacion(operacion(tipo, VALIDOS[tipo]))).toBeNull();
      },
    );
  });

  describe('resultado.registrar', () => {
    const con = (cambios: Record<string, unknown>) =>
      operacion('resultado.registrar', {
        ...(VALIDOS['resultado.registrar'] as object),
        ...cambios,
      });

    it('el puntaje es opcional', () => {
      const { score: _quitado, ...sin } = VALIDOS['resultado.registrar'] as Record<string, unknown>;

      expect(comprobarLaOperacion(operacion('resultado.registrar', sin))).toBeNull();
    });

    it.each([
      ['sin actividad', { activityId: undefined }],
      ['con la actividad vacia', { activityId: '  ' }],
      ['con la actividad que no es texto', { activityId: 3 }],
      ['sin fecha', { completedAt: undefined }],
      ['con una fecha que no es de ISO', { completedAt: 'ayer' }],
      ['con una fecha imposible', { completedAt: '2026-13-45T99:99:99Z' }],
      ['con un puntaje que es texto', { score: '7' }],
      ['con un puntaje infinito', { score: Number.POSITIVE_INFINITY }],
      ['con un puntaje que no es un numero', { score: Number.NaN }],
      ['con metadata que es una lista', { metadata: [1] }],
      ['con metadata que es un texto', { metadata: 'x' }],
    ])('%s es invalido', (_nombre, cambios) => {
      expect(comprobarLaOperacion(con(cambios))).toBe('PAYLOAD_INVALIDO');
    });
  });

  describe('diario.escribir', () => {
    const con = (cambios: Record<string, unknown>) =>
      operacion('diario.escribir', { ...(VALIDOS['diario.escribir'] as object), ...cambios });

    it.each([
      ['sin dia', { dia: undefined }],
      ['con un dia que no es AAAA-MM-DD', { dia: '07/10/2026' }],
      ['con un dia con hora', { dia: '2026-10-07T00:00:00Z' }],
      ['sin contenido', { contenido: undefined }],
      ['con el contenido como texto', { contenido: 'hola' }],
      ['con el contenido como lista', { contenido: [] }],
      ['con un titulo que no es texto', { titulo: 5 }],
      ['con adjuntos que no son una lista', { adjuntos: {} }],
    ])('%s es invalido', (_nombre, cambios) => {
      expect(comprobarLaOperacion(con(cambios))).toBe('PAYLOAD_INVALIDO');
    });

    it('el titulo y los adjuntos son opcionales', () => {
      const { titulo: _t, ...sin } = VALIDOS['diario.escribir'] as Record<string, unknown>;

      expect(comprobarLaOperacion(operacion('diario.escribir', sin))).toBeNull();
      expect(comprobarLaOperacion(con({ adjuntos: [] }))).toBeNull();
    });
  });

  describe('diario.editar', () => {
    const con = (cambios: Record<string, unknown>) =>
      operacion('diario.editar', { ...(VALIDOS['diario.editar'] as object), ...cambios });

    it('la version es opcional (puede venir de la operacion anterior)', () => {
      const { version: _v, ...sin } = VALIDOS['diario.editar'] as Record<string, unknown>;

      expect(comprobarLaOperacion(operacion('diario.editar', sin))).toBeNull();
    });

    it('el titulo puede ser nulo (quitarlo) y los adjuntos tambien', () => {
      expect(comprobarLaOperacion(con({ titulo: null, adjuntos: null }))).toBeNull();
    });

    it.each([
      ['sin id', { id: undefined }],
      ['con el id vacio', { id: '' }],
      ['con la version en cero', { version: 0 }],
      ['con una version negativa', { version: -1 }],
      ['con una version con decimales', { version: 1.5 }],
      ['con una version que es texto', { version: '2' }],
      ['con el contenido como texto', { contenido: 'x' }],
      ['con el titulo como numero', { titulo: 3 }],
      ['con adjuntos como objeto', { adjuntos: {} }],
    ])('%s es invalido', (_nombre, cambios) => {
      expect(comprobarLaOperacion(con(cambios))).toBe('PAYLOAD_INVALIDO');
    });
  });

  describe('pendiente.crear', () => {
    const con = (cambios: Record<string, unknown>) =>
      operacion('pendiente.crear', { ...(VALIDOS['pendiente.crear'] as object), ...cambios });

    it.each([
      ['sin texto', { texto: undefined }],
      ['con el texto en blanco', { texto: '   ' }],
      ['sin nivel', { nivel: undefined }],
      ['con la fecha limite mal escrita', { fechaLimite: '12-10-2026' }],
    ])('%s es invalido', (_nombre, cambios) => {
      expect(comprobarLaOperacion(con(cambios))).toBe('PAYLOAD_INVALIDO');
    });

    it('la fecha limite es opcional', () => {
      expect(comprobarLaOperacion(con({ fechaLimite: '2026-10-12' }))).toBeNull();
    });
  });

  describe('pendiente.editar y pendiente.borrar', () => {
    it.each([
      ['editar sin id', 'pendiente.editar' as const, { cambios: {} }],
      ['editar sin cambios', 'pendiente.editar' as const, { id: 'x' }],
      [
        'editar con los cambios como texto',
        'pendiente.editar' as const,
        { id: 'x', cambios: 'hecho' },
      ],
      ['editar con los cambios como lista', 'pendiente.editar' as const, { id: 'x', cambios: [] }],
      ['borrar sin id', 'pendiente.borrar' as const, {}],
      ['borrar con el id vacio', 'pendiente.borrar' as const, { id: '' }],
    ])('%s es invalido', (_nombre, tipo, payload) => {
      expect(comprobarLaOperacion(operacion(tipo, payload))).toBe('PAYLOAD_INVALIDO');
    });
  });

  it('el codigo no repite nada de lo que contenia la operacion', () => {
    const codigo = comprobarLaOperacion(
      operacion('pendiente.crear', { texto: 'MUY-SECRETO-123', nivel: 5 }),
    );

    expect(codigo).not.toContain('SECRETO');
  });
});

describe('los identificadores de lo creado sin conexion', () => {
  it('un id local lleva el prefijo y se reconoce', () => {
    expect(idLocalDe('abc')).toBe('local:abc');
    expect(esIdLocal('local:abc')).toBe(true);
    expect(esIdLocal('abc')).toBe(false);
    expect(esIdLocal('')).toBe(false);
    expect(esIdLocal('LOCAL:abc')).toBe(false);
  });

  it('un id de verdad se queda como esta', () => {
    expect(resolverElId('a1b2c3', contextoCon())).toBe('a1b2c3');
  });

  it('un id local se sustituye por el que respondio la operacion que lo creo', () => {
    expect(
      resolverElId('local:op-9', contextoCon({ 'op-9': { id: 'servidor-77', texto: 'x' } })),
    ).toBe('servidor-77');
  });

  it.each([
    ['la operacion todavia no termino', {}],
    ['el recibo no tiene id', { 'op-9': { texto: 'x' } }],
    ['el id del recibo esta vacio', { 'op-9': { id: '' } }],
    ['el id del recibo no es texto', { 'op-9': { id: 5 } }],
    ['el recibo no es un objeto', { 'op-9': 'servidor-77' }],
  ])('si %s, es un error propio y no se adivina', (_nombre, recibos) => {
    expect(() => resolverElId('local:op-9', contextoCon(recibos))).toThrow(OperacionInvalida);
    expect(() => resolverElId('local:op-9', contextoCon(recibos))).toThrow(
      /REFERENCIA_SIN_RESOLVER/,
    );
  });
});

describe('EJECUTORES: que llamada hace cada tipo', () => {
  it('hay uno por cada tipo, y solo esos', () => {
    expect(Object.keys(EJECUTORES).sort()).toEqual(Object.keys(VALIDOS).sort());
  });

  it('resultado.registrar manda el payload tal cual y devuelve lo que responde la API', async () => {
    const o = operacion('resultado.registrar', VALIDOS['resultado.registrar']);

    expect(await EJECUTORES['resultado.registrar'](o, contextoCon())).toEqual({
      respuesta: 'de la api',
    });
    expect(registrarResultado).toHaveBeenCalledWith(VALIDOS['resultado.registrar']);
  });

  it('diario.escribir manda el payload tal cual', async () => {
    await EJECUTORES['diario.escribir'](
      operacion('diario.escribir', VALIDOS['diario.escribir']),
      contextoCon(),
    );

    expect(escribirEnElDiario).toHaveBeenCalledWith(VALIDOS['diario.escribir']);
  });

  it('pendiente.crear manda el payload tal cual', async () => {
    await EJECUTORES['pendiente.crear'](
      operacion('pendiente.crear', VALIDOS['pendiente.crear']),
      contextoCon(),
    );

    expect(crearPendiente).toHaveBeenCalledWith(VALIDOS['pendiente.crear']);
  });

  it('un fallo de la API sale tal cual: el motor es quien lo clasifica', async () => {
    registrarResultado.mockRejectedValue(new Error('la api fallo'));

    await expect(
      EJECUTORES['resultado.registrar'](
        operacion('resultado.registrar', VALIDOS['resultado.registrar']),
        contextoCon(),
      ),
    ).rejects.toThrow('la api fallo');
  });

  describe('pendiente.editar', () => {
    it('edita por el id y con los cambios', async () => {
      await EJECUTORES['pendiente.editar'](
        operacion('pendiente.editar', {
          id: 'pendiente-1',
          cambios: { hecho: true, texto: 'Nuevo' },
        }),
        contextoCon(),
      );

      expect(editarPendiente).toHaveBeenCalledWith('pendiente-1', { hecho: true, texto: 'Nuevo' });
    });

    it('sin version en ningun lado, no inventa una (la API no comprueba nada)', async () => {
      await EJECUTORES['pendiente.editar'](
        operacion('pendiente.editar', VALIDOS['pendiente.editar']),
        contextoCon(),
      );

      expect(editarPendiente.mock.calls[0]?.[1]).not.toHaveProperty('version');
    });

    it('la version de los cambios manda', async () => {
      await EJECUTORES['pendiente.editar'](
        operacion(
          'pendiente.editar',
          { id: 'p', cambios: { texto: 'x', version: 4 } },
          { dependeDe: 'op-0' },
        ),
        contextoCon({ 'op-0': { id: 'p', version: 9 } }),
      );

      expect(editarPendiente).toHaveBeenCalledWith('p', { texto: 'x', version: 4 });
    });

    it('si los cambios no fijan la version, usa la que respondio la operacion de la que depende', async () => {
      await EJECUTORES['pendiente.editar'](
        operacion('pendiente.editar', { id: 'p', cambios: { texto: 'x' } }, { dependeDe: 'op-0' }),
        contextoCon({ 'op-0': { id: 'p', version: 3 } }),
      );

      expect(editarPendiente).toHaveBeenCalledWith('p', { texto: 'x', version: 3 });
    });

    it('un recibo sin version valida no fija ninguna', async () => {
      await EJECUTORES['pendiente.editar'](
        operacion('pendiente.editar', { id: 'p', cambios: { texto: 'x' } }, { dependeDe: 'op-0' }),
        contextoCon({ 'op-0': { id: 'p', version: 'tres' } }),
      );

      expect(editarPendiente.mock.calls[0]?.[1]).not.toHaveProperty('version');
    });

    it('un pendiente creado sin conexion se edita con el id que respondio su creacion', async () => {
      await EJECUTORES['pendiente.editar'](
        operacion(
          'pendiente.editar',
          { id: idLocalDe('op-0'), cambios: { hecho: true } },
          { dependeDe: 'op-0' },
        ),
        contextoCon({ 'op-0': { id: 'servidor-55', version: 1 } }),
      );

      expect(editarPendiente).toHaveBeenCalledWith('servidor-55', { hecho: true, version: 1 });
    });

    it('si la creacion todavia no termino, no llama a la API', async () => {
      await expect(
        EJECUTORES['pendiente.editar'](
          operacion('pendiente.editar', { id: idLocalDe('op-0'), cambios: { hecho: true } }),
          contextoCon(),
        ),
      ).rejects.toBeInstanceOf(OperacionInvalida);
      expect(editarPendiente).not.toHaveBeenCalled();
    });
  });

  describe('pendiente.borrar', () => {
    it('borra por el id', async () => {
      await EJECUTORES['pendiente.borrar'](
        operacion('pendiente.borrar', { id: 'pendiente-1' }),
        contextoCon(),
      );

      expect(borrarPendiente).toHaveBeenCalledWith('pendiente-1');
    });

    it('uno creado sin conexion se borra con el id de verdad', async () => {
      await EJECUTORES['pendiente.borrar'](
        operacion('pendiente.borrar', { id: idLocalDe('op-0') }),
        contextoCon({ 'op-0': { id: 'servidor-55' } }),
      );

      expect(borrarPendiente).toHaveBeenCalledWith('servidor-55');
    });

    it('si la creacion todavia no termino, no llama a la API', async () => {
      await expect(
        EJECUTORES['pendiente.borrar'](
          operacion('pendiente.borrar', { id: idLocalDe('op-0') }),
          contextoCon(),
        ),
      ).rejects.toBeInstanceOf(OperacionInvalida);
      expect(borrarPendiente).not.toHaveBeenCalled();
    });
  });

  describe('diario.editar', () => {
    it('edita con la version del payload', async () => {
      await EJECUTORES['diario.editar'](
        operacion('diario.editar', { id: 'a-1', version: 2, titulo: 'Nuevo' }),
        contextoCon(),
      );

      expect(editarAnotacion).toHaveBeenCalledWith('a-1', { titulo: 'Nuevo', version: 2 });
    });

    it('sin version en el payload, usa la que respondio la operacion de la que depende', async () => {
      await EJECUTORES['diario.editar'](
        operacion(
          'diario.editar',
          { id: 'a-1', contenido: { type: 'doc' } },
          { dependeDe: 'op-0' },
        ),
        contextoCon({ 'op-0': { id: 'a-1', version: 5 } }),
      );

      expect(editarAnotacion).toHaveBeenCalledWith('a-1', {
        contenido: { type: 'doc' },
        version: 5,
      });
    });

    it('la version del payload manda sobre la del recibo', async () => {
      await EJECUTORES['diario.editar'](
        operacion('diario.editar', { id: 'a-1', version: 2 }, { dependeDe: 'op-0' }),
        contextoCon({ 'op-0': { id: 'a-1', version: 5 } }),
      );

      expect(editarAnotacion.mock.calls[0]?.[1]).toMatchObject({ version: 2 });
    });

    it('SIN version de ningun lado no se envia: pisar lo de otro dispositivo seria perder lo que escribio', async () => {
      await expect(
        EJECUTORES['diario.editar'](
          operacion('diario.editar', { id: 'a-1', titulo: 'x' }),
          contextoCon(),
        ),
      ).rejects.toThrow(/VERSION_SIN_CONOCER/);
      expect(editarAnotacion).not.toHaveBeenCalled();
    });

    it('una anotacion escrita sin conexion se edita con el id de verdad y la version de su creacion', async () => {
      await EJECUTORES['diario.editar'](
        operacion(
          'diario.editar',
          { id: idLocalDe('op-0'), titulo: 'Corregido' },
          { dependeDe: 'op-0' },
        ),
        contextoCon({ 'op-0': { id: 'servidor-a', version: 1 } }),
      );

      expect(editarAnotacion).toHaveBeenCalledWith('servidor-a', {
        titulo: 'Corregido',
        version: 1,
      });
    });

    it('no manda el id dentro de los cambios', async () => {
      await EJECUTORES['diario.editar'](
        operacion('diario.editar', { id: 'a-1', version: 2, titulo: 'x' }),
        contextoCon(),
      );

      expect(editarAnotacion.mock.calls[0]?.[1]).not.toHaveProperty('id');
    });
  });
});

describe('OperacionInvalida', () => {
  it('lleva su codigo y un mensaje que no cuenta nada de la persona', () => {
    const error = new OperacionInvalida('PAYLOAD_INVALIDO');

    expect(error.codigo).toBe('PAYLOAD_INVALIDO');
    expect(error.name).toBe('OperacionInvalida');
    expect(error.message).toContain('PAYLOAD_INVALIDO');
  });
});
