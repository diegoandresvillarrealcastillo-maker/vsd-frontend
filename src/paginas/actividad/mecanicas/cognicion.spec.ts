import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  barajar,
  generarSecuencia,
  generarSecuenciaDeCasillas,
  generarTablero,
  ladoDeLaRondaSegun,
  LADOS_DE_SIEMPRE,
  RONDAS_DE_DIFERENCIA,
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

  describe('con lo que dice la sesion (SCRUM-208)', () => {
    it('sin decir nada, el tiempo a la vista es el de siempre: 700 ms por digito mas un segundo', () => {
      expect(tiempoAlaVista(4)).toBe(4 * 700 + 1000);
    });

    it('con otro tiempo por digito y otro margen, usa los de la sesion', () => {
      expect(tiempoAlaVista(4, 500, 2000)).toBe(4000);
      expect(tiempoAlaVista(4, 500, 0)).toBe(2000);
    });

    it('el largo mas corto al fallar es el largo inicial de la sesion, no un tres fijo', () => {
      expect(siguienteLargo(5, false, 5)).toBe(5);
      expect(siguienteLargo(6, false, 5)).toBe(5);
      expect(siguienteLargo(7, false, 5)).toBe(6);
      expect(siguienteLargo(5, true, 5)).toBe(6);
      expect(siguienteLargo(2, false, 2)).toBe(2);
    });
  });
});

describe('Secuencia de casillas (SCRUM-209)', () => {
  it('elige tantas casillas como se piden, todas de las que hay', () => {
    for (let vez = 0; vez < 50; vez++) {
      const secuencia = generarSecuenciaDeCasillas(7, 4);

      expect(secuencia).toHaveLength(7);
      expect(
        secuencia.every((indice) => Number.isInteger(indice) && indice >= 0 && indice < 4),
      ).toBe(true);
    }
  });

  it('la primera casilla posible y la ultima salen, y nunca una que no existe', () => {
    const azar = vi.spyOn(Math, 'random');

    azar.mockReturnValueOnce(0).mockReturnValueOnce(0.9999999);

    expect(generarSecuenciaDeCasillas(2, 9)).toEqual([0, 8]);
  });

  it('una casilla se puede repetir: es una secuencia, no una baraja', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(generarSecuenciaDeCasillas(3, 4)).toEqual([2, 2, 2]);
  });

  it('con largo cero, nada', () => {
    expect(generarSecuenciaDeCasillas(0, 4)).toEqual([]);
  });
});

describe('Encuentra la diferencia', () => {
  it('el tablero crece cada cinco rondas', () => {
    const delTablero = (ronda: number) =>
      ladoDeLaRondaSegun(ronda, RONDAS_DE_DIFERENCIA, LADOS_DE_SIEMPRE);

    expect([1, 5, 6, 10, 11, 15].map(delTablero)).toEqual([3, 3, 4, 4, 5, 5]);
  });

  describe('con lo que dice la sesion (SCRUM-208)', () => {
    it('las reglas de siempre son quince rondas y lados de 3, 4 y 5', () => {
      expect(RONDAS_DE_DIFERENCIA).toBe(15);
      expect(LADOS_DE_SIEMPRE).toEqual([3, 4, 5]);
    });

    it('con las reglas de siempre, cada ronda cae en el mismo lado que antes', () => {
      for (let ronda = 1; ronda <= 15; ronda++) {
        const deSiempre = ronda <= 5 ? 3 : ronda <= 10 ? 4 : 5;

        expect(ladoDeLaRondaSegun(ronda, 15, [3, 4, 5]), `ronda ${String(ronda)}`).toBe(deSiempre);
      }
    });

    it('reparte las rondas en tramos iguales entre los lados que diga la sesion', () => {
      // Seis rondas y dos lados: tres y tres.
      expect([1, 2, 3, 4, 5, 6].map((ronda) => ladoDeLaRondaSegun(ronda, 6, [3, 5]))).toEqual([
        3, 3, 3, 5, 5, 5,
      ]);
      // Siete rondas y tres lados: no se reparten parejo, y el ultimo tramo no se queda sin jugar.
      expect([1, 2, 3, 4, 5, 6, 7].map((ronda) => ladoDeLaRondaSegun(ronda, 7, [3, 4, 5]))).toEqual(
        [3, 3, 3, 4, 4, 5, 5],
      );
    });

    it('con un solo lado, todas las rondas son de ese', () => {
      expect([1, 5, 10].map((ronda) => ladoDeLaRondaSegun(ronda, 10, [4]))).toEqual([4, 4, 4]);
    });

    it('una ronda de mas o de menos no se sale de los lados', () => {
      expect(ladoDeLaRondaSegun(99, 15, [3, 4, 5])).toBe(5);
      expect(ladoDeLaRondaSegun(0, 15, [3, 4, 5])).toBe(3);
      // Con otros lados, el de antes del primer tramo es el primero (y no un 3 de respaldo).
      expect(ladoDeLaRondaSegun(0, 10, [4, 5])).toBe(4);
    });
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
