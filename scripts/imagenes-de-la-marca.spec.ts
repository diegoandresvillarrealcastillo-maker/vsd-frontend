import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Las imagenes de la marca (SCRUM-287): el loto y el logo completo que se dibujan en la pagina, y
 * los iconos de la pestana y de la pantalla de inicio.
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

      expect(medidasDelPng(icono.src.slice(1)), icono.src).toEqual([lado, lado]);
    }
  });

  it('el favicon en SVG lleva el loto incrustado: un SVG como imagen no puede enlazar archivos', () => {
    const svg = PUBLICO('favicon.svg').toString('utf8');

    expect(svg).toContain('data:image/webp;base64,');
    expect(svg).not.toMatch(/href="\/|href="http/);
  });

  it('la pagina enlaza los dos favicons', () => {
    const pagina = readFileSync(resolve('index.html'), 'utf8');

    expect(pagina).toContain('href="/favicon-48.png"');
    expect(pagina).toContain('href="/favicon.svg"');
  });
});
