import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PROPORCION_MAXIMA_DEL_HUECO,
  buscarAncla,
  huecoAlrededorDe,
  ladoDeLaCaja,
  quedaTodoElHueco,
} from './spotlight.ts';

/**
 * Las cuentas del spotlight del tutorial (SCRUM-201).
 *
 * jsdom no calcula el diseno: `getBoundingClientRect` devuelve ceros. Aqui se le da un rectangulo
 * a mano a cada elemento, que es lo unico que estas funciones leen de la pagina.
 */
const VENTANA = { ancho: 400, alto: 800 };

function elemento(
  ancla: string,
  rect: { left: number; top: number; width: number; height: number },
  estilo = '',
): HTMLElement {
  const nodo = document.createElement('div');

  nodo.setAttribute('data-tutorial', ancla);
  nodo.setAttribute('style', estilo);
  vi.spyOn(nodo, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  });
  document.body.append(nodo);

  return nodo;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('buscarAncla', () => {
  it('encuentra el elemento marcado con ese nombre', () => {
    const nodo = elemento('ruta', { left: 10, top: 10, width: 100, height: 50 });

    expect(buscarAncla('ruta')).toBe(nodo);
  });

  it('devuelve null si no hay ninguno', () => {
    expect(buscarAncla('ruta')).toBeNull();
  });

  it('no confunde un nombre con otro', () => {
    elemento('semaforo', { left: 10, top: 10, width: 100, height: 50 });

    expect(buscarAncla('ruta')).toBeNull();
  });

  it('se salta el que no se ve (sin tamano): el que sigue gana', () => {
    // El dock del diario existe en el documento aunque en escritorio no se vea.
    elemento('diario', { left: 0, top: 0, width: 0, height: 0 });
    const visible = elemento('diario', { left: 20, top: 700, width: 60, height: 50 });

    expect(buscarAncla('diario')).toBe(visible);
  });

  it('se salta el que esta oculto aunque tenga tamano', () => {
    elemento('llama', { left: 20, top: 10, width: 40, height: 40 }, 'visibility: hidden');

    expect(buscarAncla('llama')).toBeNull();
  });

  it('si ninguno se ve, devuelve null', () => {
    elemento('diario', { left: 0, top: 0, width: 0, height: 0 });

    expect(buscarAncla('diario')).toBeNull();
  });
});

describe('huecoAlrededorDe', () => {
  it('deja un margen alrededor del elemento', () => {
    const hueco = huecoAlrededorDe({ left: 100, top: 200, width: 120, height: 60 }, VENTANA, 8);

    expect(hueco).toEqual({ x: 92, y: 192, ancho: 136, alto: 76 });
  });

  it('no se sale de la ventana por ningun lado', () => {
    const hueco = huecoAlrededorDe({ left: 2, top: 1, width: 398, height: 799 }, VENTANA, 8);

    expect(hueco.x).toBeGreaterThanOrEqual(0);
    expect(hueco.y).toBeGreaterThanOrEqual(0);
    expect(hueco.x + hueco.ancho).toBeLessThanOrEqual(VENTANA.ancho);
    expect(hueco.y + hueco.alto).toBeLessThanOrEqual(VENTANA.alto);
  });
});

describe('ladoDeLaCaja: la caja de Fungito va del lado donde hay mas sitio', () => {
  it('con el elemento abajo (el dock), la caja va arriba', () => {
    expect(ladoDeLaCaja({ x: 10, y: 700, ancho: 100, alto: 60 }, VENTANA)).toBe('arriba');
  });

  it('con el elemento arriba (la barra), la caja va abajo', () => {
    expect(ladoDeLaCaja({ x: 10, y: 8, ancho: 100, alto: 60 }, VENTANA)).toBe('abajo');
  });

  it('con el elemento justo en medio, abajo (se lee mejor de arriba a abajo)', () => {
    expect(ladoDeLaCaja({ x: 10, y: 370, ancho: 100, alto: 60 }, VENTANA)).toBe('abajo');
  });
});

describe('quedaTodoElHueco', () => {
  it('un elemento pequeno cabe', () => {
    expect(quedaTodoElHueco({ x: 0, y: 0, ancho: 100, alto: 100 }, VENTANA)).toBe(true);
  });

  it('uno que ocupa casi toda la pantalla no deja sitio a la caja: cae al centrado', () => {
    const alto = VENTANA.alto * PROPORCION_MAXIMA_DEL_HUECO + 1;

    expect(quedaTodoElHueco({ x: 0, y: 0, ancho: 100, alto }, VENTANA)).toBe(false);
  });
});
