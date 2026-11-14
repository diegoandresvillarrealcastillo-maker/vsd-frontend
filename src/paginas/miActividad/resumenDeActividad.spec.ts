import { describe, expect, it } from 'vitest';

import type { DiaDeLaSemana } from '../../infraestructura/api/racha.ts';
import {
  actividadesDeLaSemana,
  diasConActividad,
  esReciente,
  MINUTOS_DE_LO_RECIENTE,
  textoDelResumen,
  ultimasActividades,
  type HechoConModulo,
} from './resumenDeActividad.ts';

/** Lunes 19 a domingo 25 de octubre de 2026, con lo que se diga en cada dia. */
function semana(estados: DiaDeLaSemana['estado'][]): DiaDeLaSemana[] {
  return estados.map((estado, indice) => ({
    dia: `2026-10-${String(19 + indice)}`,
    estado,
  }));
}

function hecho(n: number, dia: string, hora = '15:00', nombre = 'Parejas'): HechoConModulo {
  return {
    id: `h${String(n)}`,
    modulo: 'cognicion',
    actividad: { id: `a${String(n)}`, nombre },
    dia,
    hechaEn: `${dia}T${hora}:00.000Z`,
  };
}

describe('diasConActividad (SCRUM-296)', () => {
  it('cuenta los dias hechos de la semana', () => {
    const dias = semana(['hecho', 'sinActividad', 'hecho', 'hoy', 'futuro', 'futuro', 'futuro']);

    expect(diasConActividad(dias)).toBe(2);
  });

  it('un dia cubierto por un congelamiento no es un dia de participacion', () => {
    const dias = semana(['hecho', 'cubierto', 'hecho', 'hoy', 'futuro', 'futuro', 'futuro']);

    expect(diasConActividad(dias)).toBe(2);
  });

  it('sin semana, ninguno', () => {
    expect(diasConActividad([])).toBe(0);
  });
});

describe('actividadesDeLaSemana (SCRUM-296)', () => {
  const dias = semana(['hecho', 'hecho', 'hecho', 'hoy', 'futuro', 'futuro', 'futuro']);

  it('cuenta solo lo hecho en los dias de esta semana', () => {
    const hechos = [
      hecho(1, '2026-10-21'),
      hecho(2, '2026-10-21'),
      hecho(3, '2026-10-19'),
      // De la semana anterior: no cuenta.
      hecho(4, '2026-10-18'),
    ];

    expect(actividadesDeLaSemana(dias, hechos)).toBe(3);
  });

  it('sin semana no hay nada que contar', () => {
    expect(actividadesDeLaSemana([], [hecho(1, '2026-10-21')])).toBe(0);
  });
});

describe('ultimasActividades (SCRUM-296)', () => {
  it('junta los modulos y deja primero lo mas reciente', () => {
    const antigua = hecho(1, '2026-10-20', '13:00', 'Estiramientos');
    const reciente = {
      ...hecho(2, '2026-10-21', '20:30', 'Respirar'),
      modulo: 'bienestar' as const,
    };
    const mediana = { ...hecho(3, '2026-10-21', '15:00'), modulo: 'emociones' as const };

    expect(ultimasActividades([antigua, reciente, mediana], 10).map((uno) => uno.id)).toEqual([
      'h2',
      'h3',
      'h1',
    ]);
  });

  it('se queda con las que se piden', () => {
    const muchas = [1, 2, 3, 4, 5, 6, 7].map((n) => hecho(n, '2026-10-21', `1${String(n)}:00`));

    expect(ultimasActividades(muchas, 5).map((uno) => uno.id)).toEqual([
      'h7',
      'h6',
      'h5',
      'h4',
      'h3',
    ]);
  });

  it('no cambia la lista que recibe', () => {
    const original = [hecho(1, '2026-10-20'), hecho(2, '2026-10-21')];

    ultimasActividades(original, 5);

    expect(original.map((uno) => uno.id)).toEqual(['h1', 'h2']);
  });
});

describe('esReciente (SCRUM-311)', () => {
  const AHORA = new Date('2026-10-21T20:00:00.000Z');

  function haceMinutos(minutos: number): string {
    return new Date(AHORA.getTime() - minutos * 60_000).toISOString();
  }

  it('lo hecho hace pocos minutos es reciente', () => {
    expect(esReciente(haceMinutos(0), AHORA)).toBe(true);
    expect(esReciente(haceMinutos(14), AHORA)).toBe(true);
  });

  it('el limite son quince minutos, y pasado el limite ya no', () => {
    expect(MINUTOS_DE_LO_RECIENTE).toBe(15);
    expect(esReciente(haceMinutos(15), AHORA)).toBe(true);
    expect(esReciente(haceMinutos(16), AHORA)).toBe(false);
    expect(esReciente(haceMinutos(60 * 24), AHORA)).toBe(false);
  });

  it('un reloj adelantado unos minutos no le quita lo reciente', () => {
    expect(esReciente(haceMinutos(-5), AHORA)).toBe(true);
  });

  it('lo que dice venir del futuro lejano no es reciente', () => {
    expect(esReciente(haceMinutos(-120), AHORA)).toBe(false);
  });

  it('una fecha que no se entiende no es reciente', () => {
    expect(esReciente('no es una fecha', AHORA)).toBe(false);
  });
});

describe('textoDelResumen (SCRUM-296)', () => {
  it('dice los dias y las actividades, como en la propuesta', () => {
    expect(textoDelResumen(3, 5)).toBe('Participaste 3 días y completaste 5 actividades.');
  });

  it('en singular cuando es uno', () => {
    expect(textoDelResumen(1, 1)).toBe('Participaste 1 día y completaste 1 actividad.');
  });

  it('sin poder leer las actividades, dice solo los dias', () => {
    expect(textoDelResumen(2, undefined)).toBe('Participaste 2 días esta semana.');
  });

  it('si las actividades no cuadran con los dias, no inventa: dice solo los dias', () => {
    expect(textoDelResumen(2, 0)).toBe('Participaste 2 días esta semana.');
  });

  it('una semana sin actividad se dice con calma y sin reclamar', () => {
    expect(textoDelResumen(0, 0)).toBe(
      'Esta semana todavía no hay actividad. Cuando quieras, aquí empieza.',
    );
    expect(textoDelResumen(0, undefined)).toBe(
      'Esta semana todavía no hay actividad. Cuando quieras, aquí empieza.',
    );
  });
});
