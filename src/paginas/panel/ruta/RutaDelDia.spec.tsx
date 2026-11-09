import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../../infraestructura/api/progreso.ts';
import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { construirLaRuta } from './construirLaRuta.ts';
import { RutaDelDia } from './RutaDelDia.tsx';

const { consultarSesionesPublicadas, consultarSesionesHechas } = vi.hoisted(() => ({
  consultarSesionesPublicadas: vi.fn(),
  consultarSesionesHechas: vi.fn(),
}));
vi.mock('../../../infraestructura/api/sesionesPublicadas.ts', () => ({
  consultarSesionesPublicadas,
  consultarSesionesHechas,
}));
consultarSesionesHechas.mockResolvedValue([]);
consultarSesionesPublicadas.mockImplementation((modulo: string) =>
  Promise.resolve([
    {
      id: `sesion-${modulo}`,
      idActividad: 'a2',
      titulo: 'Secuencia de números',
      actividad: 'Secuencia',
      nivel: 1,
    },
  ]),
);

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

function pintar(
  progreso: readonly ProgresoDelModulo[],
  {
    nuevas = [],
    desplegado = null,
    alAlternar = vi.fn(),
  }: {
    nuevas?: readonly string[];
    desplegado?: Modulo | null;
    alAlternar?: (m: Modulo) => void;
  } = {},
) {
  return render(
    <MemoryRouter>
      <RutaDelDia
        ruta={construirLaRuta(progreso)}
        nuevas={new Set(nuevas)}
        desplegado={desplegado}
        alAlternar={alAlternar}
      />
    </MemoryRouter>,
  );
}

function completo(): ProgresoDelModulo[] {
  return PROGRESO.map((uno) => ({
    ...uno,
    hoy: uno.hoy.map((actividad) => ({ ...actividad, hecha: true })),
  }));
}

function pestana(nombre: RegExp) {
  return screen.getByRole('button', { name: nombre });
}

describe('RutaDelDia', () => {
  it('sin modulos activos dice donde aparecera lo de cada dia', () => {
    pintar([]);

    expect(screen.getByRole('heading', { name: 'Tu ruta de hoy' })).toBeInTheDocument();
    expect(screen.getByText(/aquí aparecerá lo que te toca cada día/)).toBeInTheDocument();
    // Es un estado vacio de verdad (SCRUM-180): invita, no interrumpe ni reclama.
    expect(
      screen.getByText('Todavía no hay nada para hoy').closest('.estado-vacio'),
    ).not.toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra juntos los modulos activos, cada uno con lo que le toca hoy', () => {
    pintar(PROGRESO);

    expect(pestana(/Cognición/)).toHaveTextContent('Hoy: Secuencia de números');
    expect(pestana(/Bienestar/)).toHaveTextContent('Hoy: Cómo dormiste anoche');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
  });

  it('cada modulo dice en que dia de sus 365 va', () => {
    pintar(PROGRESO);

    // Cognicion ya hizo algo hoy: las 7 sesiones incluyen a hoy, que es el dia 7.
    expect(pestana(/Cognición/)).toHaveTextContent('Día 7 de 365');
    expect(pestana(/Bienestar/)).toHaveTextContent('Día 4 de 365');
  });

  it('un modulo con todo hecho lo dice sin presionar', () => {
    pintar(completo());

    expect(pestana(/Cognición/)).toHaveTextContent('Hoy ya hiciste lo tuyo');
  });

  it('un modulo activo sin nada hoy sigue teniendo su ruta', () => {
    pintar([
      { ...PROGRESO[0]!, hoy: [] },
      { ...PROGRESO[1]!, hoy: [{ id: 'a3', nombre: 'Cómo dormiste anoche', hecha: false }] },
    ]);

    expect(pestana(/Cognición/)).toHaveTextContent('Hoy no te toca nada aquí');
  });

  it('pulsar un modulo avisa cual, y no abre nada por su cuenta', async () => {
    const alAlternar = vi.fn();

    pintar(PROGRESO, { alAlternar });
    await userEvent.click(pestana(/Bienestar/));

    expect(alAlternar).toHaveBeenCalledWith('bienestar');
    expect(pestana(/Bienestar/)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Ruta de 365 días/ })).not.toBeInTheDocument();
  });

  it('el módulo desplegado muestra sus sesiones publicadas, y los demás siguen cerrados', async () => {
    pintar(PROGRESO, { desplegado: 'cognicion' });

    expect(pestana(/Cognición/)).toHaveAttribute('aria-expanded', 'true');
    expect(pestana(/Bienestar/)).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findByRole('region', { name: 'Actividades de cognicion' })).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Actividades de bienestar' }),
    ).not.toBeInTheDocument();
  });

  it('la ruta desplegada permite comenzar una sesión publicada', async () => {
    pintar(PROGRESO, { desplegado: 'cognicion' });

    const arbol = await screen.findByRole('region', { name: 'Actividades de cognicion' });
    await userEvent.click(within(arbol).getByRole('button', { name: /Secuencia(?:,|$)/ }));
    expect(screen.getByRole('link', { name: 'Comenzar Secuencia' })).toHaveAttribute(
      'href',
      '/actividad/a2?sesion=sesion-cognicion',
    );
  });

  it('sin completar no hay logro, ni aviso', () => {
    pintar(PROGRESO);

    expect(screen.queryByText('¡Lo lograste hoy!')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('con todo hecho se logra el dia, se anuncia sin interrumpir', () => {
    pintar(completo());

    expect(screen.getByText('¡Lo lograste hoy!')).toBeInTheDocument();
    expect(screen.getByText('Descansar también es cuidarte')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Terminaste tu ruta de hoy.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el confeti sale solo cuando el plan se completa ahora, no al abrir uno ya completo', () => {
    const sinNuevas = pintar(completo());

    expect(sinNuevas.container.querySelector('.confeti')).toBeNull();
    sinNuevas.unmount();

    const conNuevas = pintar(completo(), { nuevas: ['a3'] });

    expect(conNuevas.container.querySelector('.confeti')).not.toBeNull();
  });

  it('ningun texto de la ruta reprocha o presiona', () => {
    const { container } = pintar(PROGRESO);

    expect(container.textContent).not.toMatch(/falt[ao]|no has|perdiste|racha|último día|ya casi/i);
  });

  it('no tiene fallos de accesibilidad, cerrada ni abierta', async () => {
    const cerrada = pintar(PROGRESO);

    expect(await fallosDeAccesibilidad(cerrada.container)).toEqual([]);
    cerrada.unmount();

    const abierta = pintar(PROGRESO, { desplegado: 'bienestar' });

    expect(await fallosDeAccesibilidad(abierta.container)).toEqual([]);
  });
});
