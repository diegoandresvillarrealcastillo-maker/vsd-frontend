import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import catalogo from '../pictogramas/pictogramasDelCatalogo.json';
import {
  CLAVES_DE_ESTIRAMIENTO,
  existeLaFigura,
  FIGURAS_DE_ESTIRAMIENTO,
} from './estiramientos.tsx';
import { FiguraDeEstiramiento } from './FiguraDeEstiramiento.tsx';

/**
 * Las 48 figuras de estiramiento (SCRUM-226): seis zonas de ocho gestos, con la clave `zona:gesto` que el
 * catalogo de Bienestar pone en cada paso de «Pausa de estiramiento».
 *
 * `pictogramasDelCatalogo.json` es la copia de la lista que exporta el backend: si una sesion nombra una figura
 * que aqui no existe, se pinta una ficha neutra y el paso se sigue por su texto, pero mejor que no pase.
 */
const ZONAS = ['cuello', 'hombros', 'manos', 'espalda', 'piernas', 'ojos'];

function marcado(clave: string): string {
  const { container } = render(<FiguraDeEstiramiento clave={clave} />);

  return container.innerHTML;
}

describe('la biblioteca de figuras de estiramiento', () => {
  it('son 48, seis zonas de ocho gestos, sin repetir', () => {
    expect(CLAVES_DE_ESTIRAMIENTO).toHaveLength(48);
    expect(new Set(CLAVES_DE_ESTIRAMIENTO).size).toBe(48);

    for (const zona of ZONAS) {
      expect(
        CLAVES_DE_ESTIRAMIENTO.filter((clave) => clave.startsWith(`${zona}:`)),
        zona,
      ).toHaveLength(8);
    }
  });

  it('cada clave de la lista del catalogo tiene su dibujo, y no sobra ninguno', () => {
    expect([...CLAVES_DE_ESTIRAMIENTO].sort()).toEqual([...catalogo.figuras].sort());
  });

  it('existeLaFigura distingue lo que hay de lo que no, y no se confunde con el prototipo del objeto', () => {
    expect(existeLaFigura('cuello:inclinar-der')).toBe(true);
    expect(existeLaFigura('cuello:volar')).toBe(false);
    expect(existeLaFigura('constructor')).toBe(false);
    expect(existeLaFigura('')).toBe(false);
  });

  it.each(CLAVES_DE_ESTIRAMIENTO)('%s se dibuja, con trazos, sin numeros rotos', (clave) => {
    const dibujo = marcado(clave);

    expect(dibujo).toContain('<svg');
    expect(dibujo).toContain('<path');
    expect(dibujo).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('ningun par de gestos se dibuja igual: cada uno se distingue de los demas', () => {
    const dibujos = new Map<string, string>();

    for (const clave of CLAVES_DE_ESTIRAMIENTO) {
      const dibujo = marcado(clave).replace(/data-figura="[^"]*"/, '');
      const repetido = dibujos.get(dibujo);

      expect(repetido, `${clave} se dibuja igual que ${repetido ?? ''}`).toBeUndefined();
      dibujos.set(dibujo, clave);
    }
  });

  it('los gestos de un lado y del otro son espejo: no iguales', () => {
    for (const par of [
      ['cuello:inclinar-der', 'cuello:inclinar-izq'],
      ['cuello:girar-der', 'cuello:girar-izq'],
      ['hombros:cruzar-der', 'hombros:cruzar-izq'],
      ['espalda:torcer-der', 'espalda:torcer-izq'],
      ['espalda:inclinar-der', 'espalda:inclinar-izq'],
    ] as const) {
      expect(marcado(par[0]), par.join(' / ')).not.toBe(marcado(par[1]));
    }
  });

  it('las flechas de la derecha van a la derecha y las de la izquierda a la izquierda', () => {
    const x = (clave: string) => {
      const flechas = [
        ...(/class="fig-marca" d="M([\d.-]+) [\d.-]+ L([\d.-]+)/.exec(marcado(clave)) ?? []),
      ];

      return [Number(flechas[1]), Number(flechas[2])] as const;
    };

    const [desdeDer, haciaDer] = x('cuello:girar-der');
    const [desdeIzq, haciaIzq] = x('cuello:girar-izq');

    expect(haciaDer).toBeGreaterThan(desdeDer);
    expect(haciaIzq).toBeLessThan(desdeIzq);
  });

  it('todas caben en el lienzo de 64 x 64', () => {
    for (const clave of CLAVES_DE_ESTIRAMIENTO) {
      const numeros = [...marcado(clave).matchAll(/ (?:d|points)="([^"]*)"/g)]
        .flatMap(([, d]) => (d ?? '').match(/-?\d+(?:\.\d+)?/g) ?? [])
        .map(Number);

      // Las rotaciones de la cabeza y los arcos no son coordenadas: se mira que ninguna este lejos del lienzo.
      expect(Math.max(...numeros), clave).toBeLessThanOrEqual(70);
      expect(Math.min(...numeros), clave).toBeGreaterThanOrEqual(-6);
    }
  });
});

describe('FiguraDeEstiramiento', () => {
  it('es adorno: no se anuncia y no recibe el foco', () => {
    const { container } = render(<FiguraDeEstiramiento clave="manos:oracion" tamano={96} />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('width', '96');
    expect(svg).toHaveAttribute('data-figura', 'manos:oracion');
  });

  it('una clave que no conoce se pinta como una ficha neutra, y el paso se sigue por su texto', () => {
    const { container } = render(<FiguraDeEstiramiento clave="cuello:volar" />);

    expect(container.querySelector('svg')).toHaveAttribute('data-forma', 'ficha');
    expect(container.querySelector('[data-figura]')).toBeNull();
  });

  it('«constructor» no es una figura, aunque el objeto tenga uno', () => {
    const { container } = render(<FiguraDeEstiramiento clave="constructor" />);

    expect(container.querySelector('svg')).toHaveAttribute('data-forma', 'ficha');
  });

  it('cada figura es una funcion que dibuja siempre lo mismo', () => {
    for (const dibujo of Object.values(FIGURAS_DE_ESTIRAMIENTO)) {
      const a = render(<svg>{dibujo()}</svg>).container.innerHTML;
      const b = render(<svg>{dibujo()}</svg>).container.innerHTML;

      expect(a).toBe(b);
    }
  });
});
