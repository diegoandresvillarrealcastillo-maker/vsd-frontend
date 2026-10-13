import { describe, expect, it } from 'vitest';

import RACHA from './racha.css?raw';

/**
 * La llama de la racha, en CSS (SCRUM-186).
 *
 * jsdom no pinta ni mide, asi que lo que se vigila son las reglas que sostienen el diseno y que
 * son faciles de quitar sin darse cuenta: que cada nivel tenga su aspecto, que la llama quede
 * quieta con movimiento reducido, que los colores vivan en los tokens y que la barra de arriba
 * no se desborde en un telefono angosto. Cada ajuste angosto tiene detras una medida real a
 * 280, 320, 360, 375, 390 y 430 px, que esta en la descripcion del PR.
 */

const CSS = RACHA.replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de la primera regla con ese selector exacto, dentro o fuera de un @media. */
function regla(selector: string, desde = 0): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\']/g, String.raw`\$&`);
  const cuerpo = new RegExp(String.raw`(?:^|[\s}])${escapado}\s*\{([^}]*)\}`).exec(
    CSS.slice(desde),
  )?.[1];

  if (cuerpo === undefined) {
    throw new Error(`No hay una regla para ${selector}`);
  }

  return cuerpo.replace(/\s+/g, ' ').trim();
}

/** El contenido de un `@media` por su condicion. */
function media(condicion: string): string {
  const escapada = condicion.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const contenido = new RegExp(String.raw`@media ${escapada}\s*\{([\s\S]*?)\n\}`).exec(CSS)?.[1];

  if (contenido === undefined) {
    throw new Error(`No hay un @media ${condicion}`);
  }

  return contenido;
}

describe('Los cinco aspectos de la llama', () => {
  it.each([0, 1, 2, 3, 4])('el nivel %i existe como modificador del boton', (nivel) => {
    // El 1 es el aspecto base: no necesita reglas propias; los demas si las tienen.
    if (nivel === 1) {
      return;
    }

    expect(CSS).toContain(`.llama--nivel-${String(nivel)}`);
  });

  it('el nivel de un ano es dorado y brilla mas', () => {
    expect(regla('.llama--nivel-4')).toContain('--llama-oro-base');
    expect(regla('.llama--nivel-4 .llama__dibujo')).toContain('drop-shadow(');
  });

  it('la llama que descansa es un contorno quieto, sin animacion', () => {
    expect(regla('.llama--descanso .llama__dibujo')).toMatch(/animation:\s*none/);
    expect(regla('.llama--descanso .llama__cuerpo')).toContain('stroke:');
  });

  it('no usa rojo de alarma: las llamas son calidas y la llama de descanso es neutra', () => {
    // Nada castiga: ni siquiera el color de la llama se parece a una alerta.
    expect(CSS).not.toMatch(/--semaforo-urgente|#(?:f00|ff0000|e53935|d32f2f)\b/i);
  });
});

describe('Los colores viven en los tokens', () => {
  it('no hay colores en hexadecimal fuera de los dos bloques de tokens', () => {
    const fuera = CSS.replace(
      /(?:^|\n)(?:\.app|:root\[data-tema='claro'\] \.app)\s*\{[^}]*\}/g,
      '',
    );

    expect(fuera.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it('hay los mismos tokens en claro y en oscuro', () => {
    const nombres = (cuerpo: string) =>
      [...cuerpo.matchAll(/(--llama-[a-z-]+):/g)].map((m) => m[1]);
    const oscuro = /(?:^|\n)\.app\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    const claro = /:root\[data-tema='claro'\] \.app\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(nombres(oscuro).length).toBeGreaterThan(0);
    expect(nombres(claro)).toEqual(nombres(oscuro));
  });
});

describe('Con movimiento reducido', () => {
  const reducido = media('(prefers-reduced-motion: reduce)');

  it.each(['.llama__dibujo', '.llama__chispa', '.llama__boton'])('%s no se anima', (selector) => {
    expect(reducido).toContain(selector);
    expect(reducido).toMatch(/animation:\s*none/);
  });

  it('el desplazamiento al pasar el raton o pulsar tambien se quita', () => {
    expect(reducido).toMatch(/transform:\s*none/);
  });
});

describe('La barra de arriba no se desborda en un telefono angosto', () => {
  it('hasta 384 px aprieta el aire entre las acciones', () => {
    expect(media('(max-width: 24rem)')).toMatch(/\.app__acciones\s*\{[^}]*gap:\s*0\.5rem/);
  });

  it('hasta 360 px el nombre queda solo para el lector de pantalla', () => {
    const bloque = media('(max-width: 22.5rem)');

    expect(bloque).toContain('.marca__texto');
    // No `display: none`: el enlace ya tiene su nombre, pero un recorte no lo saca del arbol.
    expect(bloque).not.toMatch(/display:\s*none/);
    expect(bloque).toMatch(/clip-path:\s*inset\(50%\)/);
  });

  it('hasta 288 px (un plegable cerrado) la llama pierde el numero y la barra aprieta sus margenes', () => {
    const bloque = media('(max-width: 18rem)');

    expect(bloque).toMatch(/\.llama__dias\s*\{[^}]*display:\s*none/);
    expect(bloque).toContain('.app__barra-interior');
  });
});
