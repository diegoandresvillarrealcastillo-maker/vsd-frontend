import { describe, expect, it } from 'vitest';

import {
  ANAGRAMA,
  CALCULO,
  CESTAS,
  CESTAS_DE_REFLEXION,
  COMPLETAR,
  ESCENA,
  FLUJO,
  INTRUSO,
  LISTA,
  PUNTOS,
} from '../../../pruebas/sesionesDeCognicion.ts';
import {
  leerElCalculo,
  leerFlujo,
  leerIntruso,
  leerLaEscena,
  leerLaLista,
  leerLasCestas,
  leerLasPalabras,
  leerPuntos,
} from './parametrosDeLaCognicion.ts';

/**
 * Lo que la pantalla lee de `sesion.parametros` en los motores de Cognicion del catalogo (SCRUM-225).
 *
 * Cada lectura devuelve `null` ante una forma que no entiende (una copia guardada por una version anterior, o
 * los parametros de un servidor mas nuevo): la pantalla dice que necesita la sesion de hoy en lugar de pintarse
 * a medias. Tolera lo que sobra, y devuelve copias: nunca la referencia de lo que recibio.
 */

const SIN_NADA: unknown[] = [undefined, null, 'texto', 7, [], {}];

describe.each([
  ['leerFlujo', leerFlujo, FLUJO],
  ['leerPuntos', leerPuntos, PUNTOS],
  ['leerLaLista', leerLaLista, LISTA],
  ['leerLaEscena', leerLaEscena, ESCENA],
  ['leerIntruso', leerIntruso, INTRUSO],
  ['leerLasCestas', leerLasCestas, CESTAS],
  ['leerLasPalabras', leerLasPalabras, COMPLETAR],
  ['leerElCalculo', leerElCalculo, CALCULO],
] as const)('%s', (_nombre, leer, valida) => {
  it('lee la sesion que manda el servidor', () => {
    expect(leer(valida)).not.toBeNull();
  });

  it.each(SIN_NADA.map((valor) => [JSON.stringify(valor) ?? 'undefined', valor]))(
    'ante %s no la entiende y devuelve null',
    (_caso, valor) => {
      expect(leer(valor)).toBeNull();
    },
  );

  it('tolera campos de mas y no devuelve la referencia que recibio', () => {
    const conDeMas = { ...valida, algoNuevoDelServidor: { x: 1 } };
    const leida = leer(conDeMas);

    expect(leida).not.toBeNull();
    expect(leida).not.toBe(conDeMas);
    expect(leida).not.toHaveProperty('algoNuevoDelServidor');
  });
});

describe('leerFlujo', () => {
  it('rechaza ir mas rapido que un estimulo por segundo (R10: nada de destellos)', () => {
    expect(leerFlujo({ ...FLUJO, msPorEstimulo: 999 })).toBeNull();
    expect(leerFlujo({ ...FLUJO, msPorEstimulo: 1000 })).not.toBeNull();
    expect(leerFlujo({ ...FLUJO, msPorEstimulo: 3001 })).toBeNull();
  });

  it('rechaza una secuencia con un simbolo que no esta entre los de la sesion', () => {
    expect(
      leerFlujo({ ...FLUJO, secuencia: [...FLUJO.secuencia.slice(0, 11), 'fantasma'] }),
    ).toBeNull();
  });

  it('rechaza claves repetidas entre objetivos y otros', () => {
    expect(
      leerFlujo({
        ...FLUJO,
        otros: [...FLUJO.otros, { clave: 'sol', nombre: 'el sol otra vez', pictograma: 'sol' }],
      }),
    ).toBeNull();
  });

  it('rechaza una secuencia demasiado corta o un modo ajeno', () => {
    expect(leerFlujo({ ...FLUJO, secuencia: FLUJO.secuencia.slice(0, 9) })).toBeNull();
    expect(leerFlujo({ ...FLUJO, modo: 'puntos' })).toBeNull();
  });
});

