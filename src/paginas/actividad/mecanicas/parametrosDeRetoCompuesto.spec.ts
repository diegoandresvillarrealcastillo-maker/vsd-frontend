import { describe, expect, it } from 'vitest';
import { leerRetoCompuesto } from './parametrosDeRetoCompuesto.ts';

const VALIDO = {
  modo: 'reto_compuesto_cognitivo',
  fases: [
    {
      codigo: 'COG-02',
      idSesion: '5e510200-0000-4000-8000-000000000001',
      titulo: 'Intruso evidente',
      nivel: 1,
      maximo: 6,
      parametros: { modo: 'intruso', rondas: [] },
    },
    {
      codigo: 'COG-04',
      idSesion: '5e510400-0000-4000-8000-000000000001',
      titulo: 'Cuentas del mercado',
      nivel: 1,
      maximo: 8,
      parametros: { modo: 'calculo', rondas: [] },
    },
    {
      codigo: 'COG-09',
      idSesion: '5e510900-0000-4000-8000-000000000001',
      titulo: 'Escena de la casa',
      nivel: 1,
      maximo: 5,
      parametros: { modo: 'escena', rondas: [] },
    },
  ],
  puntosMaximos: 19,
};

describe('leerRetoCompuesto', () => {
  it('lee los juegos diferentes en el orden de la actividad', () => {
    expect(leerRetoCompuesto(VALIDO)?.fases.map((fase) => fase.codigo)).toEqual([
      'COG-02',
      'COG-04',
      'COG-09',
    ]);
  });

  it('rechaza una actividad que repite juego o no suma el puntaje esperado', () => {
    expect(
      leerRetoCompuesto({
        ...VALIDO,
        fases: [VALIDO.fases[0], { ...VALIDO.fases[0], idSesion: 'otro' }, VALIDO.fases[2]],
      }),
    ).toBeNull();
    expect(leerRetoCompuesto({ ...VALIDO, puntosMaximos: 20 })).toBeNull();
  });
});
