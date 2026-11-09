import { describe, expect, it } from 'vitest';

import { leerDeduccionEspacial } from './parametrosDeDeduccionEspacial.ts';

const VALIDO = {
  modo: 'deduccion_espacial',
  filas: 2,
  columnas: 2,
  celdas: [
    { clave: 'a', etiqueta: 'Círculo azul', fila: 1, columna: 1 },
    { clave: 'b', etiqueta: 'Cuadrado verde', fila: 1, columna: 2 },
    { clave: 'c', etiqueta: 'Triángulo amarillo', fila: 2, columna: 1 },
    { clave: 'd', etiqueta: 'Estrella violeta', fila: 2, columna: 2 },
  ],
  pistas: ['Tiene cuatro lados.', 'Está en la fila superior.'],
  solucion: 'b',
  explicacion: 'La respuesta cumple ambas pistas.',
  puntosMaximos: 1,
};

describe('leerDeduccionEspacial', () => {
  it('acepta una cuadrícula completa y devuelve una copia', () => {
    const parametros = leerDeduccionEspacial(VALIDO);

    expect(parametros).toMatchObject({ filas: 2, columnas: 2, solucion: 'b' });
    expect(parametros?.celdas).not.toBe(VALIDO.celdas);
  });

  it('rechaza una solución ausente del tablero', () => {
    expect(leerDeduccionEspacial({ ...VALIDO, solucion: 'x' })).toBeNull();
  });

  it('rechaza posiciones duplicadas y tableros incompletos', () => {
    const repetidas = [...VALIDO.celdas.slice(0, 3), { ...VALIDO.celdas[3]!, fila: 1, columna: 1 }];

    expect(leerDeduccionEspacial({ ...VALIDO, celdas: repetidas })).toBeNull();
    expect(leerDeduccionEspacial({ ...VALIDO, celdas: VALIDO.celdas.slice(0, 3) })).toBeNull();
  });

  it('rechaza modos desconocidos', () => {
    expect(leerDeduccionEspacial({ ...VALIDO, modo: 'opciones' })).toBeNull();
  });

  it('rechaza pistas repetidas', () => {
    expect(
      leerDeduccionEspacial({ ...VALIDO, pistas: ['Mira la forma.', 'MIRA LA FORMA.'] }),
    ).toBeNull();
  });
});
