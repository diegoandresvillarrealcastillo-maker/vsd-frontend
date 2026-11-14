import { describe, expect, it } from 'vitest';

import {
  ACIERTO,
  ACOMPANAN,
  AL_ELEGIR,
  ANIMO_TRAS_CASI,
  CASI,
  CASI_AL_FINAL,
  EN_EL_JUEGO,
  elegir,
  INICIO,
  LISTO_PARA_TERMINAR,
  mensajeAlElegir,
  mensajeDelPaso,
} from './mensajes.ts';

/**
 * Lo que dice la mascota se vigila como se vigila cualquier otro texto de una actividad de
 * bienestar: sin lenguaje clinico, sin valorar lo que la persona contesta y sin culpa.
 */

/** Las frases que se dicen en cuestionarios y bitacoras, donde no hay respuestas buenas ni malas. */
const PARA_CUESTIONARIOS: readonly string[] = [
  ...INICIO,
  ...ACOMPANAN,
  ...AL_ELEGIR,
  ...CASI_AL_FINAL,
  ...LISTO_PARA_TERMINAR,
];

/** Las de los juegos, donde si hay una respuesta correcta. */
const PARA_JUEGOS: readonly string[] = [...ACIERTO, ...CASI, ...ANIMO_TRAS_CASI, ...EN_EL_JUEGO];

const CLINICO =
  /ansiedad|ansios|depresi|deprimid|trastorno|diagn[oó]stic|s[ií]ntoma|patolog|enfermedad|suicid|p[aá]nico|estr[eé]s/i;

// Celebrar o calificar lo contestado: en un cuestionario no hay respuesta buena ni mala.
const VALORA = /muy bien|genial|excelente|perfecto el|bravo|felicit|lo lograste|correct|incorrect/i;

describe('Las frases de la mascota', () => {
  it.each([...PARA_CUESTIONARIOS, ...PARA_JUEGOS])('no suena clinica: %s', (frase) => {
    expect(frase).not.toMatch(CLINICO);
  });

  it.each(PARA_CUESTIONARIOS)('en un cuestionario no valora lo contestado: %s', (frase) => {
    expect(frase).not.toMatch(VALORA);
  });

  it('en los juegos, un «casi» nunca senala el fallo ni regana', () => {
    for (const frase of [...CASI, ...ANIMO_TRAS_CASI]) {
      expect(frase).not.toMatch(/mal|error|fallaste|equivoc|incorrect|perdiste/i);
    }
  });

  it('todas son cortas, para leerse de un vistazo', () => {
    for (const frase of [...PARA_CUESTIONARIOS, ...PARA_JUEGOS]) {
      expect(frase.length).toBeLessThanOrEqual(80);
    }
  });
});

describe('elegir', () => {
  it('da la frase de la posicion pedida y da la vuelta al llegar al final', () => {
    const frases = ['a', 'b', 'c'];

    expect(elegir(frases, 0)).toBe('a');
    expect(elegir(frases, 2)).toBe('c');
    expect(elegir(frases, 3)).toBe('a');
    expect(elegir(frases, 7)).toBe('b');
  });

  it('con posiciones negativas o con decimales tampoco se sale de la lista', () => {
    const frases = ['a', 'b', 'c'];

    expect(elegir(frases, -1)).toBe('c');
    expect(elegir(frases, 1.9)).toBe('b');
  });

  it('con una lista vacia devuelve un texto vacio', () => {
    expect(elegir([], 3)).toBe('');
  });

  it('no depende del azar: pedir lo mismo dos veces da lo mismo', () => {
    expect(elegir(ACOMPANAN, 4)).toBe(elegir(ACOMPANAN, 4));
  });
});

describe('mensajeDelPaso', () => {
  it('el primer paso da la bienvenida', () => {
    expect(INICIO).toContain(mensajeDelPaso(0, 5));
  });

  it('el penultimo avisa que falta poco y el ultimo, que es la ultima', () => {
    expect(mensajeDelPaso(3, 5)).toBe(CASI_AL_FINAL[0]);
    expect(mensajeDelPaso(4, 5)).toBe(CASI_AL_FINAL[1]);
  });

  it('los de en medio agradecen', () => {
    expect(ACOMPANAN).toContain(mensajeDelPaso(1, 5));
    expect(ACOMPANAN).toContain(mensajeDelPaso(2, 5));
  });

  it('con pocos pasos no avisa de un final que no existe', () => {
    expect(INICIO).toContain(mensajeDelPaso(0, 1));
    expect(mensajeDelPaso(1, 2)).not.toBe('');
  });

  it('no cambia segun lo que se contesto: solo recibe la posicion', () => {
    expect(mensajeDelPaso.length).toBe(2);
    expect(mensajeAlElegir.length).toBe(1);
  });
});

describe('mensajeAlElegir', () => {
  it('agradece, y da la vuelta con muchos pasos', () => {
    expect(AL_ELEGIR).toContain(mensajeAlElegir(0));
    expect(mensajeAlElegir(AL_ELEGIR.length)).toBe(mensajeAlElegir(0));
  });
});
