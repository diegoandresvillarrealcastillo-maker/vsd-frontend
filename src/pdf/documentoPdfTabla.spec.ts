import { describe, expect, it } from 'vitest';

import { ANCHO_UTIL, DocumentoPdf } from './documentoPdf.ts';

/**
 * La banda de marca y la tabla del escritor de PDF (SCRUM-191). Como en `documentoPdf.spec.ts`,
 * se comprueba por sus efectos en el archivo: donde cae cada texto y que nada se salga del margen.
 */
function nuevo() {
  return new DocumentoPdf({
    titulo: 'Tus datos',
    idioma: 'es-CO',
    pie: (pagina, total) => ({ izquierda: 'pie', derecha: `${pagina}/${total}` }),
  });
}

function textosDe(pdf: string): { texto: string; x: number; y: number; fuente: string }[] {
  return [
    ...pdf.matchAll(/\/(F\d) [\d.]+ Tf 1 0 0 1 ([\d.]+) ([\d.]+) Tm \(((?:[^()\\]|\\.)*)\) Tj/g),
  ].map((m) => ({ fuente: m[1] ?? '', x: Number(m[2]), y: Number(m[3]), texto: m[4] ?? '' }));
}

const MARGEN = 56;
const FIN_DEL_ANCHO_UTIL = MARGEN + ANCHO_UTIL;

describe('DocumentoPdf, la banda de marca', () => {
  it('cubre todo el ancho de la pagina, pegada al borde de arriba', () => {
    const documento = nuevo();

    documento.banda({ titulo: 'VSD Health', subtitulo: 'Tus datos', fondo: [0.24, 0.48, 0.42] });

    const pdf = documento.generar();

    // x = 0, hasta el ancho completo y hasta el borde de arriba (841.89).
    expect(pdf).toMatch(/0\.24 0\.48 0\.42 rg 0 \d+(?:\.\d+)? 595\.28 \d+(?:\.\d+)? re f/);

    const [, y, alto] = /rg 0 (\d+(?:\.\d+)?) 595\.28 (\d+(?:\.\d+)?) re f/.exec(pdf) ?? [];

    expect(Number(y) + Number(alto)).toBeCloseTo(841.89, 1);
  });

  it('se dibuja antes que su texto y el texto va en blanco', () => {
    const documento = nuevo();

    documento.banda({ titulo: 'VSD Health', subtitulo: 'Tus datos', fondo: [0.24, 0.48, 0.42] });

    const pdf = documento.generar();

    // «(VSD Health)» tambien sale en /Producer: se busca la operacion de texto.
    expect(pdf.indexOf(' re f')).toBeLessThan(pdf.indexOf('Tm (VSD Health) Tj'));
    expect(pdf).toMatch(/BT 1 1 1 rg \/F2 [\d.]+ Tf 1 0 0 1 56 [\d.]+ Tm \(VSD Health\) Tj ET/);
  });

  it('lo que se escribe despues queda por debajo de la banda', () => {
    const documento = nuevo();

    documento.banda({ titulo: 'VSD Health', fondo: [0.24, 0.48, 0.42] });
    documento.texto([{ texto: 'Despues' }]);

    const pdf = documento.generar();
    const [, y, alto] = /rg 0 (\d+(?:\.\d+)?) 595\.28 (\d+(?:\.\d+)?) re f/.exec(pdf) ?? [];
    const despues = textosDe(pdf).find((t) => t.texto === 'Despues');

    expect(despues).toBeDefined();
    // `y` crece hacia arriba: lo de despues esta mas abajo que el borde de abajo de la banda.
    expect(despues?.y).toBeLessThan(Number(y));
    expect(Number(alto)).toBeGreaterThan(60);
  });

  it('si ya habia algo escrito, la banda empieza otra pagina en vez de taparlo', () => {
    const documento = nuevo();

    documento.texto([{ texto: 'Antes' }]);
    documento.banda({ titulo: 'VSD Health', fondo: [0.24, 0.48, 0.42] });

    expect(documento.generar()).toContain('/Count 2');
  });
});

