import { describe, expect, it } from 'vitest';

import { marcoDelAsistente, puntoDeLaMascota } from './marco.ts';

describe('donde se abre VSD IA', () => {
  it('en el movil ocupa casi todo el ancho, abajo, y deja sitio arriba a la mascota', () => {
    const marco = marcoDelAsistente(375, 812, true, 72);

    expect(marco.left).toBe(12);
    expect(marco.width).toBe(351);
    expect(marco.top + marco.height).toBe(812 - 12);
    // La mascota posada no pisa la barra superior (76 px).
    expect(puntoDeLaMascota(marco, 72).y).toBeGreaterThanOrEqual(76);
  });

  it('fuera del movil es una columna abajo a la izquierda', () => {
    const marco = marcoDelAsistente(1280, 800, false, 96);

    expect(marco.width).toBe(420);
    expect(marco.left).toBeLessThan(100);
    expect(marco.top + marco.height).toBe(800 - 24);
    expect(puntoDeLaMascota(marco, 96).y).toBeGreaterThanOrEqual(76);
  });

  it('la mascota se posa en la esquina de arriba a la izquierda, medio fuera', () => {
    const marco = { left: 100, top: 300, width: 400, height: 500 };
    const punto = puntoDeLaMascota(marco, 80);

    expect(punto.x).toBeLessThan(marco.left);
    expect(punto.x + 80).toBeGreaterThan(marco.left);
    expect(punto.y).toBeLessThan(marco.top);
    expect(punto.y + 80).toBeGreaterThan(marco.top);
  });

  it('en una ventana muy baja no se sale por arriba', () => {
    const marco = marcoDelAsistente(375, 420, true, 72);

    expect(puntoDeLaMascota(marco, 72).y).toBeGreaterThanOrEqual(4);
    expect(marco.height).toBeGreaterThanOrEqual(240);
  });
});
