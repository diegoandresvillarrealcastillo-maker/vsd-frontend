import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';

/**
 * Inicio, Progreso y Mi diario se ven y se sienten igual en el computador y en el telefono (SCRUM-284).
 *
 * Son dos piezas distintas (la barra de arriba y el dock de abajo) porque el espacio no es el mismo, pero lo
 * que se **siente** al usarlas tiene que ser una sola cosa. Para que no vuelvan a separarse sin que nadie lo
 * note, cada regla de esa sensacion se escribe **una vez, con los dos selectores juntos**. Si alguien las
 * parte, estas pruebas fallan: no miden pixeles (jsdom no los calcula), miden que la regla sea compartida.
 */

const hoja = APLICACION.replace(/\/\*[\s\S]*?\*\//g, '');

/** Un texto literal como pieza de una expresion regular. */
function literal(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\:]/g, String.raw`\$&`);
}

/** El cuerpo de la regla cuyo selector es exactamente esta lista, al nivel de la hoja. */
function reglaDe(...selectores: string[]): string | undefined {
  const lista = selectores.map(literal).join(String.raw`,\s*`);

  return new RegExp(String.raw`(?:^|\})\s*${lista}\s*\{([^}]*)\}`, 'm')
    .exec(hoja)?.[1]
    ?.replace(/\s+/g, ' ')
    .trim();
}

/** Los bloques de un `@media` con esta condicion, con sus reglas dentro, juntos. */
function bloqueMedia(condicion: string): string {
  const inicios = [
    ...hoja.matchAll(new RegExp(String.raw`@media ${literal(condicion)}\s*\{`, 'g')),
  ];

  return inicios
    .map((inicio) => {
      let profundidad = 1;
      let i = inicio.index + inicio[0].length;

      while (i < hoja.length && profundidad > 0) {
        profundidad += hoja[i] === '{' ? 1 : hoja[i] === '}' ? -1 : 0;
        i += 1;
      }

      return hoja.slice(inicio.index, i);
    })
    .join('\n');
}

const BARRA = '.app__enlace';
const DOCK = '.app__nav-inferior-enlace';

describe('la barra de arriba y el dock comparten lo que se siente (SCRUM-284)', () => {
  it('el color de reposo y la transicion son los mismos', () => {
    const base = reglaDe(BARRA, DOCK);

    expect(base).toBeDefined();
    expect(base).toMatch(/color:\s*var\(--app-tenue\)/);
    expect(base).toMatch(/transition:[^;]*color/);
    expect(base).toMatch(/transition:[^;]*transform/);
  });

  it('el enlace de la seccion a la vista se pinta igual', () => {
    expect(reglaDe(`${BARRA}--activo`, `${DOCK}--activo`)).toMatch(/color:\s*var\(--app-salvia\)/);
  });

  it('al pulsar, los dos se hunden lo mismo', () => {
    expect(reglaDe(`${BARRA}:active`, `${DOCK}:active`)).toMatch(/transform:\s*scale\(0\.9\d\)/);
  });

  it('al pasar el raton, los dos reaccionan igual, y solo donde hay raton', () => {
    const conRaton = bloqueMedia('(hover: hover) and (pointer: fine)');

    expect(conRaton).toMatch(
      /\.app__enlace:hover,\s*\.app__nav-inferior-enlace:hover\s*\{[^}]*color:\s*var\(--app-salvia\)/,
    );
  });

  it('con «reducir movimiento» no se hunden, y las dos lo dicen en el mismo sitio', () => {
    const reducido = bloqueMedia('(prefers-reduced-motion: reduce)');

    expect(reducido).toMatch(
      /\.app__enlace:active,\s*\.app__nav-inferior-enlace:active\s*\{[^}]*transform:\s*none/,
    );
  });

  it('la pastilla que se desliza es una sola pieza para las dos', () => {
    expect(reglaDe('.app__pastilla')).toMatch(/background:\s*var\(--app-superficie-alta\)/);
    expect(hoja).not.toContain('app__nav-inferior-pastilla');
  });
});
