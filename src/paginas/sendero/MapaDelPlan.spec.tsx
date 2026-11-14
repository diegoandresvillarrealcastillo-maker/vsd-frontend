import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { fallosDeAccesibilidad } from '../../pruebas/axe.ts';
import { Icono } from '../panel/Icono.tsx';
import { ALTO_DE_FILA, ALTO_DE_FILA_DE_HOY } from './geometria.ts';
import { MapaDelPlan } from './MapaDelPlan.tsx';

/**
 * El mapa de los 365 dias de un modulo (SCRUM-293), con la pantalla de verdad y sin API.
 */
const SUENO = '0acd0000-0000-4000-8000-000000000002';
const ESTIRAR = '0acd0000-0000-4000-8000-000000000003';
const RESPIRAR = '0acd0000-0000-4000-8000-00000000000b';

/** Tres dias hechos y nada todavia hoy. */
const BIENESTAR: ProgresoDelModulo = {
  modulo: 'bienestar',
  sesiones: 3,
  etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
  hoy: [
    { id: SUENO, nombre: 'Cómo dormiste anoche', hecha: false },
    { id: ESTIRAR, nombre: 'Estiramientos', hecha: false },
  ],
  sugeridas: [{ id: RESPIRAR, nombre: 'Respiración guiada', hecha: false }],
};

const usuario = userEvent.setup({ delay: null });

function pintar(progreso: ProgresoDelModulo = BIENESTAR) {
  return render(
    <MemoryRouter>
      <MapaDelPlan progreso={progreso} titulo="Bienestar" />
    </MemoryRouter>,
  );
}

function ventana() {
  return screen.getByRole('region', { name: 'Ruta de 365 días de Bienestar' });
}

