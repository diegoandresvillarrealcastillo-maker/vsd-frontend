import { describe, expect, it } from 'vitest';

import { ANCHO_UTIL, DocumentoPdf } from './documentoPdf.ts';

/**
 * El escritor de PDF (SCRUM-122). Lo que importa es que lo que escribe sea un
 * PDF que cualquier lector abra: la estructura, las posiciones de la tabla de
 * referencias y los textos. Cuanto se parte cada linea se comprueba por sus
 * efectos —que nada se pase del margen—, no por numeros exactos.
 */
function nuevo(
  pie = (pagina: number, total: number) => ({
    izquierda: 'pie',
    derecha: `${pagina}/${total}`,
  }),
) {
  return new DocumentoPdf({ titulo: 'Un título', idioma: 'es-CO', pie });
}

/** Cada operacion de texto del PDF: lo que dice y donde empieza. */
function textosDe(pdf: string): { texto: string; x: number; y: number; fuente: string }[] {
  return [
    ...pdf.matchAll(/\/(F\d) [\d.]+ Tf 1 0 0 1 ([\d.]+) ([\d.]+) Tm \(((?:[^()\\]|\\.)*)\) Tj/g),
  ].map((m) => ({ fuente: m[1] ?? '', x: Number(m[2]), y: Number(m[3]), texto: m[4] ?? '' }));
}

describe('DocumentoPdf, la estructura', () => {
  it('es un PDF: empieza con su cabecera y acaba con su marca', () => {
    const pdf = nuevo().generar();

    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
  });

  it('es ASCII puro: el texto y los bytes son lo mismo, y no cambia segun quien lo guarde', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'Cómo preparar «mi» dibujo · ñandú ¿sí? ¡sí! 512 × 512 – … ›' }]);

    // eslint-disable-next-line no-control-regex
    expect(documento.generar()).toMatch(/^[\x09\x0a\x0d\x20-\x7e]*$/);
  });

  it('es el mismo cada vez: no lleva fechas ni nada que cambie', () => {
    const hacer = () => {
      const documento = nuevo();

      documento.texto([{ texto: 'Hola' }]);

      return documento.generar();
    };

    expect(hacer()).toBe(hacer());
  });

  it('la tabla de referencias apunta a donde esta cada objeto', () => {
    const documento = nuevo();

    for (let i = 0; i < 80; i += 1) {
      documento.texto([{ texto: `Linea numero ${i} del documento` }]);
    }

    const pdf = documento.generar();
    const tabla = pdf.slice(pdf.indexOf('xref\n'));
    const posiciones = [...tabla.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));

    expect(posiciones.length).toBeGreaterThan(8);

    for (const [indice, posicion] of posiciones.entries()) {
      expect(pdf.slice(posicion, posicion + `${indice + 1} 0 obj`.length)).toBe(
        `${indice + 1} 0 obj`,
      );
    }
  });

  it('startxref apunta a la tabla de referencias, y su tamano cuenta el objeto cero', () => {
    const pdf = nuevo().generar();
    const inicio = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    const objetos = [...pdf.matchAll(/^\d+ 0 obj$/gm)].length;

    expect(pdf.slice(inicio, inicio + 4)).toBe('xref');
    expect(pdf).toContain(`xref\n0 ${objetos + 1}\n`);
    expect(pdf).toContain(`/Size ${objetos + 1}`);
  });

  it('el largo de cada flujo es el de su contenido', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'Un texto cualquiera' }]);

    const pdf = documento.generar();

    for (const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      expect(m[2]?.length).toBe(Number(m[1]));
    }
  });

  it('dice su titulo, su asunto y su idioma, y los acentos van en octal', () => {
    const pdf = new DocumentoPdf({
      titulo: 'Cómo hacerlo',
      asunto: 'Guía',
      idioma: 'es-CO',
      pie: () => ({ izquierda: '', derecha: '' }),
    }).generar();

    expect(pdf).toContain('/Title (C\\363mo hacerlo)');
    expect(pdf).toContain('/Subject (Gu\\355a)');
    expect(pdf).toContain('/Lang (es-CO)');
  });

  it('usa las fuentes que trae todo lector, sin incrustar nada', () => {
    const pdf = nuevo().generar();

    expect(pdf).toContain('/BaseFont /Helvetica ');
    expect(pdf).toContain('/BaseFont /Helvetica-Bold ');
    expect(pdf).toContain('/WinAnsiEncoding');
    expect(pdf).not.toContain('/FontFile');
  });
});

