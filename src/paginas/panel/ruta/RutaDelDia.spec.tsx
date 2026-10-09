import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
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

  it('lo hecho dice que esta hecho y no es un enlace', () => {
    pintar(PROGRESO);

    expect(screen.getByText('Hecha hoy')).toBeInTheDocument();
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
