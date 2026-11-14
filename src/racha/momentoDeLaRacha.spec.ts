import { describe, expect, it } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { momentoDeLaRacha } from './momentoDeLaRacha.ts';

/**
 * Que se celebra al terminar una actividad (SCRUM-243).
 *
 * El cliente no cuenta dias: compara lo que se sabia con lo que acaba de decir el servidor. Solo hay
 * momento cuando **hoy sumo un dia** (la racha paso de «hoy sin hacer» a «hoy hecho»), y si en ese
 * salto se cruzo un hito, se celebra el mas alto.
 */

const ESCALERA_HASTA_7 = [
  { dias: 3, logrado: true },
  { dias: 7, logrado: true },
  { dias: 14, logrado: false },
  { dias: 30, logrado: false },
  { dias: 50, logrado: false },
];

const ESCALERA_HASTA_14 = [
  { dias: 3, logrado: true },
  { dias: 7, logrado: true },
  { dias: 14, logrado: true },
  { dias: 30, logrado: false },
  { dias: 50, logrado: false },
  { dias: 100, logrado: false },
];

describe('momentoDeLaRacha', () => {
  it('sin una racha anterior no se celebra: no se sabe si hoy ya habia sumado', () => {
    expect(momentoDeLaRacha(null, rachaDePrueba({ dias: 6, hechoHoy: true }))).toBeNull();
  });

  it('la segunda actividad del dia no celebra otra vez', () => {
    const antes = rachaDePrueba({ dias: 6, hechoHoy: true });

    expect(momentoDeLaRacha(antes, rachaDePrueba({ dias: 6, hechoHoy: true }))).toBeNull();
  });

  it('si despues de la actividad hoy sigue sin hacer, no hay nada que celebrar', () => {
    const antes = rachaDePrueba({ dias: 5, hechoHoy: false });

    expect(momentoDeLaRacha(antes, rachaDePrueba({ dias: 5, hechoHoy: false }))).toBeNull();
  });

  it('un dia mas de una racha que sigue es un dia normal', () => {
    const antes = rachaDePrueba({ dias: 5, hechoHoy: false });
    const ahora = rachaDePrueba({ dias: 6, hechoHoy: true });

    expect(momentoDeLaRacha(antes, ahora)).toEqual({ tipo: 'dia' });
  });

  it('llegar justo a un hito celebra ese hito', () => {
    const antes = rachaDePrueba({ dias: 6, hechoHoy: false });
    const ahora = rachaDePrueba({ dias: 7, hechoHoy: true, escalera: ESCALERA_HASTA_7 });

    expect(momentoDeLaRacha(antes, ahora)).toEqual({ tipo: 'hito', hito: 7 });
  });

  it('si una sincronizacion cruza varios hitos, se celebra solo el mas alto', () => {
    const antes = rachaDePrueba({ dias: 6, hechoHoy: false });
    const ahora = rachaDePrueba({ dias: 15, hechoHoy: true, escalera: ESCALERA_HASTA_14 });

    expect(momentoDeLaRacha(antes, ahora)).toEqual({ tipo: 'hito', hito: 14 });
  });

  it('un hito que ya estaba logrado antes no se celebra otra vez', () => {
    const antes = rachaDePrueba({ dias: 8, hechoHoy: false, escalera: ESCALERA_HASTA_7 });
    const ahora = rachaDePrueba({ dias: 9, hechoHoy: true, escalera: ESCALERA_HASTA_7 });

    expect(momentoDeLaRacha(antes, ahora)).toEqual({ tipo: 'dia' });
  });

  it('si la llama descansaba y hoy suma su primer dia, es un dia normal', () => {
    const antes = rachaDePrueba({ dias: 0, hechoHoy: false, enDescanso: true, nivel: 0 });
    const ahora = rachaDePrueba({ dias: 1, hechoHoy: true, nivel: 0 });

    expect(momentoDeLaRacha(antes, ahora)).toEqual({ tipo: 'dia' });
  });

  it('un servidor sin escalera solo celebra el dia, sin inventar un hito', () => {
    const antes = rachaDePrueba({ dias: 6, hechoHoy: false, escalera: [] });
    const ahora = rachaDePrueba({ dias: 7, hechoHoy: true, escalera: [], proximoHito: 0 });

    expect(momentoDeLaRacha(antes, ahora)).toEqual({ tipo: 'dia' });
  });
});