describe('DocumentoPdf, el texto', () => {
  it('escapa los parentesis y la barra: no cierran la cadena', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'f(x) = a\\b' }]);

    expect(textosDe(documento.generar()).map((t) => t.texto)).toContain('f\\(x\\)');
    expect(documento.generar()).toContain('(a\\\\b)');
  });

  it('un caracter que WinAnsi no tiene es un error, no un hueco', () => {
    const documento = nuevo();

    expect(() => documento.texto([{ texto: 'a → b' }])).toThrow(/→/);
    expect(() => documento.texto([{ texto: '😀' }])).toThrow(/U\+1f600/);
  });

  it('las letras con tilde se escriben con su byte de WinAnsi', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'áéíóúüñ ÁÉÍÓÚÜÑ' }]);

    const pdf = documento.generar();

    expect(pdf).toContain('(\\341\\351\\355\\363\\372\\374\\361)');
    expect(pdf).toContain('(\\301\\311\\315\\323\\332\\334\\321)');
  });

  it('la negrita va con su propia fuente', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'uno ' }, { texto: 'dos', fuente: 'negrita' }]);

    const textos = textosDe(documento.generar());

    expect(textos.find((t) => t.texto === 'uno')?.fuente).toBe('F1');
    expect(textos.find((t) => t.texto === 'dos')?.fuente).toBe('F2');
  });

  it('una palabra que cruza dos tramos se queda junta', () => {
    const documento = nuevo();

    documento.texto([{ texto: '(' }, { texto: 'Ctrl', fuente: 'negrita' }, { texto: ').' }]);

    const textos = textosDe(documento.generar()).filter((t) => t.y > 100);

    // Salen pegados: cada uno empieza donde acaba el anterior, sin un espacio.
    expect(textos.map((t) => t.texto)).toEqual(['\\(', 'Ctrl', '\\).']);
    expect(textos[1]!.x).toBeGreaterThan(textos[0]!.x);
  });

  it('los espacios que se repiten se juntan en uno', () => {
    const solo = nuevo();
    const muchos = nuevo();

    solo.texto([{ texto: 'a b' }]);
    muchos.texto([{ texto: 'a   \n  b' }]);

    expect(textosDe(muchos.generar())).toEqual(textosDe(solo.generar()));
  });

  it('un texto largo se parte en lineas y ninguna se pasa del margen derecho', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'palabra '.repeat(200) }], { tamano: 10.5 });

    const lineas = textosDe(documento.generar()).filter((t) => t.y > 100);
    const derecha = 56 + ANCHO_UTIL;
    const porLinea = new Map<number, number>();

    for (const t of lineas) {
      porLinea.set(t.y, Math.max(porLinea.get(t.y) ?? 0, t.x));
    }

    expect(porLinea.size).toBeGreaterThan(5);

    // El inicio de la ultima palabra de cada linea queda dentro del margen.
    for (const x of porLinea.values()) {
      expect(x).toBeLessThan(derecha);
    }
  });

  it('una sangria mueve el texto, y el marcador cuelga a su izquierda', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'texto' }], { sangria: 30 }, '1.');

    const textos = textosDe(documento.generar()).filter((t) => t.y > 100);
    const marcador = textos.find((t) => t.texto === '1.');
    const texto = textos.find((t) => t.texto === 'texto');

    expect(texto?.x).toBeCloseTo(56 + 30);
    expect(marcador?.x).toBeLessThan(texto!.x);
    expect(marcador?.fuente).toBe('F2');
  });

  it('una casilla es un cuadrado vacio a la izquierda', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'hacer' }], { sangria: 24 }, { casilla: true });

    expect(documento.generar()).toMatch(/ re S\n/);
  });

  it('medir dice lo mismo que ocupa el texto al escribirlo', () => {
    const documento = nuevo();
    const tramos = [{ texto: 'palabra '.repeat(120) }];
    const estilo = { sangria: 20, despues: 7 };
    const antes = documento.espacioLibre;

    const medida = documento.medir(tramos, estilo);

    documento.texto(tramos, estilo);

    expect(antes - documento.espacioLibre).toBeCloseTo(medida);
  });
});

