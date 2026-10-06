import { describe, expect, it } from 'vitest';

import type { Pendiente } from '../infraestructura/api/pendientes.ts';
import {
  agrupar,
  dentroDeDias,
  diasDesde,
  edad,
  NIVEL,
  textoDelRecordatorio,
  vencimiento,
} from './niveles.ts';

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

describe('vencimiento (SCRUM-119)', () => {
  const HOY = '2026-10-05';

  it.each([
    ['2026-10-05', 'Vence hoy', false],
    ['2026-10-06', 'Vence mañana', false],
    ['2026-10-04', 'Venció ayer', true],
    ['2026-10-02', 'Venció hace 3 días', true],
    ['2026-09-05', 'Venció hace 30 días', true],
  ])('%s: %s', (fecha, texto, vencida) => {
    expect(vencimiento(fecha, HOY)).toEqual({ texto, vencida });
  });

  it('un dia mas lejano se dice con su nombre', () => {
    expect(vencimiento('2026-10-12', HOY).texto).toMatch(/^Vence el lunes, 12 de octubre$/);
    expect(vencimiento('2026-10-12', HOY).vencida).toBe(false);
  });

  it('cruza el cambio de mes y de ano', () => {
    expect(vencimiento('2026-11-01', '2026-10-31').texto).toBe('Vence mañana');
    expect(vencimiento('2027-01-01', '2026-12-31').texto).toBe('Vence mañana');
    expect(vencimiento('2026-12-30', '2027-01-02').texto).toBe('Venció hace 3 días');
  });

  it('depende del dia de la persona, no del instante: el mismo limite es hoy o ya paso', () => {
    // El 5 es hoy en Madrid y ya fue ayer en Tokio.
    expect(vencimiento('2026-10-05', '2026-10-05').vencida).toBe(false);
    expect(vencimiento('2026-10-05', '2026-10-06').vencida).toBe(true);
  });
});

describe('textoDelRecordatorio', () => {
  const base = { pendienteId: 'x', dias: 30, nivelSugerido: null, fechaLimite: null } as const;

  it('el de plazo pregunta si se quiere revisar', () => {
    expect(textoDelRecordatorio({ ...base, nivel: 'urgente', tono: 'plazo' })).toBe(
      'Ey, tienes esto pendiente desde hace un tiempo. ¿Quieres revisarlo?',
    );
  });

  it('si es por la fecha que puso la persona, dice que llego el dia (SCRUM-119)', () => {
    const texto = textoDelRecordatorio({
      ...base,
      nivel: 'aplazable',
      tono: 'plazo',
      fechaLimite: '2026-10-12',
    });

    expect(texto).toBe('Llegó la fecha que le pusiste a esto. ¿Quieres revisarlo?');
    expect(texto).not.toMatch(/hace un tiempo/);
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
      fechaLimite: null,
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
