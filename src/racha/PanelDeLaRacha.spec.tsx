import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Mascota } from '../infraestructura/api/cuenta.ts';
import type { Racha } from '../infraestructura/api/racha.ts';
import { sprite } from '../mascota/sprites.ts';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { fraseDeLaRacha } from './frasesDeLaRacha.ts';
import { PanelDeLaRacha } from './PanelDeLaRacha.tsx';

/**
 * El panel de la llama (SCRUM-243): el progreso hacia el proximo hito, la semana, los congelamientos,
 * la escalera de hitos y la mascota de la cuenta con una frase.
 *
 * Se arma con las piezas de `racha-panel.css`; aqui se vigila lo que dice y cuando lo dice.
 */
const { mascotaDeLaCuenta } = vi.hoisted(() => ({
  mascotaDeLaCuenta: { actual: null as Mascota | null },
}));

vi.mock('../paginas/actividad/viva/useCargarLaMascota.ts', () => ({
  useCargarLaMascota: () => mascotaDeLaCuenta.actual,
}));

beforeEach(() => {
  mascotaDeLaCuenta.actual = { forma: 'gato', nombre: 'Ojo de Gato' };
});

function pintar(racha: Racha, hora = 10) {
  return render(<PanelDeLaRacha id="panel-de-prueba" racha={racha} hora={hora} />);
}

/** Lo que dice la mascota en su globo. */
const fraseDeLaMascota = (): string =>
  document.querySelector('.racha-panel__frase')?.textContent ?? '';

