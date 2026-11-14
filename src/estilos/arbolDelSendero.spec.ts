import { describe, expect, it } from 'vitest';

import { ALTO_DE_FILA, ALTO_DE_FILA_DE_HOY } from '../paginas/sendero/geometria.ts';
import APLICACION from './aplicacion.css?raw';

/**
 * El arbol (la ruta de 365 dias y el sendero de cada etapa) tiene el tamaño del diseño y sus filas
 * miden lo que mide la traza (SCRUM-310).
 *
 * La traza se dibuja con las cifras de `geometria.ts` en lugar de medir en el navegador, asi que la
 * hoja de estilos tiene que decir lo mismo. Ninguna prueba lo vigilaba: si alguien cambia un lado,
 * la linea deja de pasar por el centro de los puntos sin que nada falle.
 */

const HOJA = APLICACION.replace(/\/\*[\s\S]*?\*\//g, '');

function regla(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const encontrada = new RegExp(String.raw`(?:^|\n)${escapado}\s*\{([^}]*)\}`).exec(HOJA);

  if (encontrada === null) {
    throw new Error(`No hay una regla ${selector} en aplicacion.css`);
  }

  return encontrada[1]!;
}

function px(selector: string, propiedad: 'height' | 'width'): number {
  const medida = new RegExp(String.raw`(?:^|[\s;])${propiedad}:\s*(\d+)px`).exec(regla(selector));

  if (medida === null) {
    throw new Error(`${selector} no dice su ${propiedad} en pixeles`);
  }

  return Number(medida[1]);
}

/** El aro que rodea el punto de hoy sobresale 12 px por cada lado (`.sendero__anillo`). */
const AIRE_DEL_ANILLO = 24;

describe('el arbol del sendero', () => {
  it('las filas de la hoja miden lo que mide la traza', () => {
    expect(px('.sendero__fila', 'height')).toBe(ALTO_DE_FILA);
    expect(px('.sendero__fila--hoy', 'height')).toBe(ALTO_DE_FILA_DE_HOY);
  });

  it('es grande: filas de 112 y 156, puntos de 68, hoy de 92 y meta de 82', () => {
    expect(ALTO_DE_FILA).toBeGreaterThanOrEqual(112);
    expect(ALTO_DE_FILA_DE_HOY).toBeGreaterThanOrEqual(156);
    expect(px('.sendero__punto', 'width')).toBeGreaterThanOrEqual(68);
    expect(px('.sendero__punto', 'height')).toBeGreaterThanOrEqual(68);
    expect(px('.sendero__punto--hoy', 'width')).toBeGreaterThanOrEqual(92);
    expect(px('.sendero__punto--hoy', 'height')).toBeGreaterThanOrEqual(92);
    expect(px('.sendero__punto--meta', 'width')).toBeGreaterThanOrEqual(82);
    expect(px('.sendero__punto--meta', 'height')).toBeGreaterThanOrEqual(82);
  });

  it('cada punto cabe en su fila con aire, y el de hoy tambien con su aro', () => {
    expect(ALTO_DE_FILA - px('.sendero__punto--meta', 'height')).toBeGreaterThanOrEqual(24);
    expect(
      ALTO_DE_FILA_DE_HOY - (px('.sendero__punto--hoy', 'height') + AIRE_DEL_ANILLO),
    ).toBeGreaterThanOrEqual(24);
  });

  it('el mapa ocupa todo el ancho de su caja y su ventana llega al 75 % de la pantalla', () => {
    expect(regla('.mapa')).toMatch(/max-width:\s*none/);
    expect(regla('.mapa__ventana')).toMatch(/max-height:\s*min\(40rem,\s*75vh\)/);
  });

  it('las notas del mapa no se estiran con la caja: se siguen leyendo en lineas cortas', () => {
    expect(regla('.mapa .app__nota')).toMatch(/max-width:\s*\d+ch/);
  });

  it('un punto es redondo: ancho y alto iguales', () => {
    for (const selector of ['.sendero__punto', '.sendero__punto--hoy', '.sendero__punto--meta']) {
      expect(px(selector, 'width'), selector).toBe(px(selector, 'height'));
    }
  });
});
