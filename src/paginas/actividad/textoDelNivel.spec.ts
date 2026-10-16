import { describe, expect, it } from 'vitest';

import { textoDelNivel } from './textoDelNivel.ts';

/**
 * El texto de cada nivel (SCRUM-94) y, desde SCRUM-200, **si el apoyo sale o no**.
 *
 * Un solo resultado que requiere atencion no es una semana dificil: el servidor lo registra con su
 * nivel pero no sugiere acompanar (`sugiereAcompanamiento: false`). Lo que la persona lee entonces
 * tiene que ser neutro. El texto que habla de atencion queda para cuando hay un patron.
 */
describe('textoDelNivel (SCRUM-200)', () => {
  it.each([true, false])('favorable dice lo mismo, sugiera o no acompanar (%s)', (acompanar) => {
    expect(textoDelNivel('favorable', acompanar)).toBe('Vas bien. Sigue así.');
  });

  it.each([true, false])(
    'en seguimiento dice lo mismo, sugiera o no acompanar (%s)',
    (acompanar) => {
      expect(textoDelNivel('en_seguimiento', acompanar)).toBe(
        'Va razonable, con margen para mejorar.',
      );
    },
  );

  it('requiere atencion CON patron conserva el texto de atencion', () => {
    expect(textoDelNivel('requiere_atencion', true)).toBe(
      'Conviene prestarle atención estos días.',
    );
  });

  it('requiere atencion SIN patron es neutro: registra y no valora', () => {
    const texto = textoDelNivel('requiere_atencion', false);

    expect(texto).toBe('Quedó registrado. Un día es solo un día.');
    expect(texto).not.toMatch(/atenci[oó]n|conviene|mal|pasando|dif[ií]cil|preocup/i);
  });

  it('el texto neutro no nombra una condicion ni suena a diagnostico', () => {
    const texto = textoDelNivel('requiere_atencion', false);

    expect(texto).not.toMatch(/ansiedad|depresi[oó]n|trastorno|diagn[oó]stico|s[ií]ntoma/i);
  });
});
