import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProgresoDelModulo } from '../../../infraestructura/api/progreso.ts';
import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { construirLaRuta } from './construirLaRuta.ts';
import { RutaDelDia } from './RutaDelDia.tsx';

const PROGRESO: ProgresoDelModulo[] = [
  {
    modulo: 'cognicion',
    sesiones: 7,
    etapa: { numero: 2, esTemporada: false, sesionesHechas: 2, sesionesDeLaEtapa: 10 },
    hoy: [
      { id: 'a1', nombre: 'Parejas de cartas', hecha: true },
      { id: 'a2', nombre: 'Secuencia de números', hecha: false },
    ],
  },
  {
    modulo: 'bienestar',
    sesiones: 3,
    etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
    hoy: [{ id: 'a3', nombre: 'Cómo dormiste anoche', hecha: false }],
  },
];

function pintar(progreso: readonly ProgresoDelModulo[], nuevas: readonly string[] = []) {
  return render(
    <MemoryRouter>
      <RutaDelDia ruta={construirLaRuta(progreso)} nuevas={new Set(nuevas)} />
    </MemoryRouter>,
  );
}

function completo(): ProgresoDelModulo[] {
  return PROGRESO.map((uno) => ({
    ...uno,
    hoy: uno.hoy.map((actividad) => ({ ...actividad, hecha: true })),
  }));
}

