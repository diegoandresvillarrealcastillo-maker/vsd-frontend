import { describe, expect, it } from 'vitest';

import { ACLARACION_DEL_SOPORTE, CORREO_DE_SOPORTE, EQUIPO } from './equipo.ts';

/**
 * El equipo y su canal formal de soporte tecnico.
 */
describe('el equipo de VSD Health', () => {
  it('son dos personas, con su nombre y su rol', () => {
    expect(EQUIPO.map((persona) => persona.nombreCorto)).toEqual(['Diego', 'Samuel']);
    expect(EQUIPO.every((persona) => persona.rol !== '')).toBe(true);
  });

  it('usa el correo corporativo y lo separa de las lineas de ayuda', () => {
    expect(CORREO_DE_SOPORTE).toBe('vsdcompany69@gmail.com');
    expect(ACLARACION_DEL_SOPORTE).toMatch(/solo para problemas técnicos/u);
    expect(ACLARACION_DEL_SOPORTE).toMatch(/no es una línea de ayuda/u);
  });
});
