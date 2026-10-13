import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';
import SEMAFORO from './semaforo.css?raw';

/**
 * El rediseno visual del semaforo (SCRUM-183): degradados, sombras suaves y microinteracciones,
 * **sin tocar la logica**.
 *
 * jsdom no pinta, asi que lo que se vigila son las reglas que sostienen el diseno y que son
 * faciles de romper sin darse cuenta: el contraste de las tres luces, que cada una tenga su
 * pareja para el degradado, que nada parpadee ni pulse (un semaforo que se agita alarma),
 * que el movimiento se apague cuando se pide, y que los colores vivan en los tokens.
 */

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

const SEMAFORO_SIN_COMENTARIOS = sinComentarios(SEMAFORO);
const APLICACION_SIN_COMENTARIOS = sinComentarios(APLICACION);

/** El cuerpo de un bloque identificado por su selector exacto (sin media queries anidados). */
function bloque(hoja: string, selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\']/g, String.raw`\$&`);
  const cuerpo = new RegExp(String.raw`(?:^|\n)${escapado}\s*\{([^}]*)\}`).exec(hoja)?.[1];

  if (cuerpo === undefined) {
    throw new Error(`No hay un bloque para ${selector}`);
  }

  return cuerpo;
}

/** Los tokens `--nombre: #hex;` de un cuerpo. */
function colores(cuerpo: string): Record<string, string> {
  return Object.fromEntries(
    [...cuerpo.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

/** Luminancia relativa y contraste, como los define WCAG 2.2. */
function luminancia(hex: string): number {
  const canal = (desde: number) => {
    const valor = parseInt(hex.slice(desde, desde + 2), 16) / 255;

    return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];

  return (claro + 0.05) / (oscuro + 0.05);
}

const NIVELES = ['urgente', 'prioridad', 'aplazable'] as const;

const TEMAS = [
  {
    nombre: 'oscuro',
    semaforo: colores(bloque(SEMAFORO_SIN_COMENTARIOS, '.app')),
    app: colores(bloque(APLICACION_SIN_COMENTARIOS, '.app,\n.actividad')),
  },
  {
    nombre: 'claro',
    semaforo: colores(bloque(SEMAFORO_SIN_COMENTARIOS, ":root[data-tema='claro'] .app")),
    app: colores(
      bloque(
        APLICACION_SIN_COMENTARIOS,
        ":root[data-tema='claro'] .app,\n:root[data-tema='claro'] .actividad",
      ),
    ),
  },
] as const;

describe('Las tres luces', () => {
  it.each(TEMAS)('en $nombre cada luz tiene su pareja mas clara para el degradado', (tema) => {
    for (const nivel of NIVELES) {
      expect(tema.semaforo[`--semaforo-${nivel}`], `--semaforo-${nivel}`).toBeDefined();
      expect(tema.semaforo[`--semaforo-${nivel}-luz`], `--semaforo-${nivel}-luz`).toBeDefined();
    }
  });

  it.each(TEMAS)('en $nombre se distinguen del fondo de la tarjeta (AA, 4,5:1)', (tema) => {
    const fondo = tema.app['--app-superficie'];

    expect(fondo, 'no se encontro --app-superficie').toBeDefined();

    for (const nivel of NIVELES) {
      const luz = tema.semaforo[`--semaforo-${nivel}`]!;

      expect(contraste(luz, fondo!), `${nivel} en ${tema.nombre}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('las luces encendidas brillan con una sombra de su color, no con un color nuevo', () => {
    for (const nivel of NIVELES) {
      const regla = bloque(SEMAFORO_SIN_COMENTARIOS, `.semaforo-luz--${nivel}`);

      expect(regla).toContain('drop-shadow(');
      expect(regla).toContain(`var(--semaforo-${nivel})`);
    }
  });

  it('el punto de cada nivel es un degradado entre su pareja y su color', () => {
    for (const nivel of NIVELES) {
      const regla = bloque(SEMAFORO_SIN_COMENTARIOS, `.semaforo-punto--${nivel}`);

      expect(regla).toContain('radial-gradient(');
      expect(regla).toContain(`var(--semaforo-${nivel}-luz)`);
      expect(regla).toContain(`var(--semaforo-${nivel})`);
    }
  });
});

describe('Nada alarma', () => {
  it('ninguna animacion se repite sin fin: un semaforo que pulsa o parpadea inquieta', () => {
    expect(SEMAFORO_SIN_COMENTARIOS).not.toMatch(/\binfinite\b/);
  });

  it('el rojo de «urgente» no se usa como color de alarma en el fondo de una tarjeta', () => {
    // Las tarjetas se tiñen con una mezcla muy leve (menos del 15 %) del color de su nivel.
    const lavados = [
      ...SEMAFORO_SIN_COMENTARIOS.matchAll(
        /color-mix\(in srgb, var\(--semaforo-nivel(?:, var\(--[a-z-]+\))?\) (\d+)%/g,
      ),
    ].map((m) => Number(m[1]));

    // La tarjeta de tarea y el recordatorio: las dos se tiñen del color de su nivel.
    expect(lavados.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...lavados)).toBeLessThanOrEqual(15);
  });
});

describe('Con movimiento reducido', () => {
  const reducido = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
    SEMAFORO_SIN_COMENTARIOS,
  )?.[1];

  it('hay un bloque que lo respeta', () => {
    expect(reducido).toBeDefined();
  });

  it.each([
    '.semaforo__boton',
    '.semaforo-tarea',
    '.semaforo__accion',
    '.semaforo-luz',
    '.semaforo-ventana',
  ])('%s no se anima ni se desplaza', (selector) => {
    expect(reducido).toContain(selector);
    expect(reducido).toMatch(/transition:\s*none/);
  });

  it('el desplazamiento al pasar el raton o pulsar tambien se quita', () => {
    expect(reducido).toMatch(/transform:\s*none/);
  });
});

describe('Los colores viven en los tokens', () => {
  it('no hay colores en hexadecimal fuera de los dos bloques de tokens', () => {
    const fuera = SEMAFORO_SIN_COMENTARIOS.replace(
      /(?:^|\n)(?:\.app|:root\[data-tema='claro'\] \.app)\s*\{[^}]*\}/g,
      '',
    );

    expect(fuera.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });
});
