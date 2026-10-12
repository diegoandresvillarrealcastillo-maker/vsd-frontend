import { describe, expect, it } from 'vitest';

import { estiloDelSimbolo } from '../paginas/actividad/mecanicas/coloresDeSimbolos.ts';
import type { NombreDeIcono } from '../paginas/panel/Icono.tsx';
import APLICACION from './aplicacion.css?raw';
import JUEGOS from './juegos.css?raw';
import VIVA from './viva.css?raw';

/**
 * Las actividades se ven con la paleta de la aplicacion, en claro y en oscuro (SCRUM-173).
 *
 * jsdom no pinta, asi que no se puede comprobar el color que sale en pantalla. Lo que si se puede
 * es vigilar de donde sale: que las hojas de estilos de las actividades no inventen colores y que
 * los tokens del panel lleguen a la pantalla de una actividad en los dos temas. Si alguien pone un
 * color propio, o quita un tema, esto avisa antes de que se vea en un telefono.
 */
/** Colores fijos que se permiten, cada uno por una razon. */
const PERMITIDOS = new Map([
  ['#fff', 'blanco de un reflejo o de una chispa; nunca el fondo de un texto'],
  ['#000', 'negro para oscurecer un acento al mezclarlo'],
  ['#ffc83d', 'el amarillo de las estrellas, que no es de ningun modulo'],
  ['#3b2a00', 'el texto oscuro de la etiqueta amarilla del +1'],
]);

/** Los colores en hexadecimal que hay en una hoja, sin los comentarios. */
function coloresFijos(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

  return [...sinComentarios.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(([color]) => color.toLowerCase());
}

describe('La paleta de las actividades', () => {
  it.each([
    ['viva.css', VIVA],
    ['juegos.css', JUEGOS],
  ])('%s no inventa colores: solo los de la aplicacion y unos pocos permitidos', (_nombre, css) => {
    const sueltos = coloresFijos(css).filter((color) => !PERMITIDOS.has(color));

    expect(sueltos).toEqual([]);
  });

  it.each([
    ['bienestar', '--app-bienestar-acento', '--app-bienestar'],
    ['cognicion', '--app-cognicion-acento', '--app-cognicion'],
    ['emociones', '--app-emociones-acento', '--app-emociones'],
  ])('%s pone su nota con el acento y el fondo del panel', (modulo, acento, fondo) => {
    const bloque = new RegExp(
      String.raw`\.actividad\[data-modulo='${modulo}'\]\s*\{([^}]*)\}`,
      'm',
    ).exec(VIVA)?.[1];

    expect(bloque).toBeDefined();
    expect(bloque).toContain(`--viva-modulo: var(${acento})`);
    expect(bloque).toContain(`--viva-suave: var(${fondo})`);
  });

  it('el verde de la aplicacion manda en todos los modulos: ninguno lo cambia', () => {
    // Lo que se toca y lo que avanza es verde, como en el panel; el modulo solo pone su nota.
    expect(VIVA).toMatch(/\.actividad\s*\{[^}]*--viva-1:\s*var\(--app-primario\)/);

    for (const modulo of ['bienestar', 'cognicion', 'emociones']) {
      const bloque = new RegExp(
        String.raw`\.actividad\[data-modulo='${modulo}'\]\s*\{([^}]*)\}`,
        'm',
      ).exec(VIVA)?.[1];

      expect(bloque).not.toMatch(/--viva-1:|--viva-texto:|--viva-sobre:/);
    }
  });

  it('el texto sobre el verde es el del panel: blanco en claro y oscuro en oscuro', () => {
    expect(VIVA).toMatch(/--viva-sobre:\s*var\(--app-sobre-primario\)/);
  });

  it('los colores de siempre se reasignan a los de la aplicacion dentro de la actividad', () => {
    for (const [token, app] of [
      ['--fondo', '--app-lienzo'],
      ['--fondo-elevado', '--app-superficie'],
      ['--fondo-sutil', '--app-superficie-alta'],
      ['--texto', '--app-tinta'],
      ['--texto-tenue', '--app-tenue'],
      ['--borde', '--app-borde'],
    ] as const) {
      expect(VIVA).toContain(`${token}: var(${app});`);
    }
  });

  it('los titulos usan la tipografia de los titulos de la aplicacion', () => {
    expect(VIVA).toMatch(/\.viva-paso__titulo\s*\{[^}]*--app-fuente-titulos/);
    expect(VIVA).toMatch(/\.viva-heroe__titulo\s*\{[^}]*--app-fuente-titulos/);
  });
});

describe('Los tokens del panel llegan a la pantalla de una actividad', () => {
  it('el tema oscuro (el de Figma) se comparte con `.actividad`', () => {
    expect(APLICACION).toMatch(/\.app,\s*\.actividad\s*\{\s*--app-lienzo:/);
  });

  it('el tema claro tambien', () => {
    expect(APLICACION).toMatch(
      /:root\[data-tema='claro'\] \.app,\s*:root\[data-tema='claro'\] \.actividad\s*\{/,
    );
  });

  it('solo se comparten los tokens: el aspecto de pagina sigue siendo de `.app`', () => {
    const compartido = /\.app,\s*\.actividad\s*\{([^}]*)\}/.exec(APLICACION)?.[1] ?? '';

    expect(compartido).not.toMatch(/min-height|background:|font-family|color-scheme/);
  });
});

describe('Los colores de los simbolos de los juegos', () => {
  const ICONOS: readonly NombreDeIcono[] = [
    'leaf',
    'heart',
    'moon',
    'sparkles',
    'book',
    'calendar',
  ];

  it.each(ICONOS)('el de %s sale de la paleta de la aplicacion', (icono) => {
    const color = (estiloDelSimbolo(icono) as Record<string, string>)['--simbolo'];

    expect(color).toBeDefined();
    expect(color).toMatch(/var\(--app-/);
    // Ningun hexadecimal fijo: cambiaria de tono entre el tema claro y el oscuro.
    expect(color).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('cada simbolo tiene el suyo, para distinguirlos tambien por el color', () => {
    const colores = ICONOS.map(
      (icono) => (estiloDelSimbolo(icono) as Record<string, string>)['--simbolo'],
    );

    expect(new Set(colores).size).toBe(ICONOS.length);
  });

  it('un icono sin color propio no rompe: usa el del modulo', () => {
    expect(estiloDelSimbolo('lock')).toEqual({});
  });
});
