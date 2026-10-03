import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  barajar,
  generarSecuencia,
  generarTablero,
  ladoDeLaRonda,
  MAXIMO_DE_PAREJAS,
  PAREJAS,
  puntajeDeParejas,
  repartir,
  siguienteLargo,
  tiempoAlaVista,
} from './cognicion.ts';

/**
 * Las reglas de los juegos, sin pantalla.
 *
 * Los umbrales de nivel viven en el servidor (0,40 y 0,70 para Parejas). Se
 * repiten aqui solo para dejar escrita la prueba que define la tarea: una
 * partida perfecta tiene que caer en "favorable" y una mala, fuera.
 */
const FAVORABLE_PAREJAS = 0.7;
const SEGUIMIENTO_PAREJAS = 0.4;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Parejas de cartas', () => {
  it('reparte doce cartas: cada simbolo, dos veces', () => {
    const cartas = repartir();

    expect(cartas).toHaveLength(PAREJAS * 2);

    for (let simbolo = 0; simbolo < PAREJAS; simbolo++) {
      expect(cartas.filter((carta) => carta.simbolo === simbolo)).toHaveLength(2);
    }
  });

  it('barajar no pierde ni repite nada', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8];

    expect([...barajar(lista)].sort()).toEqual(lista);
  });

  it.each([
    [6, 20],
    [8, 15],
    [10, 12],
    [12, 10],
    [20, 6],
    [30, 4],
  ])('con %i intentos, %i puntos', (intentos, puntos) => {
    expect(puntajeDeParejas(intentos)).toBe(puntos);
  });

  it('nunca pasa del maximo, ni con menos intentos de los posibles', () => {
    expect(puntajeDeParejas(1)).toBe(MAXIMO_DE_PAREJAS);
    expect(puntajeDeParejas(0)).toBe(MAXIMO_DE_PAREJAS);
  });

  it('una partida perfecta cae en favorable y una mala, fuera', () => {
    expect(puntajeDeParejas(PAREJAS) / MAXIMO_DE_PAREJAS).toBeGreaterThanOrEqual(FAVORABLE_PAREJAS);
    expect(puntajeDeParejas(30) / MAXIMO_DE_PAREJAS).toBeLessThan(SEGUIMIENTO_PAREJAS);
  });
});

describe('Secuencia de numeros', () => {
  it('genera tantos digitos como se piden, solo digitos', () => {
    expect(generarSecuencia(7)).toMatch(/^\d{7}$/);
  });

  it('un acierto alarga un digito; un fallo lo acorta, sin bajar de tres', () => {
    expect(siguienteLargo(5, true)).toBe(6);
    expect(siguienteLargo(5, false)).toBe(4);
    expect(siguienteLargo(3, false)).toBe(3);
  });

  it('las secuencias largas se dejan ver mas tiempo', () => {
    expect(tiempoAlaVista(8)).toBeGreaterThan(tiempoAlaVista(3));
  });
});

describe('Encuentra la diferencia', () => {
  it('el tablero crece cada cinco rondas', () => {
    expect([1, 5, 6, 10, 11, 15].map(ladoDeLaRonda)).toEqual([3, 3, 4, 4, 5, 5]);
  });

  it.each([3, 4, 5])('en un tablero de %i, cambia exactamente una casilla', (lado) => {
    for (let vez = 0; vez < 50; vez++) {
      const tablero = generarTablero(lado);
      const distintas = tablero.ahora
        .map((simbolo, indice) => (simbolo === tablero.antes[indice] ? null : indice))
        .filter((indice) => indice !== null);

      expect(tablero.antes).toHaveLength(lado * lado);
      expect(distintas).toEqual([tablero.cambio]);
    }
  });
});
