import { describe, expect, it } from 'vitest';

import { desplazamientoParaCentrar } from './desplazamientoDelRecorrido.ts';

describe('desplazamientoParaCentrar (SCRUM-250)', () => {
  // Un recorrido de 400 px de alto con 1.500 px de contenido: se puede desplazar hasta 1.100.
  const RECORRIDO = { alto: 400, contenido: 1500 };

  it('centra la fila: su mitad queda en la mitad del recorrido', () => {
    // La fila empieza en 700 y mide 100: su mitad esta en 750; con 200 px de cada lado, 550.
    expect(desplazamientoParaCentrar({ arriba: 700, alto: 100 }, RECORRIDO)).toBe(550);
  });

  it('una fila de arriba no desplaza nada: no hay donde subir', () => {
    expect(desplazamientoParaCentrar({ arriba: 20, alto: 100 }, RECORRIDO)).toBe(0);
    expect(desplazamientoParaCentrar({ arriba: 0, alto: 150 }, RECORRIDO)).toBe(0);
  });

  it('una fila del final desplaza hasta el fondo y no mas', () => {
    expect(desplazamientoParaCentrar({ arriba: 1400, alto: 100 }, RECORRIDO)).toBe(1100);
  });

  it('si todo cabe, no desplaza', () => {
    expect(
      desplazamientoParaCentrar({ arriba: 100, alto: 100 }, { alto: 400, contenido: 300 }),
    ).toBe(0);
    expect(
      desplazamientoParaCentrar({ arriba: 100, alto: 100 }, { alto: 400, contenido: 400 }),
    ).toBe(0);
  });

  it('nunca devuelve un desplazamiento negativo ni mayor que el posible', () => {
    for (const arriba of [-50, 0, 300, 750, 1450, 5000]) {
      const resultado = desplazamientoParaCentrar({ arriba, alto: 120 }, RECORRIDO);

      expect(resultado).toBeGreaterThanOrEqual(0);
      expect(resultado).toBeLessThanOrEqual(1100);
    }
  });
});
