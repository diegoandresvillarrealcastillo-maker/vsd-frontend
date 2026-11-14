import { describe, expect, it } from 'vitest';

// Se lee como texto y no como binario: el PDF es ASCII puro, asi que no pierde nada.
import elArchivoVersionado from '../../../public/guia-de-la-mascota-propia.pdf?raw';
import {
  LISTA_DE_COMPROBACION,
  NOTA_DE_LA_GUIA,
  PASOS_DE_LA_GUIA,
  textoDe,
} from './contenidoDeLaGuia.ts';
import { RUTA_DE_LA_GUIA_EN_PDF } from './GuiaDeLaMascotaPropia.tsx';
import { generarLaGuiaEnPdf, TITULO_DEL_PDF } from './guiaEnPdf.ts';

/**
 * El PDF de la guia de la mascota propia (SCRUM-122).
 *
 * Lo importante: **el archivo que se descarga dice lo mismo que la pantalla**.
 * Por eso se compara, byte a byte, con lo que `generarLaGuiaEnPdf` genera hoy; si
 * alguien cambia el contenido de la guia y no regenera el archivo, esta prueba
 * falla y dice como arreglarlo.
 */

/** Los textos que hay en el PDF, en orden y sin los escapes, para buscar frases en ellos. */
function textoDelPdf(pdf: string, separador = ' '): string {
  return [...pdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)]
    .map((m) =>
      (m[1] ?? '')
        .replace(/\\(\d{3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
        .replace(/\\(.)/g, '$1'),
    )
    .join(separador);
}

/**
 * Lo que dice el PDF, en orden y sin un solo espacio. El texto sale partido en
 * lineas y en tramos, y cada parte se escribe donde le toca: lo unico que no
 * cambia es el orden de las letras. Una frase que se busca pasa por lo mismo.
 */
const sinEspacios = (texto: string): string => texto.replace(/\s+/g, '');

/** WinAnsi a Unicode, para los pocos caracteres que no son Latin-1. */
function aUnicode(texto: string): string {
  return texto
    .replaceAll('\x96', '–')
    .replaceAll('\x97', '—')
    .replaceAll('\x85', '…')
    .replaceAll('\x9b', '›')
    .replaceAll('\x95', '•');
}

function loQueDiceElPdf(pdf: string): string {
  return sinEspacios(aUnicode(textoDelPdf(pdf, '')));
}

describe('la guia en PDF', () => {
  const pdf = generarLaGuiaEnPdf();

  it('el archivo versionado es el que se genera hoy (si falla: npm run guia-de-la-mascota)', () => {
    expect(elArchivoVersionado === pdf).toBe(true);
  });

  it('esta en la ruta a la que enlaza la pantalla, dentro de public/', () => {
    expect(RUTA_DE_LA_GUIA_EN_PDF).toBe('/guia-de-la-mascota-propia.pdf');
    expect(elArchivoVersionado.startsWith('%PDF-')).toBe(true);
  });

  it('es un PDF de dos paginas A4, en espanol, con su titulo', () => {
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(pdf).toContain('/Lang (es-CO)');
    expect(pdf).toContain(`/Title (C\\363mo preparar el dibujo de tu mascota)`);
    expect(TITULO_DEL_PDF).toBe('Cómo preparar el dibujo de tu mascota');
  });

  it('lleva todos los pasos de la guia de la pantalla, cada uno con su numero', () => {
    const texto = loQueDiceElPdf(pdf);

    for (const [indice, paso] of PASOS_DE_LA_GUIA.entries()) {
      expect(texto).toContain(`${indice + 1}.${sinEspacios(paso.titulo)}`);
    }
  });

  it('lleva cada frase de cada paso, tal cual y en orden', () => {
    const texto = loQueDiceElPdf(pdf);

    for (const paso of PASOS_DE_LA_GUIA) {
      for (const parte of [
        ...(paso.texto === undefined ? [] : [textoDe(paso.texto)]),
        ...(paso.puntos ?? []).map(textoDe),
      ]) {
        expect(texto, parte).toContain(sinEspacios(parte));
      }
    }
  });

  it('lleva la aclaracion final y la lista de comprobacion, completas', () => {
    const texto = loQueDiceElPdf(pdf);

    for (const frase of [NOTA_DE_LA_GUIA, ...LISTA_DE_COMPROBACION]) {
      expect(texto, frase).toContain(sinEspacios(frase));
    }

    expect(texto).toContain('Antesdesubirlo');
  });

  it('la lista de comprobacion tiene una casilla por elemento', () => {
    expect(pdf.match(/ re S\n/g)).toHaveLength(LISTA_DE_COMPROBACION.length);
  });

  it('el pie dice en que pagina esta y de cuantas', () => {
    const texto = textoDelPdf(pdf);

    expect(texto).toContain('P\xe1gina 1 de 2');
    expect(texto).toContain('P\xe1gina 2 de 2');
    expect(texto).toContain('VSD Health · Guía de la mascota propia');
  });

  it('no repite pasos ni deja un paso sin texto', () => {
    expect(new Set(PASOS_DE_LA_GUIA.map((p) => p.titulo)).size).toBe(PASOS_DE_LA_GUIA.length);

    for (const paso of PASOS_DE_LA_GUIA) {
      expect(paso.texto !== undefined || paso.puntos !== undefined).toBe(true);
    }
  });
});
