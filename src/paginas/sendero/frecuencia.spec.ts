import { describe, expect, it } from 'vitest';

import { etiquetaDeFrecuencia } from './frecuencia.ts';

describe('etiquetaDeFrecuencia', () => {
  it('dice cada cuanto toca', () => {
    expect(etiquetaDeFrecuencia({ tipo: 'diaria' })).toBe('Diaria');
    expect(etiquetaDeFrecuencia({ tipo: 'unica' })).toBe('Una vez');
    expect(etiquetaDeFrecuencia({ tipo: 'semanal', dias: [1, 4] })).toBe('Lun · Jue');
    expect(etiquetaDeFrecuencia({ tipo: 'semanal', dias: [6, 7] })).toBe('Sáb · Dom');
  });

  it('sin frecuencia, o con dias que no existen, no inventa etiqueta', () => {
    expect(etiquetaDeFrecuencia(undefined)).toBeUndefined();
    expect(etiquetaDeFrecuencia({ tipo: 'semanal', dias: [] })).toBeUndefined();
    expect(etiquetaDeFrecuencia({ tipo: 'semanal', dias: [0, 9] })).toBeUndefined();
    expect(etiquetaDeFrecuencia({ tipo: 'semanal', dias: [2, 9] })).toBe('Mar');
  });
});
