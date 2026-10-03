import { describe, expect, it } from 'vitest';

import {
  etapaPara,
  etapaSiguiente,
  etapasAnteriores,
  nombreDeEtapa,
  tramoDeHoy,
} from './etapas.ts';

describe('etapaPara', () => {
  // Los mismos casos que fija Sendero.spec.ts en el backend: si alli cambian
  // las etapas, aqui tiene que fallar algo.
  it.each([
    [0, 1, false, 0, 5],
    [4, 1, false, 4, 5],
    [5, 2, false, 0, 10],
    [14, 2, false, 9, 10],
    [15, 3, false, 0, 15],
    [30, 4, false, 0, 20],
    [49, 4, false, 19, 20],
    [50, 1, true, 0, 25],
    [74, 1, true, 24, 25],
    [75, 2, true, 0, 25],
  ])(
    'con %i sesiones va en la %i (temporada: %s), %i de %i',
    (sesiones, numero, esTemporada, hechas, total) => {
      expect(etapaPara(sesiones)).toEqual({
        numero,
        esTemporada,
        sesionesHechas: hechas,
        sesionesDeLaEtapa: total,
      });
    },
  );

  it('un numero negativo o con decimales no rompe nada', () => {
    expect(etapaPara(-3)).toEqual(etapaPara(0));
    expect(etapaPara(5.9)).toEqual(etapaPara(5));
  });
});

describe('etapaSiguiente y etapasAnteriores', () => {
  it('tras la etapa 4 vienen las temporadas', () => {
    expect(nombreDeEtapa(etapaSiguiente(etapaPara(30)))).toBe('Temporada 1');
    expect(nombreDeEtapa(etapaSiguiente(etapaPara(5)))).toBe('Etapa 3');
    expect(nombreDeEtapa(etapaSiguiente(etapaPara(60)))).toBe('Temporada 2');
  });

  it('lista las etapas completas en orden, con su duracion', () => {
    expect(etapasAnteriores(etapaPara(0))).toEqual([]);
    // Con 75 se esta empezando la temporada 2: la 1 ya quedo atras.
    expect(etapasAnteriores(etapaPara(75)).map(nombreDeEtapa)).toEqual([
      'Etapa 1',
      'Etapa 2',
      'Etapa 3',
      'Etapa 4',
      'Temporada 1',
    ]);
    expect(etapasAnteriores(etapaPara(15)).map((etapa) => etapa.sesionesDeLaEtapa)).toEqual([
      5, 10,
    ]);
  });
});

describe('tramoDeHoy', () => {
  it('sin nada hoy, hoy es el punto siguiente a lo hecho', () => {
    expect(tramoDeHoy(3, false)).toEqual({
      etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
      indiceDeHoy: 3,
      hoyCuenta: false,
      etapaCompletadaHoy: false,
    });
  });

  it('con algo hecho hoy, hoy ya cuenta y es el ultimo punto hecho', () => {
    expect(tramoDeHoy(4, true)).toMatchObject({
      etapa: { numero: 1, sesionesHechas: 4 },
      indiceDeHoy: 3,
      hoyCuenta: true,
    });
  });

  it('el dia que se completa una etapa se sigue viendo esa etapa, cerrada hoy', () => {
    // Para la API, con 5 sesiones ya va en la etapa 2. En el sendero, hoy es
    // la meta de la etapa 1.
    expect(tramoDeHoy(5, true)).toEqual({
      etapa: { numero: 1, esTemporada: false, sesionesHechas: 5, sesionesDeLaEtapa: 5 },
      indiceDeHoy: 4,
      hoyCuenta: true,
      etapaCompletadaHoy: true,
    });
  });

  it('al dia siguiente ya se esta en la etapa nueva', () => {
    expect(tramoDeHoy(5, false)).toMatchObject({
      etapa: { numero: 2, sesionesHechas: 0, sesionesDeLaEtapa: 10 },
      indiceDeHoy: 0,
    });
  });
});
