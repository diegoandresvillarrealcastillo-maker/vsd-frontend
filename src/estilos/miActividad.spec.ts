import { describe, expect, it } from 'vitest';

import PANTALLA from '../paginas/miActividad/MiActividad.tsx?raw';
import MI_ACTIVIDAD from './miActividad.css?raw';

/**
 * «Mi actividad» con color y vida por modulo (SCRUM-311).
 *
 * jsdom no pinta ni dispara `:hover` ni corre animaciones, asi que se vigila lo que si se puede leer:
 * que el color de cada modulo llegue a su tarjeta y a su fila, que el efecto de pasar el cursor este
 * escrito donde corresponde, que lo reciente se anime una sola vez y solo con `transform` y `opacity`,
 * y que con «reducir movimiento» no quede ni animacion ni desplazamiento.
 */

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Prettier parte las listas largas en varias lineas: se juntan para poder leerlas con una expresion. */
function plano(texto: string): string {
  return texto.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ ,/g, ',');
}

const HOJA = plano(sinComentarios(MI_ACTIVIDAD));

/** El texto de un `@media` por su condicion, con las llaves de sus reglas. */
function medio(condicion: string): string {
  const inicio = HOJA.indexOf(`@media ${condicion} {`);

  if (inicio === -1) {
    throw new Error(`No hay un @media ${condicion}`);
  }

  let profundidad = 0;

  for (let i = HOJA.indexOf('{', inicio); i < HOJA.length; i++) {
    profundidad += HOJA[i] === '{' ? 1 : HOJA[i] === '}' ? -1 : 0;

    if (profundidad === 0) {
      return HOJA.slice(inicio, i + 1);
    }
  }

  throw new Error(`El @media ${condicion} no cierra`);
}

/**
 * El cuerpo de la primera regla cuyo selector es exactamente este: la base, porque las de los `@media`
 * vienen despues en la hoja. Se mira desde atras (`(?<=...)`) para que el `}` de una regla sirva
 * tambien de inicio de la siguiente y ninguna se salte.
 */
function regla(selector: string): string {
  const hallada = [...HOJA.matchAll(/(?<=^|\})\s*([^{}@]+)\{([^{}]*)\}/g)].find(
    ([, selectores]) => selectores!.trim() === selector,
  );

  if (hallada === undefined) {
    throw new Error(`No hay una regla ${selector}`);
  }

  return hallada[2]!;
}

