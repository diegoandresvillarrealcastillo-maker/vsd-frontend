import { describe, expect, it } from 'vitest';

import JUEGOS from './juegos.css?raw';

/**
 * Los estilos de «Recuerda los colores» (SCRUM-209).
 *
 * jsdom no pinta, asi que no se puede comprobar lo que se ve. Lo que si se puede es vigilar las
 * promesas que se hicieron en el CSS: que con movimiento reducido las casillas no se animen, y que
 * las casillas bloqueadas mientras se mira no se vean apagadas (se ven como son).
 */

/** El cuerpo del primer bloque que empieza con `selector {`, sin los comentarios. */
function bloque(selector: string): string {
  const sinComentarios = JUEGOS.replace(/\/\*[\s\S]*?\*\//g, '');
  const inicio = sinComentarios.indexOf(`${selector} {`);

  if (inicio < 0) {
    throw new Error(`No hay un bloque «${selector}».`);
  }

  return sinComentarios.slice(
    sinComentarios.indexOf('{', inicio) + 1,
    sinComentarios.indexOf('}', inicio),
  );
}

/** Lo que hay dentro de las reglas de `@media (prefers-reduced-motion: reduce)` que tocan casillas. */
function movimientoReducido(): string {
  const sinComentarios = JUEGOS.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [
    ...sinComentarios.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g),
  ].map(([, dentro]) => dentro ?? '');

  return reglas.filter((dentro) => dentro.includes('.juego__ficha')).join('\n');
}

describe('las casillas de «Recuerda los colores»', () => {
  it('con movimiento reducido no se animan: ni transicion ni crecimiento al iluminarse', () => {
    const reducido = movimientoReducido();

    expect(reducido).toMatch(/\.juego__ficha\s*\{[^}]*transition:\s*none/);
    expect(reducido).toMatch(/\.juego__ficha--activa[^{]*\{[^}]*transform:\s*none/);
  });

  it('una casilla bloqueada no se ve apagada: conserva su opacidad entera', () => {
    expect(bloque('.juego__ficha')).toMatch(/opacity:\s*1\s*;/);
  });

  it('la iluminada se rellena con su propio tono, que sale de la paleta', () => {
    const iluminada = bloque('.juego__ficha--activa');

    expect(iluminada).toMatch(/background:\s*var\(--tono\)/);
    expect(iluminada).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('el nombre de cada casilla se lee en un tamano que no se encoge sin pasar de los 12 px', () => {
    const nombre = bloque('.juego__ficha-nombre');
    const tamano = /font-size:\s*([\d.]+)rem/.exec(nombre)?.[1];

    // 0,8125 rem son 13 px: el nombre es la pista que no depende del color (R10).
    expect(Number(tamano)).toBeGreaterThanOrEqual(0.75);
  });

  it('con tres columnas en un telefono angosto sigue cabiendo: las casillas se achican, no se salen', () => {
    expect(bloque('.juego__casillas')).toMatch(/grid-template-columns:\s*repeat\(var\(--columnas/);
    expect(bloque('.juego__casillas')).toMatch(/minmax\(0,\s*1fr\)/);
  });

  it('se puede llegar a cada casilla con el teclado y se ve cual tiene el foco', () => {
    expect(bloque('.juego__ficha:focus-visible')).toMatch(/outline:\s*3px solid/);
  });
});
