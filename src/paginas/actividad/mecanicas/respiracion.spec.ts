import { describe, expect, it } from 'vitest';

import {
  cuantosCiclos,
  duracionDelCiclo,
  formatearElTiempo,
  puntoDeLaRespiracion,
  type PatronDeRespiracion,
} from './respiracion.ts';

/**
 * El ritmo de la respiracion guiada (SCRUM-210), sin pantalla: dado cuanto tiempo lleva, que etapa
 * toca, cuantos segundos le quedan a esa etapa y cuando se acaba todo.
 *
 * Son funciones puras: la pantalla solo pinta lo que dicen, y el ritmo se prueba sin relojes.
 */
const CUATRO_SEIS: PatronDeRespiracion = { inhalaSegundos: 4, exhalaSegundos: 6, pausaSegundos: 0 };
const CON_PAUSA: PatronDeRespiracion = { inhalaSegundos: 4, exhalaSegundos: 4, pausaSegundos: 2 };

describe('duracionDelCiclo', () => {
  it('suma las tres etapas', () => {
    expect(duracionDelCiclo(CUATRO_SEIS)).toBe(10);
    expect(duracionDelCiclo(CON_PAUSA)).toBe(10);
    expect(duracionDelCiclo({ inhalaSegundos: 8, exhalaSegundos: 10, pausaSegundos: 4 })).toBe(22);
  });
});

describe('cuantosCiclos', () => {
  it.each([
    [120, CUATRO_SEIS, 12],
    [60, CON_PAUSA, 6],
    [180, { inhalaSegundos: 5, exhalaSegundos: 5, pausaSegundos: 0 }, 18],
    // Si no se reparte parejo, el entero mas cercano: la sesion dura unos segundos mas o menos.
    [65, CUATRO_SEIS, 7],
    [64, CUATRO_SEIS, 6],
    [600, { inhalaSegundos: 8, exhalaSegundos: 10, pausaSegundos: 4 }, 27],
  ])('%i s con ciclos de este patron son %i ciclos', (duracion, patron, esperados) => {
    expect(cuantosCiclos(duracion, patron)).toBe(esperados);
  });

  it('nunca menos de uno', () => {
    expect(cuantosCiclos(5, { inhalaSegundos: 8, exhalaSegundos: 10, pausaSegundos: 4 })).toBe(1);
  });
});

describe('puntoDeLaRespiracion', () => {
  it.each([
    [0, 0, 'inhala', 4],
    [0.01, 0, 'inhala', 4],
    [1, 0, 'inhala', 3],
    [3.99, 0, 'inhala', 1],
    [4, 0, 'exhala', 6],
    [5.5, 0, 'exhala', 5],
    [9.99, 0, 'exhala', 1],
    [10, 1, 'inhala', 4],
    [14, 1, 'exhala', 6],
    [110, 11, 'inhala', 4],
    [115, 11, 'exhala', 5],
  ])(
    'con el 4-6, a los %f s va en el ciclo %i, en «%s» y le quedan %i s',
    (t, ciclo, etapa, restan) => {
      expect(puntoDeLaRespiracion(t, CUATRO_SEIS, 12)).toMatchObject({
        ciclo,
        etapa,
        restanSegundos: restan,
        terminada: false,
      });
    },
  );

  it.each([
    [0, 'inhala', 4],
    [3.5, 'inhala', 1],
    [4, 'pausa', 2],
    [5.5, 'pausa', 1],
    [6, 'exhala', 4],
    [9.5, 'exhala', 1],
    [10, 'inhala', 4],
  ])('con la pausa de 2 s, a los %f s toca «%s» y le quedan %i s', (t, etapa, restan) => {
    expect(puntoDeLaRespiracion(t, CON_PAUSA, 6)).toMatchObject({
      etapa,
      restanSegundos: restan,
    });
  });

  it('sin pausa, nunca pasa por la etapa «pausa»', () => {
    for (let t = 0; t < 40; t += 0.25) {
      expect(puntoDeLaRespiracion(t, CUATRO_SEIS, 4).etapa).not.toBe('pausa');
    }
  });

  it('el avance dice cuanto de la etapa lleva, de 0 a 1', () => {
    expect(puntoDeLaRespiracion(0, CUATRO_SEIS, 12).avance).toBe(0);
    expect(puntoDeLaRespiracion(2, CUATRO_SEIS, 12).avance).toBeCloseTo(0.5);
    expect(puntoDeLaRespiracion(4, CUATRO_SEIS, 12).avance).toBe(0);
    expect(puntoDeLaRespiracion(7, CUATRO_SEIS, 12).avance).toBeCloseTo(0.5);
    expect(puntoDeLaRespiracion(9.9, CUATRO_SEIS, 12).avance).toBeCloseTo(0.983, 2);
  });

  it('se acaba al cumplirse los ciclos: ni un instante antes', () => {
    expect(puntoDeLaRespiracion(119.99, CUATRO_SEIS, 12).terminada).toBe(false);
    expect(puntoDeLaRespiracion(120, CUATRO_SEIS, 12).terminada).toBe(true);
    expect(puntoDeLaRespiracion(500, CUATRO_SEIS, 12).terminada).toBe(true);
  });

  it('una vez terminada, queda en el ultimo ciclo, en «exhala», sin segundos por delante', () => {
    expect(puntoDeLaRespiracion(120, CUATRO_SEIS, 12)).toEqual({
      ciclo: 11,
      etapa: 'exhala',
      restanSegundos: 0,
      avance: 1,
      terminada: true,
    });
  });

  it('un tiempo negativo se toma como el principio', () => {
    expect(puntoDeLaRespiracion(-3, CUATRO_SEIS, 12)).toMatchObject({
      ciclo: 0,
      etapa: 'inhala',
      restanSegundos: 4,
    });
  });
});

describe('formatearElTiempo', () => {
  it.each([
    [95, '1:35'],
    [60, '1:00'],
    [59, '0:59'],
    [5, '0:05'],
    [0, '0:00'],
    [600, '10:00'],
    [125.2, '2:06'],
    [-4, '0:00'],
  ])('%f s se lee %s', (segundos, texto) => {
    expect(formatearElTiempo(segundos)).toBe(texto);
  });
});