describe('MapaDelPlan', () => {
  it('muestra los 365 dias desde el primero, sin esperar a llegar', () => {
    pintar();

    const dias = within(ventana()).getByRole('list');

    expect(within(dias).getAllByRole('listitem')).toHaveLength(365);
    expect(screen.getByRole('img', { name: 'Día 365, la meta del plan, por hacer' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Día 40, por hacer' })).toBeVisible();
  });

  it('dice en que dia va, sin contar nada por su cuenta', () => {
    pintar();

    expect(screen.getByText('Día 4 de 365')).toBeInTheDocument();
    expect(screen.getByText('Tu ruta de 365 días')).toBeInTheDocument();
  });

  it('los dias hechos y hoy se pueden abrir; los que faltan, solo se ven', () => {
    pintar();

    const mapa = within(ventana());

    expect(mapa.getAllByRole('button')).toHaveLength(4);
    expect(mapa.getAllByRole('img')).toHaveLength(361);
    expect(mapa.getByRole('button', { name: /Día 1, hecho/ })).toBeInTheDocument();
    expect(mapa.getByRole('button', { name: /^Hoy, día 4: 0 de 2/ })).toBeInTheDocument();
  });

  describe('un arbol con vida (SCRUM-310)', () => {
    /** Dieciseis dias hechos y nada todavia hoy: hoy es el 17. */
    const DIECISEIS: ProgresoDelModulo = { ...BIENESTAR, sesiones: 16 };

    function dibujoDeUnIcono(nombre: Parameters<typeof Icono>[0]['nombre']): string {
      return render(<Icono nombre={nombre} />).container.querySelector('svg')!.innerHTML;
    }

    it('cada 7.º dia hecho es un hito: lleva el icono del modulo y no el check', () => {
      pintar(DIECISEIS);

      const mapa = within(ventana());

      for (const dia of [7, 14]) {
        const hito = mapa.getByRole('button', { name: new RegExp(`^Día ${String(dia)}, hecho`) });

        expect(hito).toHaveClass('sendero__punto--hito');
        expect(hito.querySelector('svg')!.innerHTML).toBe(dibujoDeUnIcono('leaf'));
      }
    });

    it('los demas dias hechos siguen con su check, y el hito dice lo mismo que cualquier dia hecho', () => {
      pintar(DIECISEIS);

      const mapa = within(ventana());
      const normal = mapa.getByRole('button', { name: /^Día 6, hecho/ });

      expect(normal).not.toHaveClass('sendero__punto--hito');
      expect(normal.querySelector('svg')!.innerHTML).toBe(dibujoDeUnIcono('check'));
      expect(mapa.getByRole('button', { name: 'Día 7, hecho. Ver y repetir' })).toBeInTheDocument();
      expect(mapa.getAllByRole('button')).toHaveLength(17);
    });

    it('un hito aun por hacer no se adelanta: sigue siendo un numero quieto', () => {
      pintar(DIECISEIS);

      const futuro = within(ventana()).getByRole('img', { name: 'Día 21, por hacer' });

      expect(futuro).not.toHaveClass('sendero__punto--hito');
      expect(futuro).toHaveTextContent('21');
    });

    it('el icono del hito es el del modulo de cada pestaña', () => {
      pintar({ ...DIECISEIS, modulo: 'cognicion' });

      const hito = within(ventana()).getByRole('button', { name: /^Día 7, hecho/ });

      expect(hito.querySelector('svg')!.innerHTML).toBe(dibujoDeUnIcono('brain'));
    });

    it('el fondo animado va fuera de la ventana que se desplaza, y es el del modulo', () => {
      const { container } = pintar({ ...DIECISEIS, modulo: 'emociones' });

      const fondo = container.querySelector('.mapa-fondo');

      expect(fondo).toHaveClass('mapa-fondo--emociones');
      expect(ventana().contains(fondo)).toBe(false);
      expect(fondo?.parentElement).toBe(ventana().parentElement);
    });
  });

  it('lleva la vista al dia activo sola, sin bajar desde el dia 1 (checkpoint)', () => {
    pintar();

    // En jsdom nada mide: la ventana tiene alto 0 y el punto de hoy queda arriba del todo.
    expect(ventana().scrollTop).toBe(3 * ALTO_DE_FILA + ALTO_DE_FILA_DE_HOY / 2);
  });

  it('un dia hecho se abre y deja repetir lo que se quiera, avisando que no mueve los dias hechos', async () => {
    pintar();

    await usuario.click(within(ventana()).getByRole('button', { name: /Día 2, hecho/ }));

    const hoja = screen.getByRole('dialog', { name: 'Día 2' });

    expect(hoja).toHaveTextContent('Ya completaste este día');
    expect(hoja).toHaveTextContent('los días ya hechos no cambian');
    expect(
      within(hoja).getByRole('link', { name: 'Repetir Cómo dormiste anoche' }),
    ).toHaveAttribute('href', `/actividad/${SUENO}`);
    // Las sugeridas tambien: se puede repetir cualquiera del modulo.
    expect(within(hoja).getByRole('link', { name: 'Repetir Respiración guiada' })).toHaveAttribute(
      'href',
      `/actividad/${RESPIRAR}`,
    );
  });

  it('el dia hecho se cierra con Escape y el foco vuelve a su punto', async () => {
    pintar();

    const punto = within(ventana()).getByRole('button', { name: /Día 2, hecho/ });

    await usuario.click(punto);
    expect(screen.getByRole('dialog', { name: 'Día 2' })).toBeInTheDocument();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(punto).toHaveFocus();
  });

  it('un modulo sin actividades que repetir lo dice con calma', async () => {
    pintar({ ...BIENESTAR, hoy: [], sugeridas: [] });

    await usuario.click(within(ventana()).getByRole('button', { name: /Día 1, hecho/ }));

    expect(screen.getByRole('dialog', { name: 'Día 1' })).toHaveTextContent(
      'No hay nada para repetir por ahora.',
    );
  });

  it('el punto de hoy abre lo de hoy, y el boton de arriba hace lo mismo', async () => {
    pintar();

    await usuario.click(within(ventana()).getByRole('button', { name: /^Hoy, día 4/ }));
    expect(screen.getByRole('dialog', { name: 'Lo de hoy' })).toBeInTheDocument();

    await usuario.keyboard('{Escape}');
    await usuario.click(screen.getByRole('button', { name: /Ver lo de hoy · 0 de 2/ }));

    expect(screen.getByRole('dialog', { name: 'Lo de hoy' })).toBeInTheDocument();
  });

  it('con algo hecho hoy, hoy cuenta como dia hecho y sigue siendo el mismo dia', () => {
    pintar({
      ...BIENESTAR,
      sesiones: 4,
      hoy: [{ id: SUENO, nombre: 'Cómo dormiste anoche', hecha: true }],
    });

    expect(screen.getByText('Día 4 de 365')).toBeInTheDocument();
    expect(
      within(ventana()).getByRole('button', { name: /^Hoy, día 4: 1 de 1/ }),
    ).toBeInTheDocument();
    expect(within(ventana()).getAllByRole('button')).toHaveLength(4);
  });

  it('al pasar el dia 365 empieza otra vuelta y lo dice', () => {
    pintar({ ...BIENESTAR, sesiones: 400 });

    expect(screen.getByText('Día 36 de 365')).toBeInTheDocument();
    expect(screen.getByText('Vuelta 2 de tu ruta')).toBeInTheDocument();
  });

  it('no tiene fallos de accesibilidad', async () => {
    pintar();

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
