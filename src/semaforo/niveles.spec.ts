import { describe, expect, it } from 'vitest';

import type { Pendiente } from '../infraestructura/api/pendientes.ts';
import { agrupar, dentroDeDias, diasDesde, edad, NIVEL, textoDelRecordatorio } from './niveles.ts';

describe('cada color es un plazo (SCRUM-107)', () => {
  it('urgente no sube; los otros suben un escalon', () => {
    expect(NIVEL.urgente.sube).toBeNull();
    expect(NIVEL.prioridad.sube).toBe('urgente');
    expect(NIVEL.aplazable.sube).toBe('prioridad');
  });
});

describe('edad', () => {
  it.each([
    [0, 'Anotado hoy'],
    [1, 'Desde ayer'],
    [13, 'Hace 13 días'],
    [14, 'Hace 2 semanas'],
    [30, 'Hace 4 semanas'],
  ])('%i días: %s', (dias, texto) => {
    expect(edad(dias)).toBe(texto);
  });
});

describe('diasDesde', () => {
  it('cuenta dias completos, como el backend', () => {
    const ahora = new Date('2026-10-10T12:00:00.000Z');

    expect(diasDesde('2026-10-09T12:00:00.001Z', ahora)).toBe(0);
    expect(diasDesde('2026-10-09T12:00:00.000Z', ahora)).toBe(1);
    expect(diasDesde('2026-10-11T12:00:00.000Z', ahora)).toBe(0);
  });
});

describe('textoDelRecordatorio', () => {
  const base = { pendienteId: 'x', dias: 30, nivelSugerido: null } as const;

  it('el de plazo pregunta si se quiere revisar', () => {
    expect(textoDelRecordatorio({ ...base, nivel: 'urgente', tono: 'plazo' })).toBe(
      'Ey, tienes esto pendiente desde hace un tiempo. ¿Quieres revisarlo?',
    );
  });

  it('el suave no mete prisa', () => {
    expect(textoDelRecordatorio({ ...base, nivel: 'aplazable', tono: 'suave' })).toMatch(
      /no es urgente, pero no dejes que se acumule/,
    );
  });
});

describe('agrupar', () => {
  function uno(id: string, parcial: Partial<Pendiente>): Pendiente {
    return {
      id,
      texto: id,
      nivel: 'urgente',
      hecho: false,
      posponerHasta: null,
      creadoEn: '2026-10-01T00:00:00.000Z',
      editadoEn: '2026-10-01T00:00:00.000Z',
      ...parcial,
    };
  }

  it('por color, del mas antiguo al mas nuevo; lo hecho aparte, lo ultimo primero', () => {
    const { porNivel, hechos } = agrupar([
      uno('nuevo', { creadoEn: '2026-10-05T00:00:00.000Z' }),
      uno('viejo', { creadoEn: '2026-10-02T00:00:00.000Z' }),
      uno('verde', { nivel: 'aplazable' }),
      uno('hecho-antes', { hecho: true, editadoEn: '2026-10-03T00:00:00.000Z' }),
      uno('hecho-ahora', { hecho: true, editadoEn: '2026-10-06T00:00:00.000Z' }),
    ]);

    expect(porNivel.urgente.map((p) => p.id)).toEqual(['viejo', 'nuevo']);
    expect(porNivel.prioridad).toEqual([]);
    expect(porNivel.aplazable.map((p) => p.id)).toEqual(['verde']);
    expect(hechos.map((p) => p.id)).toEqual(['hecho-ahora', 'hecho-antes']);
  });
});

describe('dentroDeDias', () => {
  it('suma dias enteros', () => {
    expect(dentroDeDias(7, new Date('2026-10-01T10:00:00.000Z'))).toBe('2026-10-08T10:00:00.000Z');
  });
});
