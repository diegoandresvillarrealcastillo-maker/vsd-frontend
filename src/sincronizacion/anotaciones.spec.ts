import { describe, expect, it } from 'vitest';

import {
  esAnotacion,
  esAnotacionCopiada,
  soloLaAnotacion,
  sonIguales,
  yaEstaAplicada,
} from './anotaciones.ts';

const DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

function anotacion(extra: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    dia: '2026-10-07',
    titulo: null,
    contenido: DOC,
    adjuntos: [],
    version: 1,
    creadaEn: '2026-10-07T11:00:00.000Z',
    editadaEn: '2026-10-07T11:00:00.000Z',
    editableHasta: '2026-10-07T12:00:00.000Z',
    ...extra,
  };
}

describe('esAnotacion', () => {
  it('reconoce una anotacion completa', () => {
    expect(esAnotacion(anotacion())).toBe(true);
    expect(esAnotacion(anotacion({ titulo: 'Hoy' }))).toBe(true);
  });

  it('lo que acompana a la respuesta no le quita lo que es', () => {
    expect(esAnotacion(anotacion({ sugiereAcompanamiento: true, lineasDeAtencion: [] }))).toBe(
      true,
    );
  });

  it.each([
    ['nada', null],
    ['un texto', 'anotacion'],
    ['una lista', []],
    ['sin id', { id: undefined }],
    ['con el id vacio', { id: '' }],
    ['con el dia como fecha y hora', { dia: '2026-10-07T00:00:00Z' }],
    ['con el dia al reves', { dia: '07-10-2026' }],
    ['con el dia como numero', { dia: 20261007 }],
    ['con el dia dentro de una lista', { dia: ['2026-10-07'] }],
    ['con el titulo como numero', { titulo: 5 }],
    ['sin titulo (ni siquiera nulo)', { titulo: undefined }],
    ['con el contenido como texto', { contenido: 'hola' }],
    ['con el contenido como lista', { contenido: [] }],
    ['con los adjuntos como objeto', { adjuntos: {} }],
    ['con la version como texto', { version: '1' }],
    ['con la version con decimales', { version: 1.5 }],
    ['sin la hora de creacion', { creadaEn: undefined }],
    ['con la hora de edicion vacia', { editadaEn: '' }],
    ['sin el limite para editar', { editableHasta: undefined }],
  ])('no reconoce %s', (_nombre, extra) => {
    const valor =
      extra !== null && !Array.isArray(extra) && typeof extra === 'object'
        ? anotacion(extra)
        : extra;

    expect(esAnotacion(valor)).toBe(false);
  });
});

describe('esAnotacionCopiada', () => {
  it('es una anotacion que dice de cual es copia y por que', () => {
    expect(
      esAnotacionCopiada(anotacion({ copiaDe: 'a-0', motivo: 'VERSION_DESACTUALIZADA' })),
    ).toBe(true);
    expect(
      esAnotacionCopiada(anotacion({ copiaDe: 'a-0', motivo: 'EDICION_FUERA_DE_PLAZO' })),
    ).toBe(true);
  });

  it.each([
    ['una anotacion normal', {}],
    ['sin de cual es copia', { motivo: 'VERSION_DESACTUALIZADA' }],
    ['con de cual es copia vacio', { copiaDe: '', motivo: 'VERSION_DESACTUALIZADA' }],
    ['sin motivo', { copiaDe: 'a-0' }],
    ['con un motivo que no se conoce', { copiaDe: 'a-0', motivo: 'OTRO' }],
  ])('no lo es: %s', (_nombre, extra) => {
    expect(esAnotacionCopiada(anotacion(extra))).toBe(false);
  });

  it('algo que no es una anotacion no lo es aunque diga que es copia', () => {
    expect(esAnotacionCopiada({ copiaDe: 'a-0', motivo: 'VERSION_DESACTUALIZADA' })).toBe(false);
  });
});

