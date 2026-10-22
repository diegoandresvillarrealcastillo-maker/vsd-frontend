import { describe, expect, it } from 'vitest';

import { describirLaVersion } from './version.ts';

describe('describirLaVersion (SCRUM-234)', () => {
  it('dice la fecha de la compilacion y el commit', () => {
    expect(describirLaVersion({ compiladaEl: '2026-10-21T15:30:00.000Z', commit: '3fa3577' })).toBe(
      'Versión del 21/10/2026 · 3fa3577',
    );
  });

  it('la fecha es la de Colombia, no la de Greenwich: una compilacion de la noche cae en su dia', () => {
    // 03:00 UTC del 22 son las 22:00 del 21 en Bogota.
    expect(describirLaVersion({ compiladaEl: '2026-10-22T03:00:00.000Z', commit: 'abc1234' })).toBe(
      'Versión del 21/10/2026 · abc1234',
    );
  });

  it('sin commit dice solo la fecha', () => {
    expect(describirLaVersion({ compiladaEl: '2026-10-21T15:30:00.000Z', commit: null })).toBe(
      'Versión del 21/10/2026',
    );
  });

  it('sin fecha, como en desarrollo, lo dice en lugar de inventar una', () => {
    expect(describirLaVersion({ compiladaEl: null, commit: null })).toBe('Versión de desarrollo');
  });

  it('una fecha ilegible no rompe la pantalla', () => {
    expect(describirLaVersion({ compiladaEl: 'no es una fecha', commit: 'abc1234' })).toBe(
      'Versión de desarrollo',
    );
  });

  it('no lleva nada de la persona: solo cuando se compilo y que commit es', () => {
    const texto = describirLaVersion({
      compiladaEl: '2026-10-21T15:30:00.000Z',
      commit: '3fa3577',
    });

    expect(texto).not.toMatch(/@|usuario|cuenta/i);
  });
});