describe('PanelDeLaRacha', () => {
  describe('lo que muestra', () => {
    it('es una region con nombre, y lleva el id que le pide el boton', () => {
      pintar(rachaDePrueba());

      const region = screen.getByRole('region', { name: 'Tu racha' });

      expect(region).toHaveAttribute('id', 'panel-de-prueba');
    });

    it('el titulo dice el nivel de la llama y los dias seguidos', () => {
      pintar(rachaDePrueba({ dias: 12, nivel: 1 }));

      expect(screen.getByText('Llama · 12 días seguidos')).toBeInTheDocument();
    });

    it('con un solo dia lo dice en singular', () => {
      pintar(rachaDePrueba({ dias: 1, nivel: 0 }));

      expect(screen.getByText('Ascua · 1 día seguido')).toBeInTheDocument();
    });

    it('si hoy ya sumo, lo dice; si no, invita sin reclamar', () => {
      const { unmount } = pintar(rachaDePrueba({ hechoHoy: true }));

      expect(screen.getByText('Hoy ya sumaste.')).toBeInTheDocument();
      unmount();

      pintar(rachaDePrueba({ hechoHoy: false }));

      expect(screen.getByText('Una actividad hoy mantiene tu llama.')).toBeInTheDocument();
    });

    it('la barra va desde el ultimo hito logrado hasta el proximo', () => {
      pintar(rachaDePrueba({ dias: 12 }));

      const barra = screen.getByRole('progressbar');

      expect(barra).toHaveAttribute('aria-valuemin', '7');
      expect(barra).toHaveAttribute('aria-valuemax', '14');
      expect(barra).toHaveAttribute('aria-valuetext', '12 de 14 días');
    });

    it('muestra la semana', () => {
      pintar(rachaDePrueba());

      expect(
        within(screen.getByRole('list', { name: 'Tu semana' })).getAllByRole('listitem'),
      ).toHaveLength(7);
    });

    it('lo que viene va primero: los tres proximos hitos, con lo que cambia en cada uno', () => {
      pintar(rachaDePrueba({ dias: 12 }));

      const proximos = screen.getByRole('list', { name: 'Próximos hitos' });

      expect(within(proximos).getAllByRole('listitem')).toHaveLength(3);
      expect(within(proximos).getByText(/Dos semanas/)).toBeInTheDocument();
      expect(within(proximos).getByText(/Dos barras que se unen/)).toBeInTheDocument();
    });

    it('los ya logrados se recogen en un desplegable que dice cuantos son', () => {
      const { container } = pintar(rachaDePrueba({ dias: 12 }));

      const desplegable = container.querySelector('details.racha-panel__logrados');

      expect(desplegable).not.toBeNull();
      expect(desplegable).not.toHaveAttribute('open');
      expect(
        within(desplegable as HTMLElement).getByText('Ya llegaste a 2 hitos'),
      ).toBeInTheDocument();
      expect(
        within(desplegable as HTMLElement).getAllByRole('listitem', { hidden: true }),
      ).toHaveLength(2);
    });

    it('con un solo hito logrado lo dice en singular', () => {
      pintar(rachaDePrueba({ dias: 3 }));

      expect(screen.getByText('Ya llegaste a 1 hito')).toBeInTheDocument();
    });

    it('sin ningun hito logrado no hay desplegable', () => {
      const { container } = pintar(rachaDePrueba({ dias: 1, nivel: 0 }));

      expect(container.querySelector('details')).toBeNull();
    });

    it('lo que viene va antes que los congelamientos', () => {
      const { container } = pintar(rachaDePrueba({ dias: 12 }));

      const texto = container.textContent ?? '';

      expect(texto.indexOf('Lo que viene')).toBeGreaterThan(-1);
      expect(texto.indexOf('Lo que viene')).toBeLessThan(texto.indexOf('Congelamientos'));
    });
  });

  describe('los congelamientos', () => {
    it('son tres casillas: las usadas y las que quedan', () => {
      pintar(rachaDePrueba({ congelamientosUsados: 1, congelamientosDisponibles: 2 }));

      const casillas = within(
        screen.getByRole('list', { name: 'Congelamientos de este mes' }),
      ).getAllByRole('listitem');

      expect(casillas).toHaveLength(3);
      expect(casillas.map((casilla) => casilla.textContent)).toEqual([
        'Congelamiento 1: usado',
        'Congelamiento 2: disponible',
        'Congelamiento 3: disponible',
      ]);
    });

    it('explica con cuantos quedan', () => {
      pintar(rachaDePrueba({ congelamientosUsados: 1, congelamientosDisponibles: 2 }));

      const region = screen.getByRole('region', { name: 'Tu racha' });

      expect(within(region).getByText(/1 de 3/)).toBeInTheDocument();
      expect(within(region).getByText(/quedan 2/i)).toBeInTheDocument();
    });

    it('sin usar ninguno dice cuantos hay por mes', () => {
      pintar(rachaDePrueba({ congelamientosUsados: 0 }));

      expect(screen.getByText(/hasta 3 días/i)).toBeInTheDocument();
    });

    it('con los tres usados, dice que vuelven el mes que viene', () => {
      pintar(
        rachaDePrueba({ congelamientosUsados: 3, congelamientosDisponibles: 0, hechoHoy: true }),
      );

      expect(screen.getByText(/el mes que viene vuelven/i)).toBeInTheDocument();
    });
  });

  describe('un servidor que todavia no manda los campos nuevos', () => {
    it('el panel queda como antes: titulo, hoy y congelamientos, sin barra ni semana ni escalera', () => {
      pintar(rachaDePrueba({ proximoHito: 0, escalera: [], semana: [] }));

      expect(screen.getByText('Llama · 12 días seguidos')).toBeInTheDocument();
      expect(screen.getByText('Hoy ya sumaste.')).toBeInTheDocument();
      expect(screen.getByText(/hasta 3 días/i)).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Tu semana' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Próximos hitos' })).not.toBeInTheDocument();
      expect(document.querySelector('details')).toBeNull();
    });
  });

  describe('la llama que descansa', () => {
    const descansa = () =>
      rachaDePrueba({
        dias: 0,
        nivel: 0,
        hechoHoy: false,
        enDescanso: true,
        proximoHito: 3,
        escalera: [
          { dias: 3, logrado: false },
          { dias: 7, logrado: false },
          { dias: 14, logrado: false },
        ],
      });

    it('lo dice con calma y la barra parte de cero', () => {
      pintar(descansa());

      expect(screen.getByText('Tu llama descansa')).toBeInTheDocument();
      expect(
        screen.getByText('Con tu próxima actividad vuelve a encenderse, con un día.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });

    it('la mascota anima a empezar, sin hablar de lo que se corto', () => {
      pintar(descansa());

      expect(fraseDeLaMascota()).toBe(fraseDeLaRacha('regreso', { dias: 0 }));
    });
  });

  describe('lo que dice la mascota y cuando', () => {
    it('cerca de un hito, dice cuanto falta', () => {
      pintar(rachaDePrueba({ dias: 12, hechoHoy: true }));

      expect(fraseDeLaMascota()).toBe(
        fraseDeLaRacha('cercaDelHito', { dias: 12, faltan: 2, hito: 14 }),
      );
    });

    it('lejos de un hito, es un dia normal', () => {
      pintar(rachaDePrueba({ dias: 20, hechoHoy: true }));

      expect(fraseDeLaMascota()).toBe(fraseDeLaRacha('diaNormal', { dias: 20 }));
    });

    it('por la manana, con hoy sin hacer, no habla de riesgo', () => {
      pintar(rachaDePrueba({ dias: 20, hechoHoy: false }), 10);

      expect(fraseDeLaMascota()).toBe(fraseDeLaRacha('diaNormal', { dias: 20 }));
      expect(fraseDeLaMascota()).not.toMatch(/en juego|congelamiento/i);
    });

    it('de tarde y con congelamientos, dice que una actividad evita gastar uno', () => {
      pintar(
        rachaDePrueba({
          dias: 20,
          hechoHoy: false,
          congelamientosUsados: 1,
          congelamientosDisponibles: 2,
        }),
        20,
      );

      expect(fraseDeLaMascota()).toBe(fraseDeLaRacha('riesgoConCongelamientos', { dias: 20 }));
      expect(fraseDeLaMascota()).not.toMatch(/en juego/i);
    });

    it('de tarde y sin congelamientos, dice la verdad: esta en juego', () => {
      pintar(
        rachaDePrueba({
          dias: 20,
          hechoHoy: false,
          congelamientosUsados: 3,
          congelamientosDisponibles: 0,
        }),
        20,
      );

      expect(fraseDeLaMascota()).toBe(fraseDeLaRacha('riesgoSinCongelamientos', { dias: 20 }));
    });

    it('de tarde pero con hoy ya hecho, no hay riesgo', () => {
      pintar(
        rachaDePrueba({
          dias: 20,
          hechoHoy: true,
          congelamientosUsados: 3,
          congelamientosDisponibles: 0,
        }),
        22,
      );

      expect(fraseDeLaMascota()).not.toMatch(/en juego|congelamiento/i);
    });
  });

  describe('la mascota', () => {
    it('es la de la cuenta, contenta si hoy ya sumo', () => {
      pintar(rachaDePrueba({ hechoHoy: true }));

      expect(document.querySelector('.racha-panel__mascota img')?.getAttribute('src')).toBe(
        sprite('gato', 'feliz'),
      );
    });

    it('con hoy sin hacer, tranquila', () => {
      pintar(rachaDePrueba({ hechoHoy: false }));

      expect(document.querySelector('.racha-panel__mascota img')?.getAttribute('src')).toBe(
        sprite('gato', 'normal'),
      );
    });

    it('sin mascota guardada, la de siempre', () => {
      mascotaDeLaCuenta.actual = null;

      pintar(rachaDePrueba({ hechoHoy: true }));

      expect(document.querySelector('.racha-panel__mascota img')?.getAttribute('src')).toBe(
        sprite('fungito', 'feliz'),
      );
    });

    it('el dibujo es decorativo y la frase se anuncia con calma', () => {
      pintar(rachaDePrueba());

      expect(document.querySelector('.racha-panel__mascota img')).toHaveAttribute('alt', '');
      expect(document.querySelector('.racha-panel__frase')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('el tono', () => {
    it.each<[string, Racha, number]>([
      [
        'una racha larga',
        rachaDePrueba({
          dias: 120,
          nivel: 3,
          congelamientosUsados: 3,
          congelamientosDisponibles: 0,
        }),
        21,
      ],
      ['sin nada hoy, de tarde', rachaDePrueba({ hechoHoy: false }), 21],
      [
        'sin nada hoy, sin congelamientos, de tarde',
        rachaDePrueba({ hechoHoy: false, congelamientosUsados: 3, congelamientosDisponibles: 0 }),
        21,
      ],
      ['en descanso', rachaDePrueba({ dias: 0, nivel: 0, hechoHoy: false, enDescanso: true }), 10],
      [
        'con dias cubiertos',
        rachaDePrueba({ diasCubiertos: ['2026-10-11'], congelamientosUsados: 1 }),
        10,
      ],
    ])('nunca habla de perdida ni de castigo: %s', (_nombre, racha, hora) => {
      const { container } = pintar(racha, hora);

      expect(container.textContent).not.toMatch(
        /perdi|rompi|fall|apag|castig|error|racha rota|vuelve a empezar/iu,
      );
    });
  });

  it('no tiene fallos de accesibilidad', async () => {
    pintar(
      rachaDePrueba({ hechoHoy: false, congelamientosUsados: 1, congelamientosDisponibles: 2 }),
      20,
    );

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