describe('soloLaAnotacion', () => {
  it('deja lo de la anotacion y quita lo que acompana a la respuesta', () => {
    const respuesta = anotacion({
      titulo: 'Hoy',
      version: 3,
      sugiereAcompanamiento: true,
      lineasDeAtencion: [{ id: 'l-1' }],
      copiaDe: 'a-0',
      motivo: 'VERSION_DESACTUALIZADA',
    });

    expect(soloLaAnotacion(respuesta as never)).toEqual({
      id: 'a-1',
      dia: '2026-10-07',
      titulo: 'Hoy',
      contenido: DOC,
      adjuntos: [],
      version: 3,
      creadaEn: '2026-10-07T11:00:00.000Z',
      editadaEn: '2026-10-07T11:00:00.000Z',
      editableHasta: '2026-10-07T12:00:00.000Z',
    });
  });
});

describe('sonIguales', () => {
  it('lo identico es igual', () => {
    expect(sonIguales(1, 1)).toBe(true);
    expect(sonIguales('a', 'a')).toBe(true);
    expect(sonIguales(null, null)).toBe(true);
    expect(sonIguales({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
  });

  it('lo distinto no lo es', () => {
    expect(sonIguales(1, 2)).toBe(false);
    expect(sonIguales('1', 1)).toBe(false);
    expect(sonIguales(null, undefined)).toBe(false);
    expect(sonIguales(null, {})).toBe(false);
    expect(sonIguales({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('el orden de las claves no importa', () => {
    expect(sonIguales({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
  });

  it('el orden de una lista si importa, y su largo', () => {
    expect(sonIguales([1, 2], [2, 1])).toBe(false);
    expect(sonIguales([1], [1, 2])).toBe(false);
    expect(sonIguales([1, 2], [1])).toBe(false);
  });

  it('una lista no es un objeto', () => {
    expect(sonIguales([], {})).toBe(false);
    expect(sonIguales({}, [])).toBe(false);
    expect(sonIguales([0], { 0: 0 })).toBe(false);
  });

  it('una clave de mas o de menos las hace distintas', () => {
    expect(sonIguales({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sonIguales({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    // Mismo numero de claves, pero no las mismas.
    expect(sonIguales({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  it('una clave sin valor es lo mismo que una clave que no esta', () => {
    expect(sonIguales({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sonIguales({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it('un valor nulo no es lo mismo que una clave que no esta', () => {
    expect(sonIguales({ a: 1, b: null }, { a: 1 })).toBe(false);
  });
});

describe('yaEstaAplicada', () => {
  const actual = anotacion({
    titulo: 'Hoy',
    adjuntos: [{ id: 'd-1', tipo: 'diagrama', datos: {} }],
  }) as never;

  it('si todo lo que se pide ya esta, esta aplicada', () => {
    expect(
      yaEstaAplicada(actual, {
        titulo: 'Hoy',
        contenido: DOC,
        adjuntos: [{ id: 'd-1', tipo: 'diagrama', datos: {} }],
      }),
    ).toBe(true);
  });

  it('lo que no se pide no cuenta', () => {
    expect(yaEstaAplicada(actual, {})).toBe(true);
    expect(yaEstaAplicada(actual, { contenido: DOC })).toBe(true);
  });

  it('otro titulo, o quitarlo, no esta aplicado', () => {
    expect(yaEstaAplicada(actual, { titulo: 'Otro' })).toBe(false);
    expect(yaEstaAplicada(actual, { titulo: null })).toBe(false);
  });

  it('quitar un titulo que ya no esta, si esta aplicado', () => {
    expect(yaEstaAplicada(anotacion() as never, { titulo: null })).toBe(true);
  });

  it('otro texto no esta aplicado', () => {
    expect(yaEstaAplicada(actual, { contenido: { type: 'doc', content: [] } })).toBe(false);
  });

  it('quitar los adjuntos esta aplicado si no hay ninguno', () => {
    expect(yaEstaAplicada(anotacion() as never, { adjuntos: null })).toBe(true);
    expect(yaEstaAplicada(anotacion() as never, { adjuntos: [] })).toBe(true);
  });

  it('quitar los adjuntos no esta aplicado si todavia hay', () => {
    expect(yaEstaAplicada(actual, { adjuntos: null })).toBe(false);
    expect(yaEstaAplicada(actual, { adjuntos: [] })).toBe(false);
  });

  it('otro adjunto no esta aplicado', () => {
    expect(yaEstaAplicada(actual, { adjuntos: [{ id: 'd-2', tipo: 'diagrama', datos: {} }] })).toBe(
      false,
    );
  });
});
