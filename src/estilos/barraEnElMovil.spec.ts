import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';

/**
 * La barra de arriba en un telefono: con el isotipo nuevo y la llama ya no cabe en una fila a 375 px
 * (pedia ~423 px y ensanchaba la pantalla). Lo que la salva son pocas reglas, faciles de quitar sin
 * darse cuenta; jsdom no mide, asi que se vigilan aqui. La medida real a 375 y 320 px esta en el PR.
 */

const SIN_COMENTARIOS = APLICACION.replace(/\/\*[\s\S]*?\*\//g, '');

/** Las declaraciones de un selector dentro del `@media (max-width: 767px)` de la barra. */
function enElMovil(selector: string): string {
  const media = /@media \(max-width: 767px\) \{([\s\S]*?)\n\}/.exec(SIN_COMENTARIOS)?.[1];

  if (media === undefined) {
    throw new Error('No hay un @media (max-width: 767px) en aplicacion.css');
  }

  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const bloque = new RegExp(String.raw`${escapado}\s*\{([^}]*)\}`).exec(media)?.[1];

  if (bloque === undefined) {
    throw new Error(`No hay una regla para ${selector} en el @media del movil`);
  }

  return bloque.replace(/\s+/g, ' ').trim();
}

describe('La barra de arriba en un telefono', () => {
  it('puede partirse en dos filas en vez de salirse de la pantalla', () => {
    const barra = enElMovil('.app .app__barra-interior');

    expect(barra).toMatch(/flex-wrap:\s*wrap/);
    expect(barra).toMatch(/min-width:\s*0/);
    expect(barra).toMatch(/min-height:\s*76px/);
    expect(barra).toMatch(/height:\s*auto/);
  });

  it('las acciones se parten, no pasan del ancho y se quedan a la derecha', () => {
    const acciones = enElMovil('.app .app__acciones');

    expect(acciones).toMatch(/flex-wrap:\s*wrap/);
    expect(acciones).toMatch(/max-width:\s*100%/);
    expect(acciones).toMatch(/margin-inline-start:\s*auto/);
  });

  it('el nombre queda solo para el lector de pantalla y el isotipo sigue a la vista', () => {
    const nombre = enElMovil('.app .marca__texto');

    // No `display: none`: el enlace ya tiene su nombre, pero un recorte no lo saca del arbol.
    expect(nombre).not.toMatch(/display:\s*none/);
    expect(nombre).toMatch(/clip-path:\s*inset\(50%\)/);
  });
});
