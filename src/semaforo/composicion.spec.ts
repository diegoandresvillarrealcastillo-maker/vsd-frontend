import { describe, expect, it } from 'vitest';

import type { Pendiente } from '../infraestructura/api/pendientes.ts';
import { nuevaOperacion, type Operacion, type TipoDeOperacion } from '../sincronizacion/cola.ts';
import { idLocalDe } from '../sincronizacion/ejecutores.ts';
import {
  cambiosEnConflicto,
  componerElSemaforo,
  type PendienteEnPantalla,
  type SemaforoPorComponer,
} from './composicion.ts';

const AHORA = new Date('2026-10-07T12:00:00.000Z');

function pendiente(extra: Partial<Pendiente> = {}): Pendiente {
  return {
    id: 'p-1',
    texto: 'Llamar a la EPS',
    nivel: 'urgente',
    hecho: false,
    posponerHasta: null,
    fechaLimite: null,
    version: 2,
    creadoEn: '2026-10-05T10:00:00.000Z',
    editadoEn: '2026-10-05T10:00:00.000Z',
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
      { operationId: `op-${String(orden)}`, tipo, entidad: 'pendiente:x', payload },
      new Date('2026-10-07T11:30:00.000Z'),
    ),
    orden,
    ...cambios,
  };
}

const crear = (payload: Record<string, unknown> = {}, cambios: Partial<Operacion> = {}) =>
  operacion(
    'pendiente.crear',
    { clientOperationId: 'x', texto: 'Algo nuevo', nivel: 'prioridad', ...payload },
    cambios,
  );

const editar = (
  id: string,
  cambiosDelPendiente: Record<string, unknown>,
  cambios: Partial<Operacion> = {},
) => operacion('pendiente.editar', { id, cambios: cambiosDelPendiente }, cambios);

const borrar = (id: string, cambios: Partial<Operacion> = {}) =>
  operacion('pendiente.borrar', { id }, cambios);

function componer(parte: Partial<SemaforoPorComponer> = {}): readonly PendienteEnPantalla[] {
  return componerElSemaforo({
    pendientes: [],
    operaciones: [],
    sincronizando: false,
    ahora: AHORA,
    ...parte,
  });
}

describe('componerElSemaforo: lo del servidor', () => {
  it('sin nada, no hay nada', () => {
    expect(componer()).toEqual([]);
  });

  it('lo del servidor esta guardado, en el orden que dijo', () => {
    const entradas = componer({
      pendientes: [pendiente({ id: 'b' }), pendiente({ id: 'a' })],
    });

    expect(entradas.map((e) => [e.id, e.estado])).toEqual([
      ['b', 'guardado'],
      ['a', 'guardado'],
    ]);
  });
});

describe('componerElSemaforo: lo que se anota sin enviar', () => {
  it('aparece al instante, con un id local, sin hacer, y con la hora de cuando se anoto', () => {
    const [entrada] = componer({
      operaciones: [crear({ fechaLimite: '2026-10-20' }, { operationId: 'op-77' })],
    });

    expect(entrada).toEqual({
      id: idLocalDe('op-77'),
      texto: 'Algo nuevo',
      nivel: 'prioridad',
      hecho: false,
      posponerHasta: null,
      fechaLimite: '2026-10-20',
      creadoEn: '2026-10-07T11:30:00.000Z',
      editadoEn: '2026-10-07T11:30:00.000Z',
      estado: 'en_este_equipo',
    });
  });

  it('sin fecha limite, no tiene', () => {
    expect(componer({ operaciones: [crear()] })[0]?.fechaLimite).toBeNull();
  });

  it('va despues de lo del servidor', () => {
    const entradas = componer({ pendientes: [pendiente()], operaciones: [crear()] });

    expect(entradas.map((e) => e.estado)).toEqual(['guardado', 'en_este_equipo']);
  });

  it.each([
    ['sin texto', { texto: undefined }],
    ['con el texto vacio', { texto: '' }],
    ['con el texto como numero', { texto: 5 }],
    ['sin nivel', { nivel: undefined }],
    ['con un nivel que no existe', { nivel: 'otro' }],
  ])('un payload %s no se muestra', (_nombre, extra) => {
    expect(componer({ operaciones: [crear(extra)] })).toEqual([]);
  });

  it('un payload que no es un objeto no rompe nada', () => {
    expect(
      componer({
        operaciones: [operacion('pendiente.crear', null), operacion('pendiente.crear', 'texto')],
      }),
    ).toEqual([]);
  });

  it('una fecha limite que no es texto se ignora', () => {
    expect(componer({ operaciones: [crear({ fechaLimite: 5 })] })[0]?.fechaLimite).toBeNull();
  });
});

