import { describe, expect, it } from 'vitest';

import { estiloDeLaCasilla, normalizarElNombre } from './coloresDeCasillas.ts';

/**
 * El color de cada casilla de «Recuerda los colores» (SCRUM-209).
 *
 * El color es un apoyo, nunca la unica pista: cada casilla lleva tambien su forma y su nombre (R10).
 * Los colores salen de la paleta de la aplicacion y no se inventan, igual que en los demas juegos.
 */
describe('normalizarElNombre', () => {
  it.each([
    ['Verde', 'verde'],
    ['  verde  ', 'verde'],
    ['ámbar', 'ambar'],
    ['Ámbar', 'ambar'],
    ['marrón', 'marron'],
    ['triángulo', 'triangulo'],
    ['círculo', 'circulo'],
  ])('«%s» es «%s»: con o sin tilde, con o sin mayusculas', (entra, sale) => {
    expect(normalizarElNombre(entra)).toBe(sale);
  });
});

describe('estiloDeLaCasilla', () => {
  const NOMBRES = [
    'verde',
    'azul',
    'ámbar',
    'violeta',
    'rosa',
    'turquesa',
    'gris',
    'naranja',
    'marrón',
  ];

  it.each(NOMBRES)('«%s» tiene su color, de la paleta de la aplicacion', (color) => {
    const estilo = estiloDeLaCasilla(color) as Record<string, string>;

    expect(estilo['--simbolo']).toMatch(/var\(--(app|viva)-/);
  });

  it('los nueve colores se distinguen entre si', () => {
    const colores = NOMBRES.map(
      (color) => (estiloDeLaCasilla(color) as Record<string, string>)['--simbolo'],
    );

    expect(new Set(colores).size).toBe(NOMBRES.length);
  });

  it('con otra ortografia, el mismo color', () => {
    expect(estiloDeLaCasilla('AMBAR')).toEqual(estiloDeLaCasilla('ámbar'));
    expect(estiloDeLaCasilla(' Verde ')).toEqual(estiloDeLaCasilla('verde'));
  });

  it('un color que no conoce se pinta con el tono neutro: se juega igual, por la forma y el nombre', () => {
    const neutro = estiloDeLaCasilla('verde lima oscuro') as Record<string, string>;

    expect(neutro['--simbolo']).toBe('var(--app-tenue)');
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'el nombre «%s» no es un color: se pinta con el neutro, no con algo del prototipo',
    (nombre) => {
      expect((estiloDeLaCasilla(nombre) as Record<string, string>)['--simbolo']).toBe(
        'var(--app-tenue)',
      );
    },
  );

  it('sin color, el tono neutro', () => {
    expect(estiloDeLaCasilla(undefined)).toEqual(estiloDeLaCasilla('no existe'));
  });

  it('no usa colores fijos: ninguno es un hexadecimal suelto', () => {
    for (const color of [...NOMBRES, 'no existe']) {
      const valor = (estiloDeLaCasilla(color) as Record<string, string>)['--simbolo'] ?? '';

      // `#fff` mezclado para aclarar es lo unico que se permite, igual que en las hojas de estilo.
      expect(valor.replace(/#fff\b/g, '')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
});
