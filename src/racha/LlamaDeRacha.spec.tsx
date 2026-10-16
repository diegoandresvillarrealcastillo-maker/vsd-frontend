import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NivelDeLaLlama, Racha } from '../infraestructura/api/racha.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { LlamaDeLaBarra, LlamaDeRacha } from './LlamaDeRacha.tsx';
import { olvidarLaRacha } from './memoriaDeLaRacha.ts';

/**
 * La llama de la racha (SCRUM-186).
 *
 * Lo que se vigila es lo que no se puede romper sin que nadie lo note: el nombre accesible
 * dice cuantos dias lleva, el estado de descanso nunca suena a perdida, y el panel explica
 * los congelamientos con palabras de cuidado.
 */
const { consultarLaRacha } = vi.hoisted(() => ({ consultarLaRacha: vi.fn() }));

vi.mock('../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

function racha(cambios: Partial<Racha> = {}): Racha {
  return {
    dias: 12,
    nivel: 1,
    hechoHoy: true,
    enDescanso: false,
    congelamientosUsados: 0,
    congelamientosPorMes: 3,
    diasCubiertos: [],
    ...cambios,
  };
}

const usuario = userEvent.setup({ delay: null });

/** Palabras que nunca deben aparecer: la llama descansa, no se pierde ni se rompe. */
const PALABRAS_DE_CASTIGO = /perdi|rompi|fall|apag|castig|error|racha rota|vuelve a empezar/i;

describe('LlamaDeRacha', () => {
  describe('la llama', () => {
    it.each<[NivelDeLaLlama, number]>([
      [0, 3],
      [1, 7],
      [2, 30],
      [3, 90],
      [4, 365],
    ])('en el nivel %i lleva su clase y dice los dias', (nivel, dias) => {
      const { container } = render(<LlamaDeRacha racha={racha({ nivel, dias })} />);

      expect(container.querySelector(`.llama--nivel-${String(nivel)}`)).not.toBeNull();
      expect(
        screen.getByRole('button', { name: new RegExp(`${String(dias)} días`) }),
      ).toBeInTheDocument();
    });

    it('el degradado tiene tres paradas, para que el nivel de 3 meses tenga un color de en medio (SCRUM-202)', () => {
      const { container } = render(<LlamaDeRacha racha={racha({ nivel: 3, dias: 90 })} />);
      const paradas = [...container.querySelectorAll('linearGradient stop')];

      expect(paradas).toHaveLength(3);
      expect(paradas.map((parada) => parada.getAttribute('style'))).toEqual([
        expect.stringContaining('--llama-base'),
        expect.stringContaining('--llama-media'),
        expect.stringContaining('--llama-punta'),
      ]);
    });

    it('el dibujo de cada nivel sigue siendo decorativo y la llama en descanso no lleva degradado', () => {
      const { container } = render(
        <LlamaDeRacha racha={racha({ dias: 0, nivel: 0, hechoHoy: false, enDescanso: true })} />,
      );

      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('.llama__cuerpo')).toHaveAttribute('fill', 'none');
    });

    it('un dia se dice en singular', () => {
      render(<LlamaDeRacha racha={racha({ dias: 1, nivel: 0 })} />);

      expect(screen.getByRole('button', { name: /1 día seguido/ })).toBeInTheDocument();
    });

    it('el dibujo es decorativo: lo que se anuncia es el boton', () => {
      const { container } = render(<LlamaDeRacha racha={racha()} />);

      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('con la llama en descanso lo dice con calma y no muestra un contador en cero', () => {
      const { container } = render(
        <LlamaDeRacha racha={racha({ dias: 0, nivel: 0, hechoHoy: false, enDescanso: true })} />,
      );

      const boton = screen.getByRole('button');

      expect(boton).toHaveAccessibleName(/descansa/i);
      expect(boton.textContent).not.toMatch(/\b0\b/);
      expect(container.querySelector('.llama--descanso')).not.toBeNull();
    });
  });

  describe('el panel', () => {
    it('empieza cerrado y se abre con un toque', async () => {
      render(<LlamaDeRacha racha={racha({ congelamientosUsados: 1 })} />);

      const boton = screen.getByRole('button');

      expect(boton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('status')).toBeNull();

      await usuario.click(boton);

      expect(boton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('explica los congelamientos del mes, con cuantos quedan', async () => {
      render(<LlamaDeRacha racha={racha({ congelamientosUsados: 1 })} />);

      await usuario.click(screen.getByRole('button'));

      const panel = screen.getByRole('status');

      expect(within(panel).getByText(/1 de 3/)).toBeInTheDocument();
      expect(within(panel).getByText(/quedan 2/i)).toBeInTheDocument();
    });

    it('sin congelamientos usados dice cuantos hay por mes', async () => {
      render(<LlamaDeRacha racha={racha({ congelamientosUsados: 0 })} />);

      await usuario.click(screen.getByRole('button'));

      expect(within(screen.getByRole('status')).getByText(/hasta 3 días/i)).toBeInTheDocument();
    });

    it('si hoy ya sumo, lo dice; si no, invita sin reclamar', async () => {
      const { rerender } = render(<LlamaDeRacha racha={racha({ hechoHoy: true })} />);

      await usuario.click(screen.getByRole('button'));
      expect(within(screen.getByRole('status')).getByText(/hoy ya sumaste/i)).toBeInTheDocument();

      rerender(<LlamaDeRacha racha={racha({ hechoHoy: false })} />);

      expect(
        within(screen.getByRole('status')).getByText(/una actividad hoy/i),
      ).toBeInTheDocument();
    });

    it('se cierra con Escape y devuelve el foco al boton', async () => {
      render(<LlamaDeRacha racha={racha()} />);

      const boton = screen.getByRole('button');

      await usuario.click(boton);
      await usuario.keyboard('{Escape}');

      expect(boton).toHaveAttribute('aria-expanded', 'false');
      expect(boton).toHaveFocus();
    });

    it('se cierra al pulsar fuera', async () => {
      render(
        <>
          <LlamaDeRacha racha={racha()} />
          <p>Otra cosa</p>
        </>,
      );

      await usuario.click(screen.getByRole('button'));
      await usuario.click(screen.getByText('Otra cosa'));

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('el tono', () => {
    it.each([
      ['una racha larga', racha({ dias: 120, nivel: 3, congelamientosUsados: 3 })],
      ['sin nada hoy', racha({ hechoHoy: false })],
      ['en descanso', racha({ dias: 0, nivel: 0, hechoHoy: false, enDescanso: true })],
      ['con dias cubiertos', racha({ diasCubiertos: ['2026-10-11'], congelamientosUsados: 1 })],
    ])('nunca habla de perdida ni de castigo: %s', async (_nombre, estado) => {
      const { container } = render(<LlamaDeRacha racha={estado} />);

      await usuario.click(screen.getByRole('button'));

      expect(container.textContent).not.toMatch(PALABRAS_DE_CASTIGO);
      expect(screen.getByRole('button').getAttribute('aria-label') ?? '').not.toMatch(
        PALABRAS_DE_CASTIGO,
      );
    });
  });
});

describe('LlamaDeLaBarra', () => {
  function sesion(id = '11111111-1111-4111-8111-111111111111'): EstadoDeSesion {
    return {
      sesion: { user: { id, email: 'ana@ejemplo.test' } } as Session,
      cargando: false,
      correo: 'ana@ejemplo.test',
    } as unknown as EstadoDeSesion;
  }

  function pintar(valor: EstadoDeSesion = sesion()) {
    return render(
      <SesionContexto.Provider value={valor}>
        <LlamaDeLaBarra />
      </SesionContexto.Provider>,
    );
  }

  beforeEach(() => {
    consultarLaRacha.mockReset();
    // Lo ultimo que se supo es de la prueba anterior: cada una parte de cero.
    olvidarLaRacha();
  });

  it('mientras llega no pinta nada: la barra no salta', () => {
    consultarLaRacha.mockReturnValue(new Promise(() => undefined));

    const { container } = pintar();

    expect(container).toBeEmptyDOMElement();
  });

  it('cuando llega, pinta la llama de la racha', async () => {
    consultarLaRacha.mockResolvedValue(racha({ dias: 9 }));

    pintar();

    expect(await screen.findByRole('button', { name: /9 días/ })).toBeInTheDocument();
  });

  it('si no se pudo pedir, no pinta nada y no rompe la barra', async () => {
    consultarLaRacha.mockRejectedValue(new TypeError('Failed to fetch'));

    const { container } = pintar();

    await waitFor(() => {
      expect(consultarLaRacha).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('al volver la conexion la pide otra vez', async () => {
    consultarLaRacha.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    consultarLaRacha.mockResolvedValue(racha({ dias: 4 }));

    pintar();

    await waitFor(() => {
      expect(consultarLaRacha).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByRole('button', { name: /4 días/ })).toBeInTheDocument();
  });

  it('sin sesion no pide nada', () => {
    pintar({ sesion: null, cargando: false, correo: undefined } as unknown as EstadoDeSesion);

    expect(consultarLaRacha).not.toHaveBeenCalled();
  });
});