describe('DocumentoPdf, la tabla', () => {
  const COLUMNAS = [
    { titulo: 'Fecha', ancho: 0.25 },
    { titulo: 'Actividad', ancho: 0.45 },
    { titulo: 'Nivel', ancho: 0.3 },
  ] as const;

  it('pone el encabezado en negrita y cada columna empieza siempre en el mismo sitio', () => {
    const documento = nuevo();

    documento.tabla(COLUMNAS, [
      ['01/10/2026', 'Memoria', 'Favorable'],
      ['02/10/2026', 'Atención', 'En seguimiento'],
    ]);

    const textos = textosDe(documento.generar());
    const encabezado = textos.filter((t) => ['Fecha', 'Actividad', 'Nivel'].includes(t.texto));

    expect(encabezado).toHaveLength(3);
    expect(encabezado.every((t) => t.fuente === 'F2')).toBe(true);

    const xDeFecha = encabezado.find((t) => t.texto === 'Fecha')?.x;
    const xDeNivel = encabezado.find((t) => t.texto === 'Nivel')?.x;
    const filas = textos.filter((t) => t.texto.startsWith('0') && t.texto.includes('2026'));

    expect(filas.map((t) => t.x)).toEqual([xDeFecha, xDeFecha]);
    expect(textos.find((t) => t.texto === 'Favorable')?.x).toBe(xDeNivel);
    expect(textos.find((t) => t.texto === 'En')?.x).toBe(xDeNivel);
  });

  it('el texto largo de una celda se parte dentro de su columna y no invade la vecina', () => {
    const documento = nuevo();

    documento.tabla(COLUMNAS, [['01/10/2026', 'palabra '.repeat(40).trim(), 'Favorable']]);

    const textos = textosDe(documento.generar());
    const xDeActividad = MARGEN + ANCHO_UTIL * 0.25;
    const xDeNivel = MARGEN + ANCHO_UTIL * 0.7;
    const palabras = textos.filter((t) => t.texto === 'palabra');

    expect(palabras).toHaveLength(40);

    for (const palabra of palabras) {
      expect(palabra.x).toBeGreaterThanOrEqual(xDeActividad);
      // Cada palabra mide unos 36 pt: una que empiece pasada la mitad de la columna no cabria.
      expect(palabra.x).toBeLessThan(xDeNivel);
    }

    // Y la fila crece hacia abajo: hay varias lineas distintas.
    expect(new Set(palabras.map((t) => t.y)).size).toBeGreaterThan(3);
  });

  it('nada se pasa del margen derecho', () => {
    const documento = nuevo();

    documento.tabla(
      COLUMNAS,
      Array.from({ length: 5 }, (_, i) => [
        `0${i + 1}/10/2026`,
        'Una actividad larga '.repeat(6),
        'x',
      ]),
    );

    for (const t of textosDe(documento.generar())) {
      expect(t.x).toBeLessThan(FIN_DEL_ANCHO_UTIL);
    }
  });

  it('una tabla larga sigue en otra pagina y repite el encabezado', () => {
    const documento = nuevo();

    documento.tabla(
      COLUMNAS,
      Array.from({ length: 90 }, (_, i) => [`Dia ${i}`, 'Actividad', 'Favorable']),
    );

    const pdf = documento.generar();
    const paginas = Number(/\/Count (\d+)/.exec(pdf)?.[1]);
    const encabezados = textosDe(pdf).filter((t) => t.texto === 'Fecha');

    expect(paginas).toBeGreaterThan(1);
    expect(encabezados).toHaveLength(paginas);
  });

  it('una fila no se parte entre dos paginas si cabe en una: pasa entera a la siguiente', () => {
    const documento = nuevo();

    documento.espacio(documento.espacioLibre - 60);
    documento.tabla(COLUMNAS, [['01/10/2026', 'palabra '.repeat(30).trim(), 'x']]);

    const pdf = documento.generar();
    const contenidos = pdf.split('\nstream\n').slice(1);

    expect(pdf).toContain('/Count 2');
    // Ninguna de las palabras de la fila quedo en la primera pagina.
    expect(contenidos[0]).not.toContain('(palabra)');
    expect(contenidos[1]).toContain('(palabra)');
  });

  it('una fila mas alta que una pagina entera sigue fluyendo y no pierde ni una palabra', () => {
    const documento = nuevo();
    const palabras = Array.from({ length: 1500 }, (_, i) => `p${i}`);

    documento.tabla(COLUMNAS, [['01/10/2026', palabras.join(' '), 'x']]);

    const textos = textosDe(documento.generar()).map((t) => t.texto);

    for (const palabra of palabras) {
      expect(textos).toContain(palabra);
    }
  });

  it('una tabla sin filas dice que no hay nada y no deja el encabezado solo', () => {
    const documento = nuevo();

    documento.tabla(COLUMNAS, [], { vacia: 'Todavía no hay nada.' });

    const textos = textosDe(documento.generar()).map((t) => t.texto);

    expect(textos).toContain('Todav\\355a');
    expect(textos).not.toContain('Fecha');
  });

  it('una celda vacia es una celda vacia: no rompe la fila', () => {
    const documento = nuevo();

    documento.tabla(COLUMNAS, [['01/10/2026', '', 'Favorable']]);

    expect(() => documento.generar()).not.toThrow();
  });
});
