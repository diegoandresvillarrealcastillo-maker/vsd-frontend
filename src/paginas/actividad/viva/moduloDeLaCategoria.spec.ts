import { describe, expect, it } from 'vitest';

import { moduloDeLaCategoria } from './moduloDeLaCategoria.ts';

describe('moduloDeLaCategoria', () => {
  it.each([
    ['Bienestar', 'bienestar'],
    ['Cognición', 'cognicion'],
    ['Emociones', 'emociones'],
  ])('%s es del modulo %s', (nombre, modulo) => {
    expect(moduloDeLaCategoria(nombre)).toBe(modulo);
  });

  it('no distingue mayusculas ni acentos', () => {
    expect(moduloDeLaCategoria('COGNICION')).toBe('cognicion');
    expect(moduloDeLaCategoria('cognición')).toBe('cognicion');
    expect(moduloDeLaCategoria('  bienestar  ')).toBe('bienestar');
  });

  it('una categoria desconocida no tiene modulo: se ve con el color neutro', () => {
    expect(moduloDeLaCategoria('Otra cosa')).toBeUndefined();
    expect(moduloDeLaCategoria('')).toBeUndefined();
  });
});