describe('leerPuntos', () => {
  it('rechaza etiquetas repetidas (aunque cambien en mayusculas) y posiciones fuera del tablero', () => {
    const [primero, ...resto] = PUNTOS.puntos;

    expect(
      leerPuntos({
        ...PUNTOS,
        puntos: [primero, { ...resto[0], etiqueta: '1' }, ...resto.slice(1)],
      }),
    ).toBeNull();
    expect(leerPuntos({ ...PUNTOS, puntos: [{ ...primero, x: 4 }, ...resto] })).toBeNull();
    expect(leerPuntos({ ...PUNTOS, puntos: [{ ...primero, y: 96 }, ...resto] })).toBeNull();
  });

  it('pide entre cinco y veinte puntos', () => {
    expect(leerPuntos({ ...PUNTOS, puntos: PUNTOS.puntos.slice(0, 4) })).toBeNull();
  });
});

describe('leerLaLista', () => {
  it('rechaza una clave que esta a la vez en la lista y entre los distractores', () => {
    expect(
      leerLaLista({
        ...LISTA,
        distractores: [{ clave: 'papa', nombre: 'papa' }, ...LISTA.distractores],
      }),
    ).toBeNull();
  });

  it('pide entre 5 y 30 segundos a la vista', () => {
    expect(leerLaLista({ ...LISTA, segundosVista: 4 })).toBeNull();
    expect(leerLaLista({ ...LISTA, segundosVista: 31 })).toBeNull();
  });
});

describe('leerLaEscena', () => {
  it('rechaza dos figuras en el mismo lugar', () => {
    const [primera, segunda, ...resto] = ESCENA.celdas;

    expect(
      leerLaEscena({ ...ESCENA, celdas: [primera, { ...segunda, fila: 1, columna: 1 }, ...resto] }),
    ).toBeNull();
  });

  it('rechaza una pregunta por un lugar vacio', () => {
    expect(
      leerLaEscena({
        ...ESCENA,
        celdas: ESCENA.celdas.slice(0, 3),
      }),
    ).toBeNull();
  });

  it('rechaza una opcion correcta que no existe', () => {
    const [primera, ...resto] = ESCENA.preguntas;

    expect(
      leerLaEscena({ ...ESCENA, preguntas: [{ ...primera, correcta: 3 }, ...resto] }),
    ).toBeNull();
  });
});

describe('leerIntruso', () => {
  it('rechaza una ronda con palabras repetidas o con un intruso que no es una de las cuatro', () => {
    const [primera, ...resto] = INTRUSO.rondas;

    expect(
      leerIntruso({
        ...INTRUSO,
        rondas: [{ ...primera, palabras: ['mesa', 'Mesa', 'gato', 'perro'] }, ...resto],
      }),
    ).toBeNull();
    expect(leerIntruso({ ...INTRUSO, rondas: [{ ...primera, intruso: 4 }, ...resto] })).toBeNull();
  });

  it('pide exactamente cuatro palabras por ronda', () => {
    const [primera, ...resto] = INTRUSO.rondas;

    expect(
      leerIntruso({
        ...INTRUSO,
        rondas: [{ ...primera, palabras: ['mesa', 'caballo', 'gato'] }, ...resto],
      }),
    ).toBeNull();
  });
});

describe('leerLasCestas', () => {
  it('con cesta correcta se puntua, y una tarjeta ambigua tiene varias cestas', () => {
    const leidas = leerLasCestas(CESTAS);

    expect(leidas?.puntosMaximos).toBe(4);
    expect(leidas?.elementos.map((elemento) => elemento.sitios)).toEqual([
      ['frutas'],
      ['verduras'],
      ['frutas', 'verduras'],
      ['frutas'],
    ]);
  });

  it('sin cesta correcta es una reflexion: no se puntua, y trae su linea y su cierre', () => {
    const leidas = leerLasCestas(CESTAS_DE_REFLEXION);

    expect(leidas).not.toBeNull();
    expect(leidas).not.toHaveProperty('puntosMaximos');
    expect(leidas?.elementos.every((elemento) => elemento.sitios.length === 0)).toBe(true);
    expect(leidas?.linea).toEqual({
      invitacion: '¿Qué harías con lo que sí controlas?',
      largoMaximo: 200,
    });
    expect(leidas?.cierre).toBe('Separarlo ya ordena un poco. Gracias.');
  });

  it('rechaza mezclar tarjetas con cesta y sin ella', () => {
    const [primera, ...resto] = CESTAS.elementos;

    expect(
      leerLasCestas({
        ...CESTAS,
        elementos: [{ clave: primera?.clave, nombre: primera?.nombre }, ...resto],
      }),
    ).toBeNull();
  });

  it('rechaza puntos sin cesta correcta, o cesta correcta sin puntos', () => {
    expect(leerLasCestas({ ...CESTAS_DE_REFLEXION, puntosMaximos: 4 })).toBeNull();

    const { puntosMaximos: _quitado, ...sinPuntos } = CESTAS;

    expect(leerLasCestas(sinPuntos)).toBeNull();
  });

  it('rechaza una tarjeta cuya cesta no existe', () => {
    const [primera, ...resto] = CESTAS.elementos;

    expect(
      leerLasCestas({ ...CESTAS, elementos: [{ ...primera, cesta: 'dulces' }, ...resto] }),
    ).toBeNull();
  });

  it('rechaza una linea con un largo fuera de 50 a 500, y un cierre que no es texto', () => {
    expect(
      leerLasCestas({ ...CESTAS_DE_REFLEXION, linea: { invitacion: 'Algo', largoMaximo: 20 } }),
    ).toBeNull();
    expect(leerLasCestas({ ...CESTAS_DE_REFLEXION, cierre: 7 })).toBeNull();
  });

  it('rechaza claves repetidas entre las tarjetas', () => {
    const [primera, ...resto] = CESTAS.elementos;

    expect(
      leerLasCestas({
        ...CESTAS,
        elementos: [primera, { ...resto[0], clave: 'pera' }, ...resto.slice(1)],
      }),
    ).toBeNull();
  });
});

