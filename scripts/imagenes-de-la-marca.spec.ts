import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/**
 * Las imagenes de la marca (SCRUM-287, SCRUM-290): el loto y el logo completo que se dibujan en la
 * pagina, y los iconos de la pestana, de la ventana y de la pantalla de inicio.
 *
 * Cada icono tiene un fondo segun donde se use, y equivocarse se ve a simple vista: el de la pestana
 * y la ventana va SIN fondo (si no, sale un cuadrado oscuro); el de iPhone va CON fondo (iOS pinta de
 * negro lo transparente); el maskable de Android va CON fondo y el loto dentro de la zona segura (el
 * sistema lo recorta en circulo o en cuadrado redondeado).
 *
 * Lo que se rompe sin avisar es que el archivo cambie y las medidas que declara el codigo no:
 * la pagina reserva un sitio de otro tamano y se mueve al cargar la imagen. Y que un icono del
 * manifiesto apunte a un archivo que ya no existe o que mide otra cosa, que Android rechaza.
 */
const PUBLICO = (ruta: string) => readFileSync(resolve('public', ruta));
const FUENTE = (ruta: string) => readFileSync(resolve('src', ruta), 'utf8');

/** El ancho y el alto de un WebP con transparencia (formato extendido). */
function medidasDelWebp(ruta: string): [number, number] {
  const bytes = PUBLICO(ruta);

  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  expect(bytes.toString('ascii', 12, 16)).toBe('VP8X');

  return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
}

