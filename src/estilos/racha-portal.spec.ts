import { describe, expect, it } from 'vitest';

import PORTAL from './racha-portal.css?raw';

/**
 * El envoltorio con el que la racha pinta sus capas en el cuerpo de la pagina (SCRUM-243).
 *
 * Lleva la clase de la paleta (`app` o `actividad`) para que los tokens lleguen, y esas clases traen
 * reglas de pagina entera (`min-height`, fondo, rejilla). `display: contents` las deja sin caja: solo
 * pasa la paleta a lo que hay dentro, sin empujar ni cubrir la pagina.
 */
const CSS = PORTAL.replace(/\/\*[\s\S]*?\*\//g, '');

describe('racha-portal.css', () => {
  it('ni el envoltorio de la aplicacion ni el de la actividad generan caja', () => {
    const cuerpo =
      /\.app\.racha-portal,\s*\.actividad\.racha-portal\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(cuerpo).toMatch(/display:\s*contents/);
  });

  it('gana a las reglas de pagina entera por tener dos clases', () => {
    expect(CSS).toContain('.app.racha-portal');
    expect(CSS).toContain('.actividad.racha-portal');
  });

  it('no pone fondo, alto ni colores: solo quita la caja', () => {
    expect(CSS).not.toMatch(/background|min-height|height|color/);
  });
});