describe('RutaDelDia', () => {
  it('sin actividades dice donde aparecera lo de cada dia', () => {
    pintar([]);

    expect(screen.getByRole('heading', { name: 'Tu ruta de hoy' })).toBeInTheDocument();
    expect(screen.getByText(/aquí aparecerá lo que te toca cada día/)).toBeInTheDocument();
    // Es un estado vacio de verdad (SCRUM-180): invita, no interrumpe ni reclama.
    expect(
      screen.getByText('Todavía no hay nada para hoy').closest('.estado-vacio'),
    ).not.toBeNull();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('agrupa las actividades por modulo, con su etapa', () => {
    pintar(PROGRESO);

    const cognicion = screen.getByRole('list', { name: 'Actividades de hoy en Cognición' });
    const bienestar = screen.getByRole('list', { name: 'Actividades de hoy en Bienestar' });

    expect(within(cognicion).getAllByRole('listitem')).toHaveLength(2);
    expect(within(bienestar).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(/Etapa 2 · 2 de 10 sesiones/)).toBeInTheDocument();
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
  });

  it('lo hecho dice que esta hecho y se puede volver a hacer: no hay tope diario (SCRUM-184)', () => {
    pintar(PROGRESO);

    expect(screen.getByText('Hecha hoy')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Hecha hoy: Parejas de cartas. Hacer otra vez' }),
    ).toHaveAttribute('href', '/actividad/a1');
    // Repetirla no cambia lo que cuenta el plan: sigue siendo 1 de 3.
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
    // «Empezar» sigue siendo solo de lo que falta.
    expect(
      screen.queryByRole('link', { name: 'Empezar Parejas de cartas' }),
    ).not.toBeInTheDocument();
  });

  it('lo que falta lleva a su actividad, y la siguiente se anuncia con un globo', () => {
    pintar(PROGRESO);

    expect(screen.getByRole('link', { name: 'Empezar Secuencia de números' })).toHaveAttribute(
      'href',
      '/actividad/a2',
    );
    expect(screen.getByRole('link', { name: 'Empezar Cómo dormiste anoche' })).toHaveAttribute(
      'href',
      '/actividad/a3',
    );
    // Solo una es la siguiente: un solo globo.
    expect(screen.getAllByText('Empezar', { selector: '.ruta__globo' })).toHaveLength(1);
  });

  it('cada estado se distingue por algo mas que el color', () => {
    pintar(PROGRESO);

    const lista = screen.getByRole('list', { name: 'Actividades de hoy en Cognición' });
    const hecha = lista.querySelector('.ruta__nodo--hecha');
    const siguiente = lista.querySelector('.ruta__nodo--siguiente');

    // Un icono distinto en cada uno (marca de hecho / triangulo de empezar).
    expect(hecha?.querySelector('svg path')?.getAttribute('d')).not.toBe(
      siguiente?.querySelector('svg path')?.getAttribute('d'),
    );
    // Y un texto: lo hecho lo dice, lo que toca ahora lo dice el globo.
    expect(hecha).toHaveTextContent('Hecha hoy');
  });

  it('la meta esta cerrada hasta que se hace todo, y lo dice sin presionar', () => {
    pintar(PROGRESO);

    const meta = screen.getByRole('list', { name: 'Meta del día' });

    expect(within(meta).getByText('Meta de hoy')).toBeInTheDocument();
    expect(within(meta).getByText('Se abre al terminar tu ruta')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('con todo hecho la meta se logra, se anuncia sin interrumpir y no queda nada por empezar', () => {
    pintar(completo());

    expect(screen.getByText('¡Lo lograste hoy!')).toBeInTheDocument();
    expect(screen.getByText('Descansar también es cuidarte')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Terminaste tu ruta de hoy.');
    expect(screen.queryByRole('link', { name: /Empezar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lo que se acaba de hacer suelta una onda; lo de antes, no', () => {
    const { container } = pintar(completo(), ['a2']);

    // Solo a2 es nuevo: una sola onda, en una sola fila.
    expect(container.querySelectorAll('.ruta__destello')).toHaveLength(1);
    expect(container.querySelectorAll('.ruta__nodo--recien')).toHaveLength(1);
  });

  it('el confeti sale solo cuando el plan se completa ahora, no al abrir uno ya completo', () => {
    const sinNuevas = pintar(completo());

    expect(sinNuevas.container.querySelector('.confeti')).toBeNull();
    sinNuevas.unmount();

    const conNuevas = pintar(completo(), ['a3']);

    expect(conNuevas.container.querySelector('.confeti')).not.toBeNull();
  });

  it('ningun texto de la ruta reprocha o presiona', () => {
    const { container } = pintar(PROGRESO);

    expect(container.textContent).not.toMatch(/falt[ao]|no has|perdiste|racha|último día|ya casi/i);
  });

  it('no tiene fallos de accesibilidad', async () => {
    const { container } = pintar(PROGRESO);

    expect(await fallosDeAccesibilidad(container)).toEqual([]);
  });
});

/**
 * El camino se desplaza dentro de su recuadro (SCRUM-250).
 *
 * jsdom no calcula el diseno: ni el alto de nada ni el desplazamiento. Lo que se vigila aqui es la
 * estructura (que el titulo quede fuera de lo que se desplaza) y la decision de a donde se lleva
 * el recuadro al abrir; el alto maximo y las sombras viven en `ruta.css` y se miden en el navegador.
 */
describe('RutaDelDia: el camino se desplaza dentro de su recuadro (SCRUM-250)', () => {
  const ALTO_DEL_RECUADRO = 400;
  const ALTO_DEL_CONTENIDO = 1500;
  const ALTO_DE_LA_FILA = 150;
  // Donde empieza cada fila dentro del contenido: 150 px de cada una mas el titulo del modulo.
  const ARRIBA_DE_LA_SIGUIENTE = 700;

  /** Lo que el recuadro lleva desplazado: el que lee y el que escribe el componente. */
  let desplazamiento = 0;

  function rectangulo(top: number, height: number): DOMRect {
    return {
      top,
      height,
      bottom: top + height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
    } as DOMRect;
  }

  beforeEach(() => {
    desplazamiento = 0;

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.classList.contains('ruta__recorrido')) {
        return rectangulo(0, ALTO_DEL_RECUADRO);
      }

      if (this.classList.contains('ruta__fila')) {
        // La fila de la actividad que toca (o la de la meta) empieza en 700 del contenido, y el
        // contenido se mueve con el desplazamiento: en la ventana esta en 700 menos lo desplazado.
        const laDeAhora = this.querySelector('.ruta__nodo--siguiente, .ruta__nodo--meta') !== null;

        return rectangulo(
          (laDeAhora ? ARRIBA_DE_LA_SIGUIENTE : 0) - desplazamiento,
          ALTO_DE_LA_FILA,
        );
      }

      return rectangulo(0, 0);
    });
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('ruta__recorrido') ? ALTO_DEL_RECUADRO : 0;
    });
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('ruta__recorrido') ? ALTO_DEL_CONTENIDO : 0;
    });
    vi.spyOn(Element.prototype, 'scrollTop', 'get').mockImplementation(() => desplazamiento);
    vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation((valor: number) => {
      desplazamiento = valor;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('el camino va dentro del recuadro y el titulo y el contador, fuera', () => {
    const { container } = pintar(PROGRESO);

    const recuadro = container.querySelector('.ruta__recorrido');

    expect(recuadro).not.toBeNull();
    expect(recuadro?.querySelector('.ruta__camino')).not.toBeNull();
    expect(recuadro?.querySelector('.ruta__cabecera')).toBeNull();
    expect(container.querySelector('.ruta__cabecera')?.closest('.ruta__recorrido')).toBeNull();
  });

  it('sin actividades no hay recuadro que desplazar', () => {
    const { container } = pintar([]);

    expect(container.querySelector('.ruta__recorrido')).toBeNull();
  });

  it('al abrir, lleva el recuadro hasta la actividad que toca, centrada', () => {
    pintar(PROGRESO);

    // Su mitad esta en 700 + 75 = 775; con 200 px de cada lado, el recuadro arranca en 575.
    expect(desplazamiento).toBe(575);
  });

  it('con todo hecho, no hay nada que empezar y lleva el recuadro hasta la meta', () => {
    pintar(completo());

    // En este montaje la fila de la meta tambien empieza en 700: se centra igual que la otra.
    expect(desplazamiento).toBe(575);
  });

  it('no mueve la pagina: no usa scrollIntoView', () => {
    const alVer = vi.fn();
    const original = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = alVer;

    try {
      pintar(PROGRESO);

      expect(alVer).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('si la actividad que toca esta arriba, el recuadro se queda arriba', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.classList.contains('ruta__recorrido')
        ? rectangulo(0, ALTO_DEL_RECUADRO)
        : rectangulo(20, ALTO_DE_LA_FILA);
    });

    pintar(PROGRESO);

    expect(desplazamiento).toBe(0);
  });
});
