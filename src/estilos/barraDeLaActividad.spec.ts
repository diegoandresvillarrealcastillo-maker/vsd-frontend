import { describe, expect, it } from 'vitest';

import ACTIVIDAD from './actividad.css?raw';

/**
 * La barra de arriba de una actividad en un telefono angosto (SCRUM-233).
 *
 * En 360 px de ancho no cabian la marca con su nombre, la salida y el selector de tema, y el
 * nombre «VSD-H» se partia en dos lineas. jsdom no calcula el diseno, asi que aqui solo se vigilan
 * las promesas del CSS que lo evitan; el resultado se midio en el navegador a 320, 360, 375, 390
 * y 768 px: una sola linea, sin solaparse y sin desbordar.
 */

const SIN_COMENTARIOS = ACTIVIDAD.replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo del bloque `selector {` que NO esta dentro de un `@media`. */
function bloque(selector: string): string {
  const fuera = SIN_COMENTARIOS.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
  const inicio = fuera.indexOf(`${selector} {`);

  if (inicio < 0) {
    throw new Error(`No hay un bloque «${selector}».`);
  }

  return fuera.slice(fuera.indexOf('{', inicio) + 1, fuera.indexOf('}', inicio));
}

/** Lo que hay dentro del `@media (max-width: ...)` de la barra angosta. */
function mediaAngosta(): string {
  const coincidencia = /@media \(max-width: ([\d.]+)rem\) \{([\s\S]*?)\n\}/.exec(SIN_COMENTARIOS);

  return coincidencia?.[2] ?? '';
}

describe('la barra de una actividad en un telefono angosto (SCRUM-233)', () => {
  it('el nombre de la marca nunca se parte en dos lineas', () => {
    expect(bloque('.actividad__marca .marca__texto')).toMatch(/white-space:\s*nowrap/);
  });

  it('en pantallas angostas el nombre queda solo para lectores de pantalla, como en el panel', () => {
    const dentro = mediaAngosta();

    expect(dentro).toContain('.actividad__marca .marca__texto');
    expect(dentro).toMatch(/position:\s*absolute/);
    expect(dentro).toMatch(/clip-path:\s*inset\(50%\)/);
    // No se esconde con `display: none`: el nombre accesible de la marca no se pierde.
    expect(dentro).not.toMatch(/display:\s*none/);
  });

  it('la pantalla angosta empieza donde la marca con nombre ya no cabe: por encima de 360 px', () => {
    const limite = Number(/@media \(max-width: ([\d.]+)rem\)/.exec(SIN_COMENTARIOS)?.[1]);

    // 22,5 rem son 360 px (lo que el panel ya usa): un telefono de ese ancho tiene que quedar dentro.
    expect(limite * 16).toBeGreaterThanOrEqual(360);
    // Y un iPhone de 375 px conserva el nombre.
    expect(limite * 16).toBeLessThan(375);
  });

  it('la salida mide al menos 44 px de alto (12 px de relleno arriba y abajo)', () => {
    const relleno = /padding:\s*(\d+)px\s+\d+px/.exec(bloque('.actividad__volver'));

    expect(Number(relleno?.[1])).toBeGreaterThanOrEqual(12);
  });

  it('reserva a la derecha lo que ocupa el selector de tema, y no mas', () => {
    const reserva = Number(/margin-right:\s*(\d+)px/.exec(bloque('.actividad__volver'))?.[1]);

    // El selector mide 66 px y se separa 12 del borde: menos de 78 se montaria encima de la salida.
    expect(reserva).toBeGreaterThanOrEqual(78);
    expect(reserva).toBeLessThanOrEqual(88);
  });
});
