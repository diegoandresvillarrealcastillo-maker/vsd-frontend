import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';

/**
 * Las anclas del panel dejan sitio a la barra de arriba (SCRUM-182).
 *
 * La barra es pegajosa y mide 76 px. Sin un margen de anclaje, al llegar a «Inicio» o a
 * «Progreso» —desde la barra, desde el dock o desde Mi diario— el titulo de la seccion queda
 * justo debajo de ella y no se ve. jsdom no calcula el diseno, asi que lo que se vigila es la
 * regla: que exista y que sea mayor que el alto de la barra, para que cambiar uno sin el otro
 * se note.
 */

const SIN_COMENTARIOS = APLICACION.replace(/\/\*[\s\S]*?\*\//g, '');

const PX_POR_REM = 16;

describe('Las secciones del panel y la barra pegajosa', () => {
  it('el margen de anclaje de las secciones supera el alto de la barra', () => {
    const alto = /\.app__barra-interior\s*\{[^}]*?\bheight:\s*(\d+)px/.exec(SIN_COMENTARIOS)?.[1];
    const regla = /\.app__portada,\s*\.app__seccion\s*\{([^}]*)\}/.exec(SIN_COMENTARIOS)?.[1];

    expect(alto, 'no se encontro el alto de la barra').toBeDefined();
    expect(regla, 'no hay una regla para .app__portada y .app__seccion').toBeDefined();

    const margen = /scroll-margin-top:\s*([\d.]+)rem/.exec(regla ?? '')?.[1];

    expect(margen, 'la regla no declara scroll-margin-top en rem').toBeDefined();
    expect(Number(margen) * PX_POR_REM).toBeGreaterThan(Number(alto));
  });
});
