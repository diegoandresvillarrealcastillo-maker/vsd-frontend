import { describe, expect, it } from 'vitest';

import { DocumentoPdf } from './documentoPdf.ts';
import { sanearParaPdf } from './sanearParaPdf.ts';

/**
 * Lo que nunca puede pasar (SCRUM-191): que un caracter del diario tire abajo la exportacion
 * entera. El escritor de PDF solo conoce WinAnsi y un caracter que no este es un error; aqui se
 * comprueba que, despues de sanear, **no queda ninguno**, y que lo que si se podia escribir no se
 * toca.
 */
function nuevo() {
  return new DocumentoPdf({
    titulo: 't',
    idioma: 'es-CO',
    pie: () => ({ izquierda: '', derecha: '' }),
  });
}

describe('sanearParaPdf', () => {
  it('no toca lo que WinAnsi ya puede escribir', () => {
    const texto = 'Cómo estás, ñandú: «sí» ¿no? ¡claro! 5 × 5 · 20 °C – “hola” … ›';

    expect(sanearParaPdf(texto)).toBe(texto);
  });

  it('un emoji se dice como «[emoji]» y los seguidos son uno solo', () => {
    expect(sanearParaPdf('Hoy fue un buen día 😀😀 y salí a caminar 🌳')).toBe(
      'Hoy fue un buen día [emoji] y salí a caminar [emoji]',
    );
  });

  it('un emoji compuesto (con selector o unido por ZWJ) es uno solo', () => {
    expect(sanearParaPdf('amor ❤️ y familia 👨‍👩‍👧')).toBe('amor [emoji] y familia [emoji]');
  });

  it('una bandera cuenta como un emoji', () => {
    expect(sanearParaPdf('Colombia 🇨🇴')).toBe('Colombia [emoji]');
  });

  it('una letra con una marca que WinAnsi no tiene vuelve a su letra', () => {
    expect(sanearParaPdf('Erdős, Čapek, Ångström')).toBe('Erdos, Capek, Ångström');
  });

  it('los simbolos de uso comun se cambian por su equivalente en ASCII', () => {
    expect(sanearParaPdf('a → b ← c, 5 € ™')).toBe('a -> b <- c, 5 EUR (TM)');
  });

  it('lo que no tiene equivalente (otra escritura) se vuelve «?», una por caracter', () => {
    expect(sanearParaPdf('こんにちは')).toBe('?????');
  });

  it('quita los caracteres de control y los invisibles, y los espacios raros son espacios', () => {
    // Sin escribir los invisibles a mano: con su codigo, para que se vean en el codigo.
    const invisibles = ['\u0000', '\u{200b}', '\xad', '\u{feff}'];

    expect(
      sanearParaPdf(['a', 'b', 'c', 'm', 'n'].map((c, k) => c + (invisibles[k] ?? '')).join('')),
    ).toBe('abcmn');
    expect(sanearParaPdf('uno\ttres\r\ncuatro\xa0cinco\u{202f}seis')).toBe(
      'uno tres cuatro cinco seis',
    );
  });

  it('un sustituto suelto (UTF-16 roto) no tira nada abajo', () => {
    expect(sanearParaPdf('mitad \ud83d fin')).toBe('mitad ? fin');
  });

  it('todo lo que sale se puede escribir: ningun caracter del plano basico ni de los emoji queda fuera', () => {
    // Los 65 536 del plano basico (con los sustitutos sueltos), en trozos: si uno solo se
    // escapara, el escritor lanzaria un error y la prueba lo diria.
    const documento = nuevo();

    for (let desde = 0; desde < 0x10000; desde += 4096) {
      let trozo = '';

      for (let codigo = desde; codigo < desde + 4096; codigo += 1) {
        trozo += String.fromCharCode(codigo);
      }

      expect(() => documento.texto([{ texto: sanearParaPdf(trozo) }])).not.toThrow();
    }

    let astral = '';

    for (let codigo = 0x1f000; codigo < 0x20000; codigo += 1) {
      astral += String.fromCodePoint(codigo);
    }

    expect(() => documento.texto([{ texto: sanearParaPdf(astral) }])).not.toThrow();
    // eslint-disable-next-line no-control-regex
    expect(documento.generar()).toMatch(/^[\x09\x0a\x0d\x20-\x7e]*$/);
  });

  it('es idempotente: sanear lo ya saneado no cambia nada', () => {
    const una = sanearParaPdf('Hola 😀 → mundo ő');

    expect(sanearParaPdf(una)).toBe(una);
  });
});

describe('DocumentoPdf con saneador', () => {
  function conSaneador(saneador?: (texto: string) => string) {
    return new DocumentoPdf({
      titulo: 'Tus datos 😀',
      asunto: 'a → b',
      idioma: 'es-CO',
      pie: () => ({ izquierda: 'pie 😀', derecha: 'pagina →' }),
      ...(saneador === undefined ? {} : { saneador }),
    });
  }

  function escribirDeTodo(documento: DocumentoPdf) {
    documento.banda({ titulo: 'VSD 😀', subtitulo: 'Tus datos →', fondo: [0.2, 0.4, 0.4] });
    documento.texto([{ texto: 'hola 😀' }]);
    documento.caja([{ texto: 'nota → 😀' }], { fondo: [0.9, 0.9, 0.9] });
    documento.tabla([{ titulo: 'Col 😀', ancho: 1 }], [['celda 😀 → こんにちは']]);
    documento.tabla([{ titulo: 'Col', ancho: 1 }], [], { vacia: 'nada 😀' });
  }

  it('sin saneador sigue siendo estricto: un caracter que no esta es un error', () => {
    expect(() => escribirDeTodo(conSaneador())).toThrow(/no puede escribir/);
  });

  it('con saneador ningun texto lo rompe: banda, texto, caja, tabla, titulo, asunto y pie', () => {
    const documento = conSaneador(sanearParaPdf);

    escribirDeTodo(documento);

    const pdf = documento.generar();

    expect(pdf).toContain('/Title (Tus datos [emoji])');
    expect(pdf).toContain('/Subject (a -> b)');
    expect(pdf).toContain('(pie [emoji])');
    expect(pdf).toContain('(nada)');
    // eslint-disable-next-line no-control-regex
    expect(pdf).toMatch(/^[\x09\x0a\x0d\x20-\x7e]*$/);
  });
});
