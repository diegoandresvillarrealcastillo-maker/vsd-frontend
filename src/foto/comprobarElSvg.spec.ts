import { describe, expect, it } from 'vitest';

import { comprobarElSvg, esUnSvg, PESO_MAXIMO_DEL_SVG, SvgRechazado } from './comprobarElSvg.ts';

/** El motivo con el que se rechaza, o `undefined` si pasa. */
function motivoDe(archivo: { name: string; type: string; size: number }): string | undefined {
  try {
    comprobarElSvg(archivo);

    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(SvgRechazado);

    return (error as SvgRechazado).motivo;
  }
}

describe('esUnSvg', () => {
  it.each([
    ['image/svg+xml', 'mascota.svg'],
    ['IMAGE/SVG+XML', 'mascota.SVG'],
    // Con parametros o con espacios a los lados, sigue siendo un SVG.
    ['image/svg+xml;charset=utf-8', 'mascota.svg'],
    ['image/svg+xml ; charset=UTF-8', 'mascota.svg'],
    [' image/svg+xml ', 'mascota.svg'],
  ])('%s se acepta', (type, name) => {
    expect(esUnSvg({ type, name })).toBe(true);
  });

  it.each([
    ['', 'mascota.svg'],
    ['application/octet-stream', 'mascota.SVG'],
    ['text/xml', 'mi.mascota.final.svg'],
  ])('sin un tipo claro (%s), se mira la extension: %s', (type, name) => {
    expect(esUnSvg({ type, name })).toBe(true);
  });

  it.each([
    ['image/png', 'mascota.png'],
    ['image/jpeg', 'mascota.jpg'],
    ['text/html', 'mascota.html'],
    ['application/pdf', 'mascota.pdf'],
    // Lo que dice el navegador pesa mas que el nombre.
    ['image/png', 'mascota.svg'],
    ['text/html', 'mascota.svg'],
    // Un parametro no convierte otro tipo en SVG.
    ['text/html;image/svg+xml', 'mascota.svg'],
    ['image/svg+xmlx', 'mascota.svg'],
    ['', 'mascota.png'],
    ['', 'mascota'],
    ['', 'mascota.svg.exe'],
    ['', 'svg'],
  ])('%s (%s) no se acepta', (type, name) => {
    expect(esUnSvg({ type, name })).toBe(false);
  });
});

describe('comprobarElSvg (SCRUM-122)', () => {
  const BUENO = { name: 'mascota.svg', type: 'image/svg+xml', size: 4_000 };

  it('un SVG normal pasa', () => {
    expect(motivoDe(BUENO)).toBeUndefined();
  });

  it('lo que no es un SVG se rechaza por su tipo', () => {
    expect(motivoDe({ ...BUENO, name: 'foto.png', type: 'image/png' })).toBe('tipo');
  });

  it('justo en 100 KB pasa, y un byte de mas se rechaza por su peso', () => {
    expect(PESO_MAXIMO_DEL_SVG).toBe(102_400);
    expect(motivoDe({ ...BUENO, size: PESO_MAXIMO_DEL_SVG })).toBeUndefined();
    expect(motivoDe({ ...BUENO, size: PESO_MAXIMO_DEL_SVG + 1 })).toBe('peso');
  });

  it('un archivo vacio pasa: el servidor dira que no es un SVG', () => {
    // Aqui solo se mira el tipo y el peso; lo que contiene lo decide el servidor.
    expect(motivoDe({ ...BUENO, size: 0 })).toBeUndefined();
  });

  it('el tipo se mira antes que el peso', () => {
    expect(motivoDe({ name: 'foto.png', type: 'image/png', size: PESO_MAXIMO_DEL_SVG * 5 })).toBe(
      'tipo',
    );
  });

  it('no mira lo que lleva dentro: eso lo decide el servidor, en un solo sitio', () => {
    // Un `.svg` con un script pasa aqui, y se rechaza alla. Que este lado no
    // intente adivinarlo es lo que evita que los dos se contradigan.
    expect(motivoDe({ name: 'ataque.svg', type: 'image/svg+xml', size: 100 })).toBeUndefined();
  });
});