describe('componerElSemaforo: el estado de lo pendiente', () => {
  const estado = (cambios: Partial<Operacion>, sincronizando = false) =>
    componer({ operaciones: [crear({}, cambios)], sincronizando })[0];

  it('una pendiente esta en este equipo', () => {
    expect(estado({})?.estado).toBe('en_este_equipo');
  });

  it('una que se esta enviando, o espera su turno mientras el motor envia, esta guardando', () => {
    expect(estado({ estado: 'enviando' })?.estado).toBe('guardando');
    expect(estado({}, true)?.estado).toBe('guardando');
  });

  it('una que la API rechazo es un error, y dice cual operacion', () => {
    expect(estado({ estado: 'requiere_atencion', operationId: 'op-mala' })).toMatchObject({
      estado: 'error',
      operacionConProblema: 'op-mala',
    });
  });

  it('una que choco con otro dispositivo es un choque, y dice cual operacion', () => {
    expect(estado({ estado: 'conflicto', operationId: 'op-choco' })).toMatchObject({
      estado: 'choco',
      operacionConProblema: 'op-choco',
    });
  });

  it('lo que va bien no dice ninguna operacion con problema', () => {
    expect(estado({})).not.toHaveProperty('operacionConProblema');
  });
});

describe('componerElSemaforo: los cambios pendientes', () => {
  it('se ven puestos encima del pendiente que cambian, con la hora de cuando se hicieron', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [
        editar('p-1', {
          texto: 'Otro texto',
          nivel: 'aplazable',
          hecho: true,
          posponerHasta: '2026-10-14',
          fechaLimite: '2026-10-30',
        }),
      ],
    });

    expect(entrada).toMatchObject({
      id: 'p-1',
      texto: 'Otro texto',
      nivel: 'aplazable',
      hecho: true,
      posponerHasta: '2026-10-14',
      fechaLimite: '2026-10-30',
      editadoEn: '2026-10-07T11:30:00.000Z',
      estado: 'en_este_equipo',
      // Lo que no cambia, se queda.
      version: 2,
      creadoEn: '2026-10-05T10:00:00.000Z',
    });
  });

  it('lo que el cambio no dice se queda como estaba', () => {
    const [entrada] = componer({
      pendientes: [pendiente({ fechaLimite: '2026-10-20', posponerHasta: '2026-10-12' })],
      operaciones: [editar('p-1', { hecho: true })],
    });

    expect(entrada).toMatchObject({
      texto: 'Llamar a la EPS',
      nivel: 'urgente',
      fechaLimite: '2026-10-20',
      posponerHasta: '2026-10-12',
      hecho: true,
    });
  });

  it('null quita la fecha limite y deja de posponer', () => {
    const [entrada] = componer({
      pendientes: [pendiente({ fechaLimite: '2026-10-20', posponerHasta: '2026-10-12' })],
      operaciones: [editar('p-1', { fechaLimite: null, posponerHasta: null })],
    });

    expect(entrada).toMatchObject({ fechaLimite: null, posponerHasta: null });
  });

  it('lo que tiene otra forma se deja fuera', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [editar('p-1', { texto: 5, nivel: 'otro', hecho: 'si', fechaLimite: 9 })],
    });

    expect(entrada).toMatchObject({ texto: 'Llamar a la EPS', nivel: 'urgente', hecho: false });
  });

  it('dos cambios seguidos se suman: gana el ultimo en lo que ambos dicen', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [
        editar('p-1', { texto: 'Primero', nivel: 'prioridad' }),
        editar('p-1', { texto: 'Segundo' }),
      ],
    });

    expect(entrada).toMatchObject({ texto: 'Segundo', nivel: 'prioridad' });
  });

  it('se cambia tambien algo anotado aqui que todavia no se envia', () => {
    const creacion = crear({}, { operationId: 'op-creacion' });
    const entradas = componer({
      operaciones: [creacion, editar(idLocalDe('op-creacion'), { hecho: true })],
    });

    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ id: idLocalDe('op-creacion'), hecho: true });
  });

  it('el estado de la entrada es el peor de sus cambios', () => {
    expect(
      componer({
        pendientes: [pendiente()],
        operaciones: [editar('p-1', {}, { estado: 'requiere_atencion' }), editar('p-1', {})],
      })[0]?.estado,
    ).toBe('error');
    expect(
      componer({
        pendientes: [pendiente()],
        operaciones: [editar('p-1', {}, { estado: 'enviando' }), editar('p-1', {})],
      })[0]?.estado,
    ).toBe('guardando');
  });

  it('un choque pesa mas que un error', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [
        editar('p-1', {}, { estado: 'requiere_atencion', operationId: 'op-error' }),
        editar('p-1', {}, { estado: 'conflicto', operationId: 'op-choco' }),
      ],
    });

    expect(entrada?.estado).toBe('choco');
  });

  it('un error no se tapa con algo que va mejor', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [
        editar('p-1', {}, { estado: 'conflicto' }),
        editar('p-1', {}, { estado: 'enviando' }),
      ],
    });

    expect(entrada?.estado).toBe('choco');
  });

  it('de dos que fallaron, es la primera la que se resuelve: lo demas depende de ella', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [
        editar('p-1', {}, { estado: 'conflicto', operationId: 'op-1a' }),
        editar('p-1', {}, { estado: 'conflicto', operationId: 'op-2a' }),
      ],
    });

    expect(entrada?.operacionConProblema).toBe('op-1a');
  });

  it('un choque trae lo que tiene el servidor, sin los cambios de la persona', () => {
    const delServidor = pendiente({ version: 5, texto: 'Lo que dejo el otro dispositivo' });
    const [entrada] = componer({
      pendientes: [delServidor],
      operaciones: [editar('p-1', { texto: 'Lo mio' }, { estado: 'conflicto' })],
    });

    expect(entrada).toMatchObject({ texto: 'Lo mio', delServidor });
  });

  it('lo que no choco no trae lo del servidor', () => {
    expect(
      componer({ pendientes: [pendiente()], operaciones: [editar('p-1', { hecho: true })] })[0],
    ).not.toHaveProperty('delServidor');
  });

  it('un cambio de algo que no se ve no inventa nada', () => {
    expect(
      componer({ pendientes: [pendiente()], operaciones: [editar('otro', { hecho: true })] }),
    ).toHaveLength(1);
  });

  it.each([
    ['sin id', { cambios: { hecho: true } }],
    ['con el id vacio', { id: '', cambios: { hecho: true } }],
    ['con el id como numero', { id: 5, cambios: { hecho: true } }],
  ])('un cambio %s se deja fuera', (_nombre, payload) => {
    expect(
      componer({
        pendientes: [pendiente()],
        operaciones: [operacion('pendiente.editar', payload)],
      })[0],
    ).toMatchObject({ hecho: false, estado: 'guardado' });
  });

  it('un cambio con un payload que no es un objeto se deja fuera', () => {
    const entradas = componer({
      pendientes: [pendiente()],
      operaciones: [operacion('pendiente.editar', null), operacion('pendiente.editar', 'texto')],
    });

    expect(entradas[0]).toMatchObject({ hecho: false, estado: 'guardado' });
  });

  it('un cambio sin cambios no cambia nada de lo que se ve, solo cuando', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [operacion('pendiente.editar', { id: 'p-1' })],
    });

    expect(entrada).toMatchObject({ texto: 'Llamar a la EPS', estado: 'en_este_equipo' });
  });

  it('una operacion de otra cosa se ignora', () => {
    expect(
      componer({
        pendientes: [pendiente()],
        operaciones: [operacion('diario.escribir', { id: 'p-1', cambios: { hecho: true } })],
      })[0],
    ).toMatchObject({ hecho: false, estado: 'guardado' });
  });
});

