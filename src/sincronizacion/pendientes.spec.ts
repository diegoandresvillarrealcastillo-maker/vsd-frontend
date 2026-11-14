import { describe, expect, it } from 'vitest';

import {
  cambiosValidos,
  esNivelDePendiente,
  esPendiente,
  NIVELES_DE_PENDIENTE,
} from './pendientes.ts';

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

describe('esNivelDePendiente', () => {
  it.each(NIVELES_DE_PENDIENTE)('%s es un nivel', (nivel) => {
    expect(esNivelDePendiente(nivel)).toBe(true);
  });

  it.each([['otro'], [''], [null], [undefined], [1], [['urgente']]])('%s no lo es', (valor) => {
    expect(esNivelDePendiente(valor)).toBe(false);
  });

  it('son los tres, del mas urgente al mas aplazable', () => {
    expect(NIVELES_DE_PENDIENTE).toEqual(['urgente', 'prioridad', 'aplazable']);
  });
});

describe('esPendiente', () => {
  it('reconoce un pendiente completo', () => {
    expect(esPendiente(pendiente())).toBe(true);
    expect(
      esPendiente(
        pendiente({ hecho: true, posponerHasta: '2026-10-14', fechaLimite: '2026-10-20' }),
      ),
    ).toBe(true);
  });

  it('la version es opcional: un servidor anterior no la manda', () => {
    const { version: _version, ...sinVersion } = pendiente();

    expect(esPendiente(sinVersion)).toBe(true);
  });

  it.each([
    ['nada', null],
    ['un texto', 'pendiente'],
    ['una lista', []],
    ['sin id', { id: undefined }],
    ['con el id vacio', { id: '' }],
    ['con el texto como numero', { texto: 5 }],
    ['sin texto', { texto: undefined }],
    ['con un nivel que no existe', { nivel: 'otro' }],
    ['sin nivel', { nivel: undefined }],
    ['con hecho como texto', { hecho: 'si' }],
    ['sin hecho', { hecho: undefined }],
    ['con posponerHasta como numero', { posponerHasta: 5 }],
    ['sin posponerHasta (ni siquiera nulo)', { posponerHasta: undefined }],
    ['con fechaLimite como numero', { fechaLimite: 5 }],
    ['sin fechaLimite (ni siquiera nulo)', { fechaLimite: undefined }],
    ['sin la hora de creacion', { creadoEn: undefined }],
    ['con la hora de edicion vacia', { editadoEn: '' }],
    ['con la version como texto', { version: '1' }],
    ['con la version con decimales', { version: 1.5 }],
  ])('no reconoce %s', (_nombre, extra) => {
    const valor =
      extra !== null && !Array.isArray(extra) && typeof extra === 'object'
        ? pendiente(extra)
        : extra;

    expect(esPendiente(valor)).toBe(false);
  });
});

describe('cambiosValidos', () => {
  it('deja pasar lo que tiene la forma esperada', () => {
    const cambios = {
      texto: 'Nuevo',
      nivel: 'prioridad',
      hecho: true,
      posponerHasta: '2026-10-14',
      fechaLimite: '2026-10-20',
    };

    expect(cambiosValidos(cambios)).toEqual(cambios);
  });

  it('null quita la fecha limite y deja de posponer', () => {
    expect(cambiosValidos({ posponerHasta: null, fechaLimite: null })).toEqual({
      posponerHasta: null,
      fechaLimite: null,
    });
  });

  it('lo que falta no es un cambio', () => {
    expect(cambiosValidos({})).toEqual({});
    expect(cambiosValidos({ texto: undefined, hecho: undefined })).toEqual({});
  });

  it('deja fuera lo que no tiene la forma esperada, sin romper lo demas', () => {
    expect(
      cambiosValidos({
        texto: 5,
        nivel: 'otro',
        hecho: 'si',
        posponerHasta: 7,
        fechaLimite: 9,
        version: 3,
        extra: true,
      }),
    ).toEqual({});
    expect(cambiosValidos({ texto: 'Si', nivel: 'otro' })).toEqual({ texto: 'Si' });
  });

  it('la version no es un cambio: es de otra cosa', () => {
    expect(cambiosValidos({ version: 2, hecho: true })).toEqual({ hecho: true });
  });

  it('algo que no es un objeto no cambia nada', () => {
    expect(cambiosValidos(null)).toEqual({});
    expect(cambiosValidos('texto')).toEqual({});
    expect(cambiosValidos([1])).toEqual({});
  });
});
