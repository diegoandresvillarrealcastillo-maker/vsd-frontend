import { describe, expect, it } from 'vitest';

import { ANCLA, AUTOMATICA, ESTIRAMIENTO, RESPIRO } from '../../../pruebas/sesionesDeBienestar.ts';
import { leerLosPasos } from './parametrosDeLaGuia.ts';

/**
 * Lo que la pantalla lee de `sesion.parametros` en una guia de pasos (SCRUM-226): devuelve `null` ante una forma
 * que no entiende, tolera lo que sobra y devuelve copias. Repite los limites del contrato del dominio.
 */
describe.each([
  ['estiramiento', ESTIRAMIENTO],
  ['ancla', ANCLA],
  ['respiro con elecciones', RESPIRO],
  ['automatica', AUTOMATICA],
] as const)('leerLosPasos: %s', (_nombre, valida) => {
  it('lee la sesion que manda el servidor', () => {
    expect(leerLosPasos(valida)).not.toBeNull();
  });

  it('tolera campos de mas y no devuelve la referencia que recibio', () => {
    const conDeMas = { ...valida, algoNuevo: { x: 1 } };
    const leida = leerLosPasos(conDeMas);

    expect(leida).not.toBeNull();
    expect(leida).not.toBe(conDeMas);
    expect(leida).not.toHaveProperty('algoNuevo');
  });

  it.each([undefined, null, 'texto', 7, [], {}])(
    'ante %j no la entiende y devuelve null',
    (valor) => {
      expect(leerLosPasos(valor)).toBeNull();
    },
  );
});

