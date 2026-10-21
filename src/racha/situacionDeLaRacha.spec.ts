import { describe, expect, it } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { HORA_DE_LA_TARDE, situacionDeLaRacha } from './situacionDeLaRacha.ts';

/**
 * Que le dice la mascota a la persona segun su racha y la hora (SCRUM-243).
 *
 * El riesgo —«en juego», «sin gastar un congelamiento»— solo sale cuando de verdad aplica: hoy sin
 * hacer, ya de tarde, con una racha que vale la pena (3 dias o mas) y segun queden o no congelamientos.
 */
describe('situacionDeLaRacha', () => {
  it('la tarde empieza a las 18:00', () => {
    expect(HORA_DE_LA_TARDE).toBe(18);
  });

  it('con la llama en descanso, es regreso', () => {
    const racha = rachaDePrueba({ dias: 0, hechoHoy: false, enDescanso: true, nivel: 0 });

    expect(situacionDeLaRacha(racha, 10)).toBe('regreso');
    expect(situacionDeLaRacha(racha, 21)).toBe('regreso');
  });

  describe('hoy ya sumo', () => {
    it('lejos del proximo hito es un dia normal', () => {
      expect(situacionDeLaRacha(rachaDePrueba({ dias: 20 }), 10)).toBe('diaNormal');
    });

    it.each([1, 2, 3])('a %i dias del proximo hito, esta cerca', (faltan) => {
      expect(situacionDeLaRacha(rachaDePrueba({ dias: 14 - faltan }), 10)).toBe('cercaDelHito');
    });

    it('a cuatro dias del hito todavia no esta cerca', () => {
      expect(situacionDeLaRacha(rachaDePrueba({ dias: 10 }), 10)).toBe('diaNormal');
    });

    it('nunca habla de riesgo, ni de tarde ni sin congelamientos', () => {
      const racha = rachaDePrueba({
        dias: 20,
        congelamientosUsados: 3,
        congelamientosDisponibles: 0,
      });

      expect(situacionDeLaRacha(racha, 21)).toBe('diaNormal');
    });

    it('sin proximo hito (un servidor viejo) es un dia normal', () => {
      expect(
        situacionDeLaRacha(rachaDePrueba({ dias: 12, proximoHito: 0, escalera: [] }), 10),
      ).toBe('diaNormal');
    });
  });

  describe('hoy todavia sin hacer', () => {
    const sinHacer = (cambios: Parameters<typeof rachaDePrueba>[0] = {}) =>
      rachaDePrueba({ hechoHoy: false, ...cambios });

    it('por la manana no hay riesgo: es un dia normal', () => {
      expect(situacionDeLaRacha(sinHacer({ dias: 20 }), 9)).toBe('diaNormal');
      expect(situacionDeLaRacha(sinHacer({ dias: 20 }), 17)).toBe('diaNormal');
    });

    it('de tarde y con congelamientos, una actividad evita gastar uno', () => {
      expect(situacionDeLaRacha(sinHacer({ dias: 20 }), 18)).toBe('riesgoConCongelamientos');
      expect(situacionDeLaRacha(sinHacer({ dias: 20 }), 23)).toBe('riesgoConCongelamientos');
    });

    it('de tarde y sin congelamientos, la racha esta en juego', () => {
      const racha = sinHacer({ dias: 20, congelamientosUsados: 3, congelamientosDisponibles: 0 });

      expect(situacionDeLaRacha(racha, 20)).toBe('riesgoSinCongelamientos');
    });

    it('una racha de menos de 3 dias no tiene riesgo que decir: anima con el primer hito', () => {
      // A 2 dias, el primer hito (3 dias) esta a uno.
      expect(situacionDeLaRacha(sinHacer({ dias: 2 }), 20)).toBe('cercaDelHito');
      expect(situacionDeLaRacha(sinHacer({ dias: 2, congelamientosDisponibles: 0 }), 20)).toBe(
        'cercaDelHito',
      );
      expect(situacionDeLaRacha(sinHacer({ dias: 1 }), 20)).not.toMatch(/riesgo/);
    });

    it('de tarde y cerca de un hito, el riesgo manda sobre el hito', () => {
      expect(situacionDeLaRacha(sinHacer({ dias: 13 }), 20)).toBe('riesgoConCongelamientos');
    });

    it('por la manana y cerca de un hito, anima con el hito', () => {
      expect(situacionDeLaRacha(sinHacer({ dias: 13 }), 9)).toBe('cercaDelHito');
    });
  });
});
