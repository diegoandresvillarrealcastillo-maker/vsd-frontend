import { describe, expect, it } from 'vitest';

import RESPIRACION from './respiracion.css?raw';

/**
 * Los estilos de la «Respiracion guiada» (SCRUM-210, ficha BIE-01).
 *
 * jsdom no pinta, asi que no se puede comprobar lo que se ve. Lo que si se puede es vigilar las
 * promesas que se hicieron en el CSS: que con movimiento reducido el circulo no se anime, que la
 * advertencia se lea como una tarjeta y no como letra pequena, y que ningun color sea propio ni diga
 * «bien» o «mal».
 */

const SIN_COMENTARIOS = RESPIRACION.replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo del primer bloque que empieza con `selector {`, sin los comentarios. */
function bloque(selector: string): string {
  const inicio = SIN_COMENTARIOS.indexOf(`${selector} {`);

  if (inicio < 0) {
    throw new Error(`No hay un bloque «${selector}».`);
  }

  return SIN_COMENTARIOS.slice(
    SIN_COMENTARIOS.indexOf('{', inicio) + 1,
    SIN_COMENTARIOS.indexOf('}', inicio),
  );
}

/** Lo que hay dentro de `@media (prefers-reduced-motion: reduce)`. */
function movimientoReducido(): string {
  const reglas = [
    ...SIN_COMENTARIOS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g),
  ].map(([, dentro]) => dentro ?? '');

  return reglas.join('\n');
}

function rem(cuerpo: string): number {
  return Number(/font-size:\s*([\d.]+)rem/.exec(cuerpo)?.[1]);
}

describe('el circulo de la respiracion', () => {
  it('se abre y se cierra con lo que le dice la pantalla: hasta donde (`--escala`) y cuanto tarda (`--dur`)', () => {
    const circulo = bloque('.respiracion__circulo');

    expect(circulo).toMatch(/transform:\s*scale\(var\(--escala/);
    expect(circulo).toMatch(/transition:\s*transform var\(--dur/);
  });

  it('con movimiento reducido no se anima: sin transicion y a medio abrir', () => {
    const reducido = movimientoReducido();

    expect(reducido).toMatch(/\.respiracion__circulo\s*\{[^}]*transition:\s*none/);
    expect(reducido).toMatch(/\.respiracion__circulo\s*\{[^}]*transform:\s*scale\(0\.8\)/);
  });

  it('con movimiento reducido la barra no se desliza: salta', () => {
    expect(movimientoReducido()).toMatch(
      /\.respiracion__barra-relleno\s*\{[^}]*transition:\s*none/,
    );
  });

  it('es un circulo: cuadrado y redondeado del todo', () => {
    const circulo = bloque('.respiracion__circulo');

    expect(circulo).toMatch(/aspect-ratio:\s*1\s*;/);
    expect(circulo).toMatch(/border-radius:\s*50%/);
  });

  it('cabe en un telefono angosto: nunca pasa de lo que mide la pantalla', () => {
    expect(bloque('.respiracion__circulo')).toMatch(/width:\s*min\(72vw,\s*\d+px\)/);
  });

  it('la palabra y la cuenta se leen grandes: lo que guia cuando el circulo no se mueve', () => {
    expect(rem(bloque('.respiracion__palabra'))).toBeGreaterThanOrEqual(1.25);
    expect(rem(bloque('.respiracion__cuenta'))).toBeGreaterThanOrEqual(2);
  });

  it('la cuenta no baila: los digitos ocupan lo mismo', () => {
    expect(bloque('.respiracion__cuenta')).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});

describe('la advertencia de antes de empezar', () => {
  it('es una tarjeta con borde y fondo propios, no letra pequena', () => {
    const aviso = bloque('.respiracion__aviso');

    expect(aviso).toMatch(/border:\s*2px solid/);
    expect(aviso).toMatch(/background:/);
    expect(aviso).toMatch(/padding:\s*\d+px/);
  });

  it('el titulo y el texto se leen en 16 px o mas', () => {
    expect(rem(bloque('.respiracion__aviso-titulo'))).toBeGreaterThanOrEqual(1);
    expect(rem(bloque('.respiracion__aviso-texto'))).toBeGreaterThanOrEqual(1);
  });

  it('el texto va en el color de siempre y con aire entre lineas', () => {
    const texto = bloque('.respiracion__aviso-texto');

    expect(texto).toMatch(/color:\s*var\(--texto\)/);
    expect(Number(/line-height:\s*([\d.]+)/.exec(texto)?.[1])).toBeGreaterThanOrEqual(1.4);
  });
});

describe('los colores de la respiracion', () => {
  it('ninguno es propio: no hay un solo hexadecimal', () => {
    expect(SIN_COMENTARIOS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('solo salen de los tokens del kit de las actividades, que cambian con el tema claro y el oscuro', () => {
    const usados = new Set(
      [...SIN_COMENTARIOS.matchAll(/var\((--[\w-]+)/g)].map(([, token]) => token),
    );
    const permitidos = new Set([
      '--viva-modulo',
      '--viva-texto',
      '--fondo-elevado',
      '--fondo-sutil',
      '--texto',
      '--texto-tenue',
      '--escala',
      '--dur',
    ]);

    expect([...usados].filter((token) => !permitidos.has(token ?? ''))).toEqual([]);
  });

  it('el circulo y la barra son del color del modulo, no de «bien» ni de «mal»', () => {
    expect(bloque('.respiracion__circulo')).toContain('var(--viva-modulo)');
    expect(bloque('.respiracion__barra-relleno')).toMatch(/background:\s*var\(--viva-modulo\)/);
  });
});