describe('leerLosPasos', () => {
  it('lee los textos, la figura y los pasos tal cual, con lo opcional solo si esta', () => {
    const leida = leerLosPasos(ESTIRAMIENTO);

    expect(leida?.avance).toBe('manual');
    expect(leida?.advertenciaInicial).toBe('Hazlo sin dolor: si algo duele, para.');
    expect(leida?.pasos?.map((paso) => paso.pictograma)).toEqual([
      'cuello:inclinar-der',
      'cuello:inclinar-izq',
      'cuello:soltar',
    ]);
    expect(leida?.pasos?.[2]).not.toHaveProperty('titulo');
    expect(leida).not.toHaveProperty('elecciones');
    expect(leida?.conLineasDeAyuda).toBe(false);
    expect(leida?.haptico).toBe(false);
  });

  it('el ancla trae sus lineas de atencion y la frase que las acompana', () => {
    const leida = leerLosPasos(ANCLA);

    expect(leida?.conLineasDeAyuda).toBe(true);
    expect(leida?.avisoSiempre).toBe('Si lo necesitas, hay personas que pueden acompañarte.');
  });

  it('con elecciones lee cada recorrido y no trae pasos sueltos', () => {
    const leida = leerLosPasos(RESPIRO);

    expect(leida?.elecciones?.map((una) => una.clave)).toEqual(['lejos', 'ventana']);
    expect(leida?.elecciones?.[0]?.descripcion).toBe('Descansar la vista mirando hacia lo lejano.');
    expect(leida?.elecciones?.[1]).not.toHaveProperty('descripcion');
    expect(leida).not.toHaveProperty('pasos');
  });

  it('rechaza un modo ajeno o un avance que no es manual ni auto', () => {
    expect(leerLosPasos({ ...ESTIRAMIENTO, modo: 'respiracion' })).toBeNull();
    expect(leerLosPasos({ ...ESTIRAMIENTO, avance: 'rapido' })).toBeNull();
    expect(leerLosPasos({ ...ESTIRAMIENTO, avance: undefined })).toBeNull();
  });

  it('rechaza pasos y elecciones juntos, o ninguno', () => {
    expect(leerLosPasos({ ...ESTIRAMIENTO, elecciones: RESPIRO.elecciones })).toBeNull();

    const { pasos: _quitados, ...sinNada } = ESTIRAMIENTO;

    expect(leerLosPasos(sinNada)).toBeNull();
  });

  it('pide de 2 a 12 pasos, y de 2 a 4 elecciones', () => {
    expect(leerLosPasos({ ...ESTIRAMIENTO, pasos: ESTIRAMIENTO.pasos.slice(0, 1) })).toBeNull();
    expect(
      leerLosPasos({
        ...ESTIRAMIENTO,
        pasos: Array.from({ length: 13 }, (_, i) => ({ texto: `Paso ${String(i)}` })),
      }),
    ).toBeNull();
    expect(leerLosPasos({ ...RESPIRO, elecciones: RESPIRO.elecciones.slice(0, 1) })).toBeNull();
    expect(
      leerLosPasos({
        ...RESPIRO,
        elecciones: Array.from({ length: 5 }, (_, i) => ({
          ...RESPIRO.elecciones[0],
          clave: `c${String(i)}`,
        })),
      }),
    ).toBeNull();
  });

  it('rechaza un paso sin texto, o una eleccion sin nombre ni clave', () => {
    const [primero, ...resto] = ESTIRAMIENTO.pasos;

    expect(
      leerLosPasos({ ...ESTIRAMIENTO, pasos: [{ ...primero, texto: ' ' }, ...resto] }),
    ).toBeNull();

    const [una, ...otras] = RESPIRO.elecciones;

    expect(leerLosPasos({ ...RESPIRO, elecciones: [{ ...una, nombre: '' }, ...otras] })).toBeNull();
    expect(
      leerLosPasos({ ...RESPIRO, elecciones: [{ ...una, clave: undefined }, ...otras] }),
    ).toBeNull();
  });

  it('rechaza dos elecciones con la misma clave', () => {
    const [una, otra] = RESPIRO.elecciones;

    expect(leerLosPasos({ ...RESPIRO, elecciones: [una, { ...otra, clave: 'lejos' }] })).toBeNull();
  });

  it('con avance automatico exige los segundos de cada paso, entre 5 y 180', () => {
    const [primero, ...resto] = AUTOMATICA.pasos;

    expect(
      leerLosPasos({ ...AUTOMATICA, pasos: [{ titulo: 'Primero', texto: 'Suelta.' }, ...resto] }),
    ).toBeNull();
    expect(
      leerLosPasos({ ...AUTOMATICA, pasos: [{ ...primero, segundos: 4 }, ...resto] }),
    ).toBeNull();
    expect(
      leerLosPasos({ ...AUTOMATICA, pasos: [{ ...primero, segundos: 181 }, ...resto] }),
    ).toBeNull();
    expect(
      leerLosPasos({ ...AUTOMATICA, pasos: [{ ...primero, segundos: 5 }, ...resto] }),
    ).not.toBeNull();
  });

  it('con avance automatico y elecciones tambien exige los segundos en cada recorrido', () => {
    expect(leerLosPasos({ ...RESPIRO, avance: 'auto' })).toBeNull();
  });

  it('las lineas de atencion piden su frase', () => {
    const { avisoSiempre: _quitado, ...sinAviso } = ANCLA;

    expect(leerLosPasos(sinAviso)).toBeNull();
    expect(leerLosPasos({ ...ESTIRAMIENTO, conLineasDeAyuda: 'si' })).toBeNull();
  });

  it('rechaza textos opcionales que no son texto', () => {
    expect(leerLosPasos({ ...ESTIRAMIENTO, cierre: 7 })).toBeNull();
    expect(leerLosPasos({ ...ESTIRAMIENTO, intro: '' })).toBeNull();
    expect(leerLosPasos({ ...ESTIRAMIENTO, advertenciaInicial: false })).toBeNull();
  });

  it('el haptico es un si o un no', () => {
    expect(leerLosPasos({ ...ESTIRAMIENTO, haptico: true })?.haptico).toBe(true);
    expect(leerLosPasos({ ...ESTIRAMIENTO, haptico: 'si' })).toBeNull();
  });
});
