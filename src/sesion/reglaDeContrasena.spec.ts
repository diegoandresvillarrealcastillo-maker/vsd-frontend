import { describe, expect, it } from 'vitest';

import { evaluarContrasena, mensajeSiNoCumple } from './reglaDeContrasena.ts';

describe('evaluarContrasena', () => {
  it('no da nada por cumplido a una contrasena vacia', () => {
    const evaluacion = evaluarContrasena('');

    expect(evaluacion.cumplidos).toBe(0);
    expect(evaluacion.valida).toBe(false);
    expect(evaluacion.nivel).toBe(0);
  });

  it.each([
    ['Abcdef1!', true],
    ['abcdef1!', false], // sin mayuscula
    ['ABCDEF1!', false], // sin minuscula
    ['Abcdefg!', false], // sin numero
    ['Abcdefg1', false], // sin simbolo
    ['Abc1!', false], // corta
  ])('%s -> valida: %s', (contrasena, valida) => {
    expect(evaluarContrasena(contrasena).valida).toBe(valida);
  });

  it('acepta cualquier simbolo que reconozca Supabase, no solo @$!%*?&', () => {
    for (const simbolo of ['#', '_', '.', '-', '+', '=', '(', ')', '[', ']', '{', '}', '~', '/']) {
      expect(evaluarContrasena(`Abcdef1${simbolo}`).valida, simbolo).toBe(true);
    }
  });

  it('no cuenta como simbolo lo que Supabase no reconoce', () => {
    // Pasaria aqui y la rechazaria el servidor, que es peor que decirlo antes.
    for (const caracter of ['ñ', '€', '¿', 'á', ' ']) {
      expect(evaluarContrasena(`Abcdef1${caracter}`).valida, caracter).toBe(false);
    }
  });

  it('cuenta los caracteres como los ve la persona', () => {
    // Siete caracteres, uno de ellos un emoji que ocupa dos unidades en UTF-16:
    // son siete, no ocho.
    expect(evaluarContrasena('Abcde1😀').requisitos[0]?.cumple).toBe(false);
    expect(evaluarContrasena('Abcde1😀!').requisitos[0]?.cumple).toBe(true);
  });

  it('sube el nivel con lo que se cumple, y distingue la fuerte por su longitud', () => {
    expect(evaluarContrasena('a').nivel).toBe(1);
    expect(evaluarContrasena('abcdefgh').nivel).toBe(1); // dos requisitos
    expect(evaluarContrasena('Abcdefgh').nivel).toBe(2); // tres
    expect(evaluarContrasena('Abcdefg1').nivel).toBe(2); // cuatro
    expect(evaluarContrasena('Abcdef1!').nivel).toBe(3); // los cinco, 8 caracteres
    expect(evaluarContrasena('Abcdefghij1!').nivel).toBe(4); // los cinco, 12
  });

  it('nombra cada nivel', () => {
    expect(evaluarContrasena('').etiqueta).toBe('Escribe tu contraseña');
    expect(evaluarContrasena('a').etiqueta).toBe('Débil');
    expect(evaluarContrasena('Abcdefgh').etiqueta).toBe('Regular');
    expect(evaluarContrasena('Abcdef1!').etiqueta).toBe('Buena');
    expect(evaluarContrasena('Abcdefghij1!').etiqueta).toBe('Fuerte');
  });
});

describe('mensajeSiNoCumple', () => {
  it('devuelve null cuando cumple', () => {
    expect(mensajeSiNoCumple('Abcdef1!')).toBeNull();
  });

  it('nombra solo lo que falta, unido en espanol', () => {
    expect(mensajeSiNoCumple('abcdefgh')).toBe(
      'La contraseña necesita una mayúscula, un número y un símbolo.',
    );
    expect(mensajeSiNoCumple('Abcdefg1')).toBe('La contraseña necesita un símbolo.');
    expect(mensajeSiNoCumple('Ab1!')).toBe('La contraseña necesita al menos 8 caracteres.');
  });

  it('lo pide todo a una contrasena vacia', () => {
    expect(mensajeSiNoCumple('')).toBe(
      'La contraseña necesita al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
    );
  });
});