describe('la tarjeta de cada modulo lleva su color', () => {
  it('tiene contorno del color del modulo y un fondo teñido que no le resta lectura al texto', () => {
    const tarjeta = regla('.mi-actividad__modulo');

    expect(tarjeta).toMatch(/border: 1\.5px solid color-mix\(in srgb, var\(--modulo-acento\)/);
    // Se mezcla hacia la superficie y no hacia otro color: asi el fondo nunca es mas claro (en oscuro)
    // ni mas oscuro (en claro) que el de las parejas de texto y acento que `paletaVivaYLegible` mide.
    expect(tarjeta).toMatch(
      /background: color-mix\(in srgb, var\(--modulo-fondo\) \d+%, var\(--app-superficie\)\)/,
    );
  });

  it('el icono tiene un halo del color del modulo', () => {
    expect(regla('.mi-actividad__icono')).toMatch(
      /box-shadow: 0 0 0 4px color-mix\(in srgb, var\(--modulo-acento\)/,
    );
  });

  it('la cifra de sesiones se ve en grande y con el acento del modulo', () => {
    const cifra = regla('.mi-actividad__modulo-numero');

    expect(cifra).toContain('color: var(--modulo-acento)');
    expect(Number(/font-size: ([\d.]+)rem/.exec(cifra)?.[1])).toBeGreaterThanOrEqual(1.5);
  });

  it('cada actividad de la lista lleva una barra lateral del color de su modulo', () => {
    expect(regla('.mi-actividad__hecho')).toContain('border-left: 4px solid var(--modulo-acento)');
  });
});

describe('el cursor y los toques', () => {
  const CON_CURSOR = '(hover: hover) and (pointer: fine)';

  it('pasar el cursor por una tarjeta o una fila las enciende con el color del modulo', () => {
    const conCursor = medio(CON_CURSOR);

    expect(conCursor).toMatch(
      /\.mi-actividad__modulo:hover \{[^}]*border-color: var\(--modulo-acento\)/,
    );
    expect(conCursor).toMatch(
      /\.mi-actividad__hecho:hover \{[^}]*border-color: var\(--modulo-acento\)/,
    );
    expect(conCursor).toContain('transform: translateY(-2px)');
    expect(conCursor).toContain('transform: translateX(3px)');
    expect(conCursor).toMatch(
      /\.mi-actividad__modulo:hover \.mi-actividad__icono[^{]*\{[^}]*scale: 1\.1/,
    );
  });

  it('todo `:hover` esta dentro de «hay cursor de verdad»: en el telefono no se queda pegado', () => {
    const sinCursor = HOJA.replace(medio(CON_CURSOR), '').replace(
      medio(`(prefers-reduced-motion: reduce) and ${CON_CURSOR}`),
      '',
    );

    expect(HOJA).toContain(':hover');
    expect(sinCursor).not.toContain(':hover');
  });
});

describe('lo recien hecho', () => {
  const RECIENTES = '.mi-actividad__modulo--reciente, .mi-actividad__hecho--reciente';
  const ARO_DE_LO_RECIENTE =
    '.mi-actividad__modulo--reciente::after, .mi-actividad__hecho--reciente::after';

  it('se anima una sola vez: un pop de la tarjeta y un aro que se desvanece', () => {
    // ` 1 ` es el numero de veces; asi no se confunde con el `1` de `1.56` de la curva.
    expect(regla(RECIENTES)).toMatch(/animation: mi-actividad-pop [^;]* 1 /);
    expect(regla(ARO_DE_LO_RECIENTE)).toMatch(/animation: mi-actividad-aro [^;]* 1 /);
    // Nada que se repita sin parar: eso distrae y cansa.
    expect(HOJA).not.toContain('infinite');
  });

  it('sin movimiento igual se nota: el contorno queda en el color del modulo', () => {
    expect(regla(RECIENTES)).toContain('border-color: var(--modulo-acento)');
  });

  it('las animaciones solo mueven `transform` y `opacity`', () => {
    const cuerpos = [...HOJA.matchAll(/@keyframes [\w-]+ \{((?:[^{}]*\{[^}]*\})+)\s*\}/g)];

    expect(cuerpos.map(([, cuerpo]) => cuerpo).length).toBeGreaterThanOrEqual(2);

    for (const [, cuerpo] of cuerpos) {
      const propiedades = [...cuerpo!.matchAll(/([a-z-]+):/g)].map((m) => m[1]);

      expect(propiedades.length).toBeGreaterThan(0);

      for (const propiedad of propiedades) {
        expect(['transform', 'opacity']).toContain(propiedad);
      }
    }
  });
});

describe('reducir movimiento', () => {
  it('quita las animaciones de lo reciente y deja el aro sin verse', () => {
    const sinMovimiento = medio('(prefers-reduced-motion: reduce)');

    expect(sinMovimiento).toMatch(
      /\.mi-actividad__modulo--reciente,\s*\.mi-actividad__hecho--reciente \{[^}]*animation: none/,
    );
    expect(sinMovimiento).toMatch(
      /--reciente::after,[^{]*--reciente::after \{[^}]*animation: none;[^}]*opacity: 0/,
    );
  });

  it('las transiciones solo cambian color y sombra, sin desplazar ni escalar', () => {
    const sinMovimiento = medio('(prefers-reduced-motion: reduce)');

    expect(sinMovimiento).toMatch(/transition-property: box-shadow, border-color/);
    expect(sinMovimiento).not.toContain('scale(');
  });

  it('y el icono tampoco crece al pasar el cursor', () => {
    expect(HOJA).toMatch(
      /@media \(prefers-reduced-motion: reduce\) and \(hover: hover\) and \(pointer: fine\) \{[^@]*\.mi-actividad__icono \{[^}]*scale: none/,
    );
  });

  it('y el `:hover` sin desplazamiento tambien se queda dentro de «hay cursor»', () => {
    expect(HOJA).toMatch(
      /@media \(prefers-reduced-motion: reduce\) and \(hover: hover\) and \(pointer: fine\) \{[^@]*\.mi-actividad__modulo:hover,[^{]*\{[^}]*transform: none/,
    );
  });
});

describe('la hoja', () => {
  it('no trae colores propios: todo sale de los tokens, y por eso sirve en claro y en oscuro', () => {
    expect(HOJA).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  const CLASES = [
    ...new Set([...HOJA.matchAll(/\.(mi-actividad__[a-z-]+(?:--[a-z]+)?)/g)].map((m) => m[1]!)),
  ];

  it.each(CLASES)('la clase .%s existe en la pantalla', (clase) => {
    expect(PANTALLA, `.${clase} no esta en MiActividad.tsx`).toContain(clase);
  });
});