/** El ancho y el alto de un PNG, de su cabecera IHDR. */
function medidasDelPng(ruta: string): [number, number] {
  const bytes = PUBLICO(ruta);

  expect(bytes.toString('ascii', 1, 4)).toBe('PNG');

  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/**
 * La opacidad (0 a 255) del pixel del medio del borde izquierdo de un PNG de 8 bits, RGB o RGBA.
 *
 * Es el sitio que distingue un icono con fondo de uno sin el: en un icono cuadrado con fondo es
 * opaco, y en uno con el loto suelto es transparente. La esquina no sirve: un cuadrado con las
 * esquinas redondeadas tiene la esquina transparente y aun asi es un cuadrado.
 */
function opacidadDelBordeDelPng(ruta: string): number {
  const bytes = PUBLICO(ruta);
  const [ancho, alto, bits, tipoDeColor] = [
    bytes.readUInt32BE(16),
    bytes.readUInt32BE(20),
    bytes[24],
    bytes[25],
  ];

  expect(bits, `${ruta}: 8 bits`).toBe(8);
  expect([2, 6], `${ruta}: RGB o RGBA`).toContain(tipoDeColor);

  const datos: Buffer[] = [];

  for (let punto = 8; punto < bytes.length;) {
    const largo = bytes.readUInt32BE(punto);

    if (bytes.toString('ascii', punto + 4, punto + 8) === 'IDAT') {
      datos.push(bytes.subarray(punto + 8, punto + 8 + largo));
    }

    punto += 12 + largo;
  }

  const bruto = inflateSync(Buffer.concat(datos));
  const porPixel = tipoDeColor === 6 ? 4 : 3;
  const largoDeFila = ancho * porPixel;
  const filas = Buffer.alloc(alto * largoDeFila);

  // Deshace el filtro de cada fila (los cinco tipos de PNG).
  for (let y = 0; y < alto; y++) {
    const filtro = bruto[y * (largoDeFila + 1)];

    for (let i = 0; i < largoDeFila; i++) {
      const valor = bruto[y * (largoDeFila + 1) + 1 + i];
      const izquierda = i >= porPixel ? filas[y * largoDeFila + i - porPixel] : 0;
      const arriba = y > 0 ? filas[(y - 1) * largoDeFila + i] : 0;
      const arribaIzquierda =
        y > 0 && i >= porPixel ? filas[(y - 1) * largoDeFila + i - porPixel] : 0;
      const estimado = [
        0,
        izquierda,
        arriba,
        (izquierda + arriba) >> 1,
        paeth(izquierda, arriba, arribaIzquierda),
      ][filtro];

      filas[y * largoDeFila + i] = (valor + estimado) & 255;
    }
  }

  return tipoDeColor === 6 ? filas[Math.floor(alto / 2) * largoDeFila + 3] : 255;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];

  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

describe('las medidas que declara el codigo son las del archivo', () => {
  it('el logo completo', () => {
    const [ancho, alto] = medidasDelWebp('logo-completo.webp');

    expect(FUENTE('componentes/imagenesDeLaMarca.ts')).toContain(
      `src: '/logo-completo.webp', ancho: ${ancho}, alto: ${alto}`,
    );
  });

  it('el loto', () => {
    const [ancho, alto] = medidasDelWebp('loto-vsd-health.webp');

    expect(FUENTE('componentes/imagenesDeLaMarca.ts')).toContain(
      `src: '/loto-vsd-health.webp', ancho: ${ancho}, alto: ${alto}`,
    );
  });
});

describe('los iconos', () => {
  const ICONOS: readonly (readonly [string, number])[] = [
    ['icono-192.png', 192],
    ['icono-512.png', 512],
    ['icono-maskable-192.png', 192],
    ['icono-maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
    ['apple-touch-icon-167.png', 167],
    ['apple-touch-icon-152.png', 152],
    ['favicon-48.png', 48],
  ];

  it.each(ICONOS)('%s mide %i x %i', (archivo, lado) => {
    expect(medidasDelPng(archivo)).toEqual([lado, lado]);
  });

  it('los del manifiesto existen y miden lo que dicen', () => {
    const manifiesto = JSON.parse(PUBLICO('manifest.webmanifest').toString('utf8')) as {
      icons: { src: string; sizes: string }[];
    };

    expect(manifiesto.icons.length).toBeGreaterThan(0);

    for (const icono of manifiesto.icons) {
      const lado = Number(icono.sizes.split('x')[0]);

      // Sin el `?v=` que obliga al navegador a bajarlo de nuevo.
      const archivo = icono.src.slice(1).split('?')[0];

      expect(medidasDelPng(archivo), icono.src).toEqual([lado, lado]);
    }
  });

  it('el manifiesto separa los iconos normales de los maskable', () => {
    const manifiesto = JSON.parse(PUBLICO('manifest.webmanifest').toString('utf8')) as {
      icons: { src: string; purpose?: string }[];
    };
    const de = (proposito: string) =>
      manifiesto.icons.filter((icono) => icono.purpose === proposito).map((icono) => icono.src);

    // Un solo archivo con "any maskable" se recorta mal: o le sobra fondo o le falta margen.
    expect(manifiesto.icons.filter((icono) => icono.purpose?.includes(' '))).toEqual([]);
    expect(de('any').length).toBeGreaterThanOrEqual(2);
    expect(de('maskable')).toEqual(['/icono-maskable-192.png', '/icono-maskable-512.png']);
  });

  it.each(['icono-192.png', 'icono-512.png', 'favicon-48.png'])(
    '%s no tiene fondo: se ve el loto y no un cuadrado',
    (archivo) => {
      expect(opacidadDelBordeDelPng(archivo)).toBe(0);
    },
  );

  it.each([
    'icono-maskable-192.png',
    'icono-maskable-512.png',
    'apple-touch-icon.png',
    'apple-touch-icon-167.png',
    'apple-touch-icon-152.png',
  ])('%s llena todo el cuadrado: el sistema lo recorta, no lo rellena', (archivo) => {
    expect(opacidadDelBordeDelPng(archivo)).toBe(255);
  });

  it('el favicon en SVG lleva el loto incrustado: un SVG como imagen no puede enlazar archivos', () => {
    const svg = PUBLICO('favicon.svg').toString('utf8');

    expect(svg).toContain('data:image/webp;base64,');
    expect(svg).not.toMatch(/href="\/|href="http/);
  });

  it('el loto del favicon en SVG tiene transparencia', () => {
    const base64 = /data:image\/webp;base64,([A-Za-z0-9+/=]+)/.exec(
      PUBLICO('favicon.svg').toString('utf8'),
    )?.[1];
    const webp = Buffer.from(base64 ?? '', 'base64');

    expect(webp.toString('ascii', 12, 16)).toBe('VP8X');
    // El bit 4 de las banderas del formato extendido: lleva canal alfa.
    expect(webp[20] & 0x10).toBe(0x10);
  });

  it('la pagina enlaza los dos favicons', () => {
    const pagina = readFileSync(resolve('index.html'), 'utf8');

    expect(pagina).toContain('href="/favicon-48.png?v=2"');
    expect(pagina).toContain('href="/favicon.svg?v=2"');
  });

  it('los iconos de iPhone y iPad que enlaza la pagina existen y miden lo que dicen', () => {
    const pagina = readFileSync(resolve('index.html'), 'utf8');
    const enlaces = [
      ...pagina.matchAll(/rel="apple-touch-icon"(?: sizes="(\d+)x\d+")? href="([^"?]+)/g),
    ];

    expect(enlaces.length).toBeGreaterThanOrEqual(3);

    for (const [, lado, ruta] of enlaces) {
      expect(medidasDelPng(ruta.slice(1)), ruta).toEqual(
        lado ? [Number(lado), Number(lado)] : [180, 180],
      );
    }
  });
});