describe('componerElSemaforo: lo que se borra', () => {
  it('se va de la lista al instante', () => {
    expect(
      componer({
        pendientes: [pendiente(), pendiente({ id: 'p-2' })],
        operaciones: [borrar('p-1')],
      }).map((e) => e.id),
    ).toEqual(['p-2']);
  });

  it('lo anotado aqui y borrado antes de enviarse tambien', () => {
    const creacion = crear({}, { operationId: 'op-creacion' });

    expect(componer({ operaciones: [creacion, borrar(idLocalDe('op-creacion'))] })).toEqual([]);
  });

  it('una operacion posterior sobre lo borrado no lo revive', () => {
    expect(
      componer({
        pendientes: [pendiente()],
        operaciones: [borrar('p-1'), editar('p-1', { hecho: true })],
      }),
    ).toEqual([]);
  });

  it('si el borrado fallo, se queda y lo dice: la persona tiene que verlo', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [borrar('p-1', { estado: 'requiere_atencion', operationId: 'op-borrado' })],
    });

    expect(entrada).toMatchObject({
      id: 'p-1',
      estado: 'error',
      operacionConProblema: 'op-borrado',
    });
  });

  it('si algo antes sobre el choco, el borrado queda detras: se queda y se ve el choque', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [
        editar('p-1', { texto: 'Lo mio' }, { estado: 'conflicto', operationId: 'op-choco' }),
        borrar('p-1'),
      ],
    });

    expect(entrada).toMatchObject({
      id: 'p-1',
      estado: 'choco',
      operacionConProblema: 'op-choco',
    });
  });

  it('un borrado que choco tambien se queda y se ve como choque', () => {
    const [entrada] = componer({
      pendientes: [pendiente()],
      operaciones: [borrar('p-1', { estado: 'conflicto', operationId: 'op-borrado' })],
    });

    expect(entrada).toMatchObject({
      id: 'p-1',
      estado: 'choco',
      operacionConProblema: 'op-borrado',
    });
  });

  it('un borrado sin id, o de algo que no se ve, no hace nada', () => {
    expect(
      componer({
        pendientes: [pendiente()],
        operaciones: [operacion('pendiente.borrar', {}), borrar('otro')],
      }),
    ).toHaveLength(1);
  });
});

