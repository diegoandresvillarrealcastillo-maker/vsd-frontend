import { describe, expect, it } from 'vitest';

import { movimientoDeLaPropia } from './movimientoDeLaPropia.ts';
import type { Expresion } from './personajes.ts';

/**
 * El movimiento de la mascota propia (SCRUM-122). Como no cambia de cara, su
 * expresion se nota en como se mueve; esto fija que cada una se mueva distinto y
 * que ninguna deje una propiedad sin nombrar.
 */
const EXPRESIONES: readonly Expresion[] = ['normal', 'feliz', 'celebrando', 'dormida'];

/** Los valores por los que pasa una propiedad: un numero suelto es uno solo. */
function valores(propiedad: unknown): number[] {
  return Array.isArray(propiedad) ? (propiedad as number[]) : [propiedad as number];
}

function transicion(expresion: Expresion): {
  duration: number;
  repeat: number;
  repeatDelay?: number;
} {
  const { transition } = movimientoDeLaPropia(expresion, false);

  return transition as { duration: number; repeat: number; repeatDelay?: number };
}

describe('movimientoDeLaPropia', () => {
  describe('con movimiento', () => {
    it.each(EXPRESIONES)('%s nombra el desplazamiento, el giro y el tamano', (expresion) => {
      const movimiento = movimientoDeLaPropia(expresion, false);

      // Lo que no se nombra queda como lo dejo el movimiento anterior: una
      // mascota que pasa de celebrar a estar quieta se quedaria torcida.
      expect(movimiento).toHaveProperty('y');
      expect(movimiento).toHaveProperty('rotate');
      expect(movimiento).toHaveProperty('scale');
    });

    it.each(EXPRESIONES)('%s se repite sin parar mientras dure', (expresion) => {
      expect(transicion(expresion).repeat).toBe(Infinity);
    });

    it('cada expresion se mueve distinto', () => {
      const movimientos = EXPRESIONES.map((e) => JSON.stringify(movimientoDeLaPropia(e, false)));

      expect(new Set(movimientos).size).toBe(EXPRESIONES.length);
    });

    it('celebrando es la que mas salta, se inclina y crece', () => {
      const celebrando = movimientoDeLaPropia('celebrando', false);
      const feliz = movimientoDeLaPropia('feliz', false);

      expect(Math.min(...valores(celebrando.y))).toBeLessThan(Math.min(...valores(feliz.y)));
      expect(Math.max(...valores(celebrando.rotate).map(Math.abs))).toBeGreaterThan(
        Math.max(...valores(feliz.rotate).map(Math.abs)),
      );
      expect(Math.max(...valores(celebrando.scale))).toBeGreaterThan(
        Math.max(...valores(feliz.scale)),
      );
    });

    it('celebrando hace una pausa entre saltos; las demas no', () => {
      expect(transicion('celebrando').repeatDelay).toBeGreaterThan(0);

      for (const expresion of ['normal', 'feliz', 'dormida'] as const) {
        expect(transicion(expresion).repeatDelay).toBeUndefined();
      }
    });

    it('feliz se menea de un lado a otro', () => {
      const giro = valores(movimientoDeLaPropia('feliz', false).rotate);

      expect(Math.min(...giro)).toBeLessThan(0);
      expect(Math.max(...giro)).toBeGreaterThan(0);
    });

    it('dormida respira despacio: no sube ni se inclina, solo crece y encoge, y es la mas lenta', () => {
      const dormida = movimientoDeLaPropia('dormida', false);

      expect(dormida.y).toBe(0);
      expect(dormida.rotate).toBe(0);
      expect(valores(dormida.scale).length).toBeGreaterThan(1);

      for (const otra of ['normal', 'feliz', 'celebrando'] as const) {
        expect(transicion('dormida').duration).toBeGreaterThan(transicion(otra).duration);
      }
    });

    it('en reposo apenas se mece, derecha y del mismo tamano', () => {
      const normal = movimientoDeLaPropia('normal', false);

      expect(valores(normal.y).length).toBeGreaterThan(1);
      expect(Math.min(...valores(normal.y))).toBeGreaterThan(-5);
      expect(normal.rotate).toBe(0);
      expect(normal.scale).toBe(1);
    });

    it('todos los saltos vuelven a donde empezaron: la mascota no se va sola', () => {
      for (const expresion of EXPRESIONES) {
        const { y, rotate, scale } = movimientoDeLaPropia(expresion, false);

        for (const [propiedad, reposo] of [
          [y, 0],
          [rotate, 0],
          [scale, 1],
        ] as const) {
          const camino = valores(propiedad);

          expect(camino[0]).toBe(reposo);
          expect(camino[camino.length - 1]).toBe(reposo);
        }
      }
    });
  });

  describe('con prefers-reduced-motion', () => {
    it.each(EXPRESIONES)(
      '%s no se mueve: queda en reposo, derecha y sin transicion',
      (expresion) => {
        expect(movimientoDeLaPropia(expresion, true)).toStrictEqual({ y: 0, rotate: 0, scale: 1 });
      },
    );
  });
});
