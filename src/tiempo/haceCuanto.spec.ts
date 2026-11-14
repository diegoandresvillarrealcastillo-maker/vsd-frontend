import { describe, expect, it } from 'vitest';

import { haceCuanto } from './haceCuanto.ts';

const AHORA = new Date('2026-10-07T12:00:00.000Z');
const hace = (milisegundos: number) => new Date(AHORA.getTime() - milisegundos).toISOString();
const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe('haceCuanto', () => {
  it('menos de un minuto es un momento', () => {
    expect(haceCuanto(hace(0), AHORA)).toBe('hace un momento');
    expect(haceCuanto(hace(59_999), AHORA)).toBe('hace un momento');
  });

  it('de un minuto a una hora, en minutos', () => {
    expect(haceCuanto(hace(MINUTO), AHORA)).toBe('hace 1 min');
    expect(haceCuanto(hace(5 * MINUTO + 30_000), AHORA)).toBe('hace 5 min');
    expect(haceCuanto(hace(HORA - 1), AHORA)).toBe('hace 59 min');
  });

  it('de una hora a un dia, en horas, redondeando hacia abajo', () => {
    expect(haceCuanto(hace(HORA), AHORA)).toBe('hace 1 h');
    expect(haceCuanto(hace(3 * HORA + 40 * MINUTO), AHORA)).toBe('hace 3 h');
    expect(haceCuanto(hace(DIA - 1), AHORA)).toBe('hace 23 h');
  });

  it('un dia o mas, en dias', () => {
    expect(haceCuanto(hace(DIA), AHORA)).toBe('hace 1 día');
    expect(haceCuanto(hace(2 * DIA + 5 * HORA), AHORA)).toBe('hace 2 días');
    expect(haceCuanto(hace(40 * DIA), AHORA)).toBe('hace 40 días');
  });

  it('los dias tambien se redondean hacia abajo', () => {
    expect(haceCuanto(hace(DIA + 12 * HORA), AHORA)).toBe('hace 1 día');
    expect(haceCuanto(hace(2 * DIA - 1), AHORA)).toBe('hace 1 día');
    expect(haceCuanto(hace(3 * DIA - MINUTO), AHORA)).toBe('hace 2 días');
  });

  it('una hora del futuro (el reloj cambio) es un momento, no un numero negativo', () => {
    expect(haceCuanto(new Date(AHORA.getTime() + HORA).toISOString(), AHORA)).toBe(
      'hace un momento',
    );
  });

  it('algo que no es una hora tambien', () => {
    expect(haceCuanto('ayer', AHORA)).toBe('hace un momento');
  });
});
