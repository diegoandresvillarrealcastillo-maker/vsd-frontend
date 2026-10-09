import { describe, expect, it } from 'vitest';

import { textoDelAvance } from './textoDelAvance.ts';

describe('textoDelAvance', () => {
  it('sin plan invita a elegir un modulo', () => {
    expect(textoDelAvance(0, 0)).toBe('Elige un módulo para empezar tu plan de hoy.');
  });

  it('con nada hecho acompana y no apura', () => {
    const texto = textoDelAvance(0, 4);

    expect(texto).toContain('4 actividades');
    expect(texto).toContain('sin prisa');
  });

  it('a medias celebra lo hecho', () => {
    expect(textoDelAvance(2, 4)).toBe('¡Buen ritmo! 2 de 4 actividades de hoy.');
  });

  it('con todo hecho lo reconoce', () => {
    expect(textoDelAvance(4, 4)).toContain('¡Terminaste tu ruta de hoy!');
  });

  it('ningun texto reprocha ni presiona', () => {
    const todos = [textoDelAvance(0, 0), textoDelAvance(0, 4), textoDelAvance(2, 4)].join(' ');

    expect(todos).not.toMatch(/falt|no has|todavía no|perd|solo te|racha/i);
  });
});