describe('leerLasPalabras', () => {
  it('lee los dos modos', () => {
    expect(leerLasPalabras(COMPLETAR)?.modo).toBe('completar');
    expect(leerLasPalabras(ANAGRAMA)?.modo).toBe('anagrama');
  });

  it('rechaza un modo ajeno', () => {
    expect(leerLasPalabras({ ...COMPLETAR, modo: 'flujo' })).toBeNull();
  });

  it('en completar rechaza posiciones fuera de la palabra o repetidas', () => {
    const [primera, ...resto] = COMPLETAR.palabras;

    expect(
      leerLasPalabras({ ...COMPLETAR, palabras: [{ ...primera, faltan: [7] }, ...resto] }),
    ).toBeNull();
    expect(
      leerLasPalabras({ ...COMPLETAR, palabras: [{ ...primera, faltan: [2, 2] }, ...resto] }),
    ).toBeNull();
    expect(
      leerLasPalabras({ ...COMPLETAR, palabras: [{ ...primera, faltan: [] }, ...resto] }),
    ).toBeNull();
  });

  it('en anagrama rechaza unas letras revueltas de otro largo', () => {
    const [primera, ...resto] = ANAGRAMA.palabras;

    expect(
      leerLasPalabras({ ...ANAGRAMA, palabras: [{ ...primera, revuelta: 'tag' }, ...resto] }),
    ).toBeNull();
  });

  it('rechaza una palabra con algo que no es una letra', () => {
    const [primera, ...resto] = COMPLETAR.palabras;

    expect(
      leerLasPalabras({ ...COMPLETAR, palabras: [{ ...primera, palabra: 'man zana' }, ...resto] }),
    ).toBeNull();
    expect(
      leerLasPalabras({ ...COMPLETAR, palabras: [{ ...primera, palabra: 'mand4rina' }, ...resto] }),
    ).toBeNull();
  });

  it('acepta la enie y las tildes como letras', () => {
    expect(leerLasPalabras(ANAGRAMA)?.palabras[2]?.palabra).toBe('año');
    expect(leerLasPalabras(COMPLETAR)?.palabras[1]?.palabra).toBe('árbol');
  });
});

describe('leerElCalculo', () => {
  it('rechaza opciones repetidas, una correcta que no es de las tres o menos de tres opciones', () => {
    const [primera, ...resto] = CALCULO.rondas;

    expect(
      leerElCalculo({
        ...CALCULO,
        rondas: [{ ...primera, opciones: ['17', '17', '21'] }, ...resto],
      }),
    ).toBeNull();
    expect(
      leerElCalculo({ ...CALCULO, rondas: [{ ...primera, correcta: 3 }, ...resto] }),
    ).toBeNull();
    expect(
      leerElCalculo({ ...CALCULO, rondas: [{ ...primera, opciones: ['17', '19'] }, ...resto] }),
    ).toBeNull();
  });
});
