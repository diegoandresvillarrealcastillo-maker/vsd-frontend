import { describe, expect, it } from 'vitest';

import { ALTO_DE_FILA, ALTO_DE_FILA_DE_HOY } from './geometria.ts';
import { DIAS_DEL_PLAN, filasDelMapa, planDelAnio } from './planDelAnio.ts';

describe('planDelAnio', () => {
  it('sin nada hecho, hoy es el dia 1', () => {
    expect(planDelAnio(0, false)).toEqual({
      vuelta: 1,
      indiceDeHoy: 0,
      hoyCuenta: false,
      diasHechos: 0,
    });
  });

  it('hoy es siempre el dia siguiente a los hechos, lo haya empezado o no', () => {
    expect(planDelAnio(3, false)).toMatchObject({ indiceDeHoy: 3, diasHechos: 3 });
    // Con algo hecho hoy, la API ya cuenta hoy entre las sesiones: hoy sigue siendo el mismo dia.
    expect(planDelAnio(4, true)).toMatchObject({ indiceDeHoy: 3, diasHechos: 4 });
  });

  it('en el ultimo dia del plan, hoy es el 365', () => {
    expect(planDelAnio(364, false)).toMatchObject({ vuelta: 1, indiceDeHoy: 364, diasHechos: 364 });
    expect(planDelAnio(365, true)).toMatchObject({ vuelta: 1, indiceDeHoy: 364, diasHechos: 365 });
  });

  it('al terminar los 365 dias el plan empieza otra vez, sin perder la cuenta', () => {
    expect(planDelAnio(365, false)).toMatchObject({ vuelta: 2, indiceDeHoy: 0, diasHechos: 0 });
    expect(planDelAnio(366, true)).toMatchObject({ vuelta: 2, indiceDeHoy: 0, diasHechos: 1 });
    expect(planDelAnio(800, false)).toMatchObject({ vuelta: 3, indiceDeHoy: 70 });
  });

  it('un numero imposible no rompe el mapa', () => {
    expect(planDelAnio(-4, false)).toMatchObject({ vuelta: 1, indiceDeHoy: 0 });
    expect(planDelAnio(2.9, false)).toMatchObject({ indiceDeHoy: 2 });
  });
});

describe('filasDelMapa', () => {
  const plan = planDelAnio(3, false);
  const { filas, alto, yDeHoy } = filasDelMapa(plan);

  it('tiene los 365 dias desde el primero, todos a la vista', () => {
    expect(filas).toHaveLength(DIAS_DEL_PLAN);
    expect(filas[0]?.indice).toBe(0);
    expect(filas.at(-1)?.indice).toBe(364);
  });

  it('marca como hechos los anteriores a hoy y deja el resto por hacer', () => {
    expect(filas.slice(0, 3).every((fila) => fila.hecha)).toBe(true);
    expect(filas[3]?.hecha).toBe(false);
    expect(filas.slice(4).some((fila) => fila.hecha)).toBe(false);
  });

  it('hoy cuenta como hecho cuando ya se hizo algo', () => {
    const conHoy = filasDelMapa(planDelAnio(4, true)).filas;

    expect(conHoy[3]?.hecha).toBe(true);
    expect(conHoy[4]?.hecha).toBe(false);
  });

  it('solo el ultimo dia es la meta', () => {
    expect(filas.filter((fila) => fila.meta).map((fila) => fila.indice)).toEqual([364]);
  });

  it('la fila de hoy es mas alta y el centro de cada una sale de las medidas', () => {
    const extra = ALTO_DE_FILA_DE_HOY - ALTO_DE_FILA;

    expect(filas[0]?.y).toBe(ALTO_DE_FILA / 2);
    expect(yDeHoy).toBe(3 * ALTO_DE_FILA + ALTO_DE_FILA_DE_HOY / 2);
    expect(filas[4]?.y).toBe(4 * ALTO_DE_FILA + extra + ALTO_DE_FILA / 2);
    expect(alto).toBe(DIAS_DEL_PLAN * ALTO_DE_FILA + extra);
  });

  it('une cada par de dias: llena entre dos hechos y punteada en lo que falta', () => {
    const { trazoHecho, trazoPendiente } = filasDelMapa(planDelAnio(3, false));

    // Tres dias hechos y hoy: los tres primeros tramos unen hechos; hoy no cuenta todavia.
    expect(trazoHecho.match(/M/g)).toHaveLength(2);
    expect(trazoPendiente.match(/M/g)).toHaveLength(DIAS_DEL_PLAN - 1 - 2);
  });
});