describe('DocumentoPdf, las paginas', () => {
  it('lo que no cabe pasa a otra pagina, y el pie lleva el numero y el total', () => {
    const documento = nuevo();

    for (let i = 0; i < 120; i += 1) {
      documento.texto([{ texto: `Linea ${i}` }]);
    }

    const pdf = documento.generar();
    const paginas = Number(/\/Count (\d+)/.exec(pdf)?.[1]);

    expect(paginas).toBeGreaterThan(1);
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(paginas);

    for (let numero = 1; numero <= paginas; numero += 1) {
      expect(pdf).toContain(`(${numero}/${paginas})`);
    }
  });

  it('un texto de una sola linea que no cabe se pasa entero a la siguiente', () => {
    const documento = nuevo();

    documento.espacio(documento.espacioLibre - 5);
    documento.texto([{ texto: 'Ultima' }]);

    const pdf = documento.generar();

    expect(pdf).toContain('/Count 2');
  });

  it('reservar pasa a otra pagina solo si no cabe, y nunca si ya esta al principio', () => {
    const documento = nuevo();

    // Al principio de una pagina, pedir mas de lo que cabe no sirve de nada:
    // otra pagina tampoco lo tendria. No se queda en un bucle de paginas vacias.
    documento.reservar(10_000);

    expect(documento.generar()).toContain('/Count 1');

    documento.texto([{ texto: 'algo' }]);
    documento.reservar(100);

    expect(documento.generar()).toContain('/Count 1');

    documento.reservar(documento.espacioLibre + 1);

    expect(documento.generar()).toContain('/Count 2');
  });

  it('el pie esta en cada pagina, a la izquierda y a la derecha', () => {
    const documento = new DocumentoPdf({
      titulo: 't',
      idioma: 'es',
      pie: (pagina, total) => ({ izquierda: 'Izquierda', derecha: `Página ${pagina} de ${total}` }),
    });

    documento.texto([{ texto: 'x' }]);
    documento.nuevaPagina();
    documento.texto([{ texto: 'y' }]);

    const textos = textosDe(documento.generar());
    const derecha = textos.filter((t) => t.texto.startsWith('P\\341gina'));

    expect(derecha.map((t) => t.texto)).toEqual(['P\\341gina 1 de 2', 'P\\341gina 2 de 2']);
    expect(textos.filter((t) => t.texto === 'Izquierda')).toHaveLength(2);
    // La derecha acaba en el margen derecho: empieza antes de el.
    for (const t of derecha) {
      expect(t.x).toBeGreaterThan(300);
      expect(t.x).toBeLessThan(56 + ANCHO_UTIL);
    }
  });

  it('la caja se dibuja antes que su texto, para no taparlo', () => {
    const documento = nuevo();

    documento.caja([{ texto: 'una nota' }], { fondo: [0.9, 0.9, 0.9] });

    const pdf = documento.generar();

    expect(pdf.indexOf(' re f')).toBeGreaterThan(-1);
    expect(pdf.indexOf(' re f')).toBeLessThan(pdf.indexOf('(una)'));
  });

  it('la caja no se parte entre dos paginas', () => {
    const documento = nuevo();

    documento.espacio(documento.espacioLibre - 30);
    documento.caja([{ texto: 'palabra '.repeat(60) }], { fondo: [0.9, 0.9, 0.9] });

    const pdf = documento.generar();
    // Cada flujo empieza tras un salto de linea; `endstream` no cuenta.
    const contenidos = pdf.split('\nstream\n').slice(1);

    expect(pdf).toContain('/Count 2');
    // El fondo esta en la segunda pagina, junto con todo su texto.
    expect(contenidos[0]).not.toContain(' re f');
    expect(contenidos[1]).toContain(' re f');
  });

  it('la regla cruza el ancho util', () => {
    const documento = nuevo();

    documento.regla();

    expect(documento.generar()).toMatch(/ 56 \d+(?:\.\d+)? m 539\.28 \d+(?:\.\d+)? l S/);
  });
});
