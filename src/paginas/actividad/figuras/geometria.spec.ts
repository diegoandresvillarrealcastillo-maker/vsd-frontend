import { describe, expect, it } from 'vitest';

import { arco, desde, flecha, flechaDoble, ondas, redondear, trazo } from './geometria.ts';

/**
 * La geometria de las figuras de estiramiento (SCRUM-226): puntos, flechas y arcos, sin dibujar nada.
 * Con el eje y hacia abajo: 0 grados es hacia abajo, 90 hacia la derecha y 180 hacia arriba.
 */
describe('desde', () => {
  it.each([
    [0, [10, 20]],
    [90, [10, 20]],
  ])('con largo cero se queda donde esta (%i grados)', (grados, origen) => {
    expect(desde([origen[0] ?? 0, origen[1] ?? 0], 0, grados)).toEqual([10, 20]);
  });

  it('0 grados es hacia abajo, 90 a la derecha, 180 arriba y -90 a la izquierda', () => {
    expect(desde([10, 10], 5, 0)).toEqual([10, 15]);
    expect(desde([10, 10], 5, 90)).toEqual([15, 10]);
    expect(desde([10, 10], 5, 180)).toEqual([10, 5]);
    expect(desde([10, 10], 5, -90)).toEqual([5, 10]);
  });

  it('redondea a un decimal para que el SVG pese poco', () => {
    expect(redondear(1.2345)).toBe(1.2);
    expect(desde([0, 0], 1, 45)).toEqual([0.7, 0.7]);
  });
});

describe('trazo', () => {
  it('une los puntos con una linea quebrada', () => {
    expect(trazo([1, 2], [3, 4], [5.55, 6])).toBe('M1 2 L3 4 L5.6 6');
  });
});

describe('flecha', () => {
  it('termina donde empieza la punta, para que el trazo no sobresalga por delante', () => {
    const { d } = flecha([0, 0], [10, 0], 4);

    expect(d).toBe('M0 0 L7.6 0');
  });

  it('la punta es un triangulo que sale de la meta', () => {
    const { punta } = flecha([0, 0], [10, 0], 4);

    expect(punta.startsWith('M10 0 L')).toBe(true);
    expect(punta.endsWith('Z')).toBe(true);
    expect(punta.match(/L/g)).toHaveLength(2);
  });

  it('una flecha de largo cero no es un numero que no es un numero', () => {
    const { d, punta } = flecha([5, 5], [5, 5]);

    expect(`${d} ${punta}`).not.toMatch(/NaN|Infinity/);
  });

  it('apunta hacia donde va: la base de la punta queda detras de la meta', () => {
    const arriba = flecha([10, 30], [10, 10], 4).punta;
    const bases = [...arriba.matchAll(/L([\d.-]+) ([\d.-]+)/g)].map((m) => Number(m[2]));

    // Hacia arriba (y disminuye): la base esta mas abajo que la meta.
    expect(bases.every((y) => y > 10)).toBe(true);
  });
});

describe('flechaDoble', () => {
  it('tiene una punta en cada extremo', () => {
    const { punta } = flechaDoble([0, 10], [20, 10]);

    expect(punta.match(/Z/g)).toHaveLength(2);
    expect(punta).toContain('M20 10');
    expect(punta).toContain('M0 10');
  });
});

describe('arco', () => {
  it('de menor a mayor gira como las agujas del reloj', () => {
    expect(arco([32, 32], 10, 0, 90).d).toMatch(/ 0 0 1 /);
  });

  it('de mayor a menor gira al reves', () => {
    expect(arco([32, 32], 10, 90, 0).d).toMatch(/ 0 0 0 /);
  });

  it('un arco de mas de media vuelta usa el arco grande', () => {
    expect(arco([32, 32], 10, 0, 300).d).toMatch(/ 0 1 1 /);
    expect(arco([32, 32], 10, 300, 0).d).toMatch(/ 0 1 0 /);
  });

  it('empieza y termina en el radio pedido', () => {
    const { d } = arco([32, 32], 10, 0, 90);

    expect(d.startsWith('M42 32 ')).toBe(true);
    expect(d.endsWith(' 32 42')).toBe(true);
  });

  it('nunca produce un numero que no sea un numero', () => {
    for (const [de, hasta] of [
      [0, 360],
      [-270, 40],
      [450, 140],
      [10, 10],
    ] as const) {
      const { d, punta } = arco([30, 30], 8, de, hasta);

      expect(`${d} ${punta}`).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe('ondas', () => {
  it('son cuatro rayitas, dos a cada lado', () => {
    expect(ondas([32, 32]).match(/M/g)).toHaveLength(4);
  });
});
