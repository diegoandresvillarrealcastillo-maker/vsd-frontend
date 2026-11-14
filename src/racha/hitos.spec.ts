import { describe, expect, it } from 'vitest';

import {
  escenaDelHito,
  hitoAnteriorDe,
  nombreDelHito,
  queCambiaEn,
  type EscenaDelHito,
} from './hitos.ts';

/**
 * Los hitos de la racha (SCRUM-243): como se llaman, que escena tienen y que cambia en cada uno.
 *
 * La tabla de hitos vive en el servidor (`HITOS_DE_LA_RACHA`, SCRUM-242); aqui solo se le pone
 * nombre y cara a lo que ese servidor manda en la escalera.
 */

const DE_LA_TABLA = [3, 7, 14, 30, 50, 100, 200, 365];

describe('nombreDelHito', () => {
  it.each([
    [3, 'Primera chispa'],
    [7, 'Primera semana'],
    [14, 'Dos semanas'],
    [30, 'Un mes'],
    [50, 'Cincuenta días'],
    [100, 'Cien días'],
    [200, 'Doscientos días'],
    [365, 'Un año'],
    [730, 'Dos años'],
    [1095, 'Tres años'],
    [3650, 'Diez años'],
    [4015, '11 años'],
  ])('el hito de %i dias se llama «%s»', (hito, nombre) => {
    expect(nombreDelHito(hito)).toBe(nombre);
  });

  it('un numero que no es un hito se dice en dias, sin romper nada', () => {
    expect(nombreDelHito(12)).toBe('12 días');
  });
});

describe('escenaDelHito', () => {
  it.each<[number, EscenaDelHito]>([
    [3, 'chispa'],
    [7, 'semana'],
    [14, 'dosSemanas'],
    [30, 'mes'],
    [50, 'cincuenta'],
    [100, 'cien'],
    [200, 'doscientos'],
    [365, 'ano'],
    [730, 'ano'],
    [1095, 'ano'],
  ])('el hito de %i dias tiene la escena «%s»', (hito, escena) => {
    expect(escenaDelHito(hito)).toBe(escena);
  });

  it('un numero que no es un hito usa la escena de la tabla mas cercana por debajo', () => {
    expect(escenaDelHito(20)).toBe('dosSemanas');
    expect(escenaDelHito(1)).toBe('chispa');
  });
});

describe('queCambiaEn', () => {
  it.each(DE_LA_TABLA)('cada hito de la tabla (%i) dice que cambia, en una frase', (hito) => {
    const frase = queCambiaEn(hito);

    expect(frase.length).toBeGreaterThan(10);
    expect(frase.length).toBeLessThanOrEqual(60);
  });

  it('los aniversarios dicen lo mismo que el primer ano', () => {
    expect(queCambiaEn(730)).toBe(queCambiaEn(365));
  });

  it('describe la escena, no promete una llama distinta de la que existe', () => {
    // La llama de la barra cambia a los 7, 30, 90 y 365 dias (SCRUM-202); estos textos hablan de la
    // escena de celebracion, asi que no nombran ningun nivel de la llama.
    for (const hito of DE_LA_TABLA) {
      expect(queCambiaEn(hito)).not.toMatch(/nivel|ascua|hoguera sube|llama firme/iu);
    }
  });

  it('ningun texto habla de perdida ni de castigo', () => {
    for (const hito of DE_LA_TABLA) {
      expect(queCambiaEn(hito)).not.toMatch(/perdi|rompi|fall|apag|castig|error/iu);
    }
  });
});

describe('hitoAnteriorDe', () => {
  it('es el mayor hito logrado', () => {
    expect(
      hitoAnteriorDe([
        { dias: 3, logrado: true },
        { dias: 7, logrado: true },
        { dias: 14, logrado: false },
      ]),
    ).toBe(7);
  });

  it('sin ninguno logrado, es cero: la barra parte de cero', () => {
    expect(hitoAnteriorDe([{ dias: 3, logrado: false }])).toBe(0);
  });

  it('sin escalera (un servidor viejo), tambien es cero', () => {
    expect(hitoAnteriorDe([])).toBe(0);
  });
});