describe('cambiosEnConflicto', () => {
  it('sin nada en conflicto, nulo', () => {
    expect(cambiosEnConflicto([], 'p-1')).toBeNull();
    expect(cambiosEnConflicto([editar('p-1', { hecho: true })], 'p-1')).toBeNull();
  });

  it('lo que choco, con la operacion y lo que se queria', () => {
    const choco = editar(
      'p-1',
      { texto: 'Lo mio', version: 3 },
      { estado: 'conflicto', operationId: 'op-choco' },
    );

    expect(cambiosEnConflicto([choco], 'p-1')).toEqual({
      id: 'p-1',
      operacionQueChoco: 'op-choco',
      // Sin la version: esa la pone quien lo vuelve a mandar.
      cambios: { texto: 'Lo mio' },
      eliminar: false,
      cuantos: 1,
    });
  });

  it('suma lo que se hizo despues sobre lo mismo, y lo ultimo gana', () => {
    const operaciones = [
      editar(
        'p-1',
        { texto: 'Primero', nivel: 'prioridad' },
        { estado: 'conflicto', operationId: 'op-choco' },
      ),
      editar('p-1', { texto: 'Segundo' }),
      editar('p-1', { hecho: true }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      operacionQueChoco: 'op-choco',
      cambios: { texto: 'Segundo', nivel: 'prioridad', hecho: true },
      cuantos: 3,
    });
  });

  it('lo que se hizo antes de que chocara y ya salio no cuenta', () => {
    const operaciones = [
      editar('p-1', { texto: 'Ya salio' }, { estado: 'hecha' }),
      editar('p-1', { nivel: 'aplazable' }, { estado: 'conflicto', operationId: 'op-choco' }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      cambios: { nivel: 'aplazable' },
      cuantos: 1,
    });
  });

  it('lo que ya salio despues de la que choco tampoco cuenta: ya no esta detenido', () => {
    const operaciones = [
      editar('p-1', { nivel: 'aplazable' }, { estado: 'conflicto', operationId: 'op-choco' }),
      editar('p-1', { texto: 'Ya salio' }, { estado: 'hecha' }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      cambios: { nivel: 'aplazable' },
      cuantos: 1,
    });
  });

  it('no importa en que orden lleguen: se ordenan por cuando se hicieron', () => {
    const operaciones = [
      editar('p-1', { texto: 'Lo mio' }, { estado: 'conflicto', operationId: 'op-choco' }),
      editar('p-1', { texto: 'Lo ultimo' }),
      borrar('p-1'),
    ];

    expect(cambiosEnConflicto([...operaciones].reverse(), 'p-1')).toMatchObject({
      operacionQueChoco: 'op-choco',
      cambios: { texto: 'Lo ultimo' },
      eliminar: true,
      cuantos: 3,
    });
  });

  it('lo que paso antes de la primera que choco, pero sin enviar, no cuenta', () => {
    const operaciones = [
      editar('p-1', { texto: 'Antes' }, { estado: 'enviando' }),
      editar('p-1', { nivel: 'aplazable' }, { estado: 'conflicto', operationId: 'op-choco' }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      cambios: { nivel: 'aplazable' },
      cuantos: 1,
    });
  });

  it('si lo ultimo fue eliminarlo, lo dice', () => {
    const operaciones = [
      editar('p-1', { texto: 'Lo mio' }, { estado: 'conflicto', operationId: 'op-choco' }),
      borrar('p-1'),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      cambios: { texto: 'Lo mio' },
      eliminar: true,
      cuantos: 2,
    });
  });

  it('un borrado que choco no es un choque de version: no hay nada que elegir', () => {
    expect(cambiosEnConflicto([borrar('p-1', { estado: 'conflicto' })], 'p-1')).toBeNull();
  });

  it('lo de otro pendiente no se mezcla', () => {
    const operaciones = [
      editar('p-2', { texto: 'De otro' }, { estado: 'conflicto', operationId: 'op-otro' }),
      editar('p-1', { hecho: true }, { estado: 'conflicto', operationId: 'op-choco' }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      operacionQueChoco: 'op-choco',
      cambios: { hecho: true },
      cuantos: 1,
    });
  });

  it('con dos que chocaron, es la primera la que se resuelve', () => {
    const operaciones = [
      editar('p-1', { texto: 'Uno' }, { estado: 'conflicto', operationId: 'op-1a' }),
      editar('p-1', { texto: 'Dos' }, { estado: 'conflicto', operationId: 'op-2a' }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({
      operacionQueChoco: 'op-1a',
      cambios: { texto: 'Dos' },
      cuantos: 2,
    });
  });

  it('una operacion con un payload que no se entiende no rompe nada', () => {
    const operaciones = [
      operacion('pendiente.editar', null, { estado: 'conflicto' }),
      operacion('pendiente.editar', 'texto', { estado: 'conflicto' }),
      editar('p-1', { hecho: true }, { estado: 'conflicto', operationId: 'op-choco' }),
    ];

    expect(cambiosEnConflicto(operaciones, 'p-1')).toMatchObject({ operacionQueChoco: 'op-choco' });
  });
});
