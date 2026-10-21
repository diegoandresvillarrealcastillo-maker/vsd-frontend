import type { Session } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { olvidarLaRacha, recordarLaRacha } from './memoriaDeLaRacha.ts';
import { RachaDelDia } from './RachaDelDia.tsx';

/**
 * La racha al terminar una actividad (SCRUM-243).
 *
 * Al montarse pide la racha otra vez y la compara con la que se sabia: si hoy sumo un dia, a los
 * 1,2 s abre la celebracion. Lo que se vigila aqui es lo que no puede fallar: que la segunda
 * actividad del dia no celebre de nuevo, que un resultado que pide acompanar no tenga fiesta, y que
 * un fallo de red no se note.
 */
const { consultarLaRacha } = vi.hoisted(() => ({ consultarLaRacha: vi.fn() }));

vi.mock('../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

const ANA = '11111111-1111-4111-8111-111111111111';

const ESCALERA_HASTA_7 = [
  { dias: 3, logrado: true },
  { dias: 7, logrado: true },
  { dias: 14, logrado: false },
  { dias: 30, logrado: false },
  { dias: 50, logrado: false },
];

function conSesion(id: string | undefined): EstadoDeSesion {
  return {
    sesion: id === undefined ? null : ({ user: { id, email: 'ana@ejemplo.test' } } as Session),
    cargando: false,
    correo: 'ana@ejemplo.test',
  } as unknown as EstadoDeSesion;
}

function pintar(celebrar: boolean, sesion: EstadoDeSesion | null = conSesion(ANA)) {
  return render(
    <SesionContexto.Provider value={sesion}>
      <RachaDelDia celebrar={celebrar} />
    </SesionContexto.Provider>,
  );
}

/** Deja correr las promesas y el tiempo, con los temporizadores falsos. */
async function pasar(milisegundos: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milisegundos);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  consultarLaRacha.mockReset();
  olvidarLaRacha();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RachaDelDia', () => {
  describe('la primera actividad del dia', () => {
    beforeEach(() => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 11, hechoHoy: false }));
      consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 12, hechoHoy: true }));
    });

    it('abre la celebracion a los 1,2 segundos, no antes', async () => {
      pintar(true);

      await pasar(1_000);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await pasar(250);
      expect(screen.getByRole('dialog', { name: '¡12 días seguidos!' })).toBeInTheDocument();
    });

    it('pide la racha una sola vez', async () => {
      pintar(true);

      await pasar(2_000);

      expect(consultarLaRacha).toHaveBeenCalledTimes(1);
    });

    it('«Seguir» cierra la celebracion', async () => {
      pintar(true);
      await pasar(1_300);
      // Con temporizadores falsos, `userEvent` espera a un reloj que no avanza: un clic directo basta.
      fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('al cerrar, el foco vuelve a donde estaba', async () => {
      render(
        <SesionContexto.Provider value={conSesion(ANA)}>
          <button type="button">Hacerla otra vez</button>
          <RachaDelDia celebrar />
        </SesionContexto.Provider>,
      );

      const anterior = screen.getByRole('button', { name: 'Hacerla otra vez' });

      anterior.focus();
      await pasar(1_300);
      expect(screen.getByRole('button', { name: 'Seguir' })).toHaveFocus();

      // Con temporizadores falsos, `userEvent` espera a un reloj que no avanza: un clic directo basta.
      fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));

      expect(anterior).toHaveFocus();
    });

    it('si se sale de la pantalla antes de tiempo, no queda nada pendiente', async () => {
      const { unmount } = pintar(true);

      await pasar(500);
      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('llegar a un hito celebra el hito', async () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 6, hechoHoy: false }));
      consultarLaRacha.mockResolvedValue(
        rachaDePrueba({ dias: 7, hechoHoy: true, escalera: ESCALERA_HASTA_7 }),
      );

      pintar(true);
      await pasar(1_300);

      expect(screen.getByRole('dialog', { name: '¡7 días! Primera semana' })).toBeInTheDocument();
    });
  });

  describe('no se celebra', () => {
    it('la segunda actividad del dia: hoy ya habia sumado', async () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: true }));
      consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 12, hechoHoy: true }));

      const { container } = pintar(true);
      await pasar(3_000);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    });

    it('si no se sabia nada de la racha antes: no se puede saber si hoy ya habia sumado', async () => {
      consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 12, hechoHoy: true }));

      const { container } = pintar(true);
      await pasar(3_000);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    });

    it('si no se pudo pedir la racha: no pasa nada, ni se ve ni se escucha', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      recordarLaRacha(ANA, rachaDePrueba({ dias: 11, hechoHoy: false }));
      consultarLaRacha.mockRejectedValue(new TypeError('Failed to fetch'));

      const { container } = pintar(true);
      await pasar(3_000);

      expect(container).toBeEmptyDOMElement();
      expect(error).not.toHaveBeenCalled();

      error.mockRestore();
    });

    it('sin sesion no pide nada', async () => {
      const { container } = pintar(true, null);
      await pasar(3_000);

      expect(consultarLaRacha).not.toHaveBeenCalled();
      expect(container).toBeEmptyDOMElement();
    });

    it('con sesion pero sin cuenta todavia, tampoco', async () => {
      const { container } = pintar(true, conSesion(undefined));
      await pasar(3_000);

      expect(consultarLaRacha).not.toHaveBeenCalled();
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('cuando el resultado pide acompanar (celebrar es falso)', () => {
    beforeEach(() => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 11, hechoHoy: false }));
      consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 12, hechoHoy: true }));
    });

    it('no hay celebracion, aunque hoy haya sumado un dia', async () => {
      pintar(false);
      await pasar(3_000);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('solo una linea tranquila con los dias', async () => {
      pintar(false);
      await pasar(500);

      expect(screen.getByRole('status')).toHaveTextContent('Racha: 12 días');
    });

    it('en singular cuando es el primer dia', async () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 0, hechoHoy: false, enDescanso: true }));
      consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 1, hechoHoy: true, nivel: 0 }));

      pintar(false);
      await pasar(500);

      expect(screen.getByRole('status')).toHaveTextContent('Racha: 1 día');
    });

    it('la segunda actividad del dia no repite ni la linea', async () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: true }));

      const { container } = pintar(false);
      await pasar(3_000);

      expect(container).toBeEmptyDOMElement();
    });

    it('nunca habla de perdida ni de castigo', async () => {
      const { container } = pintar(false);
      await pasar(500);

      expect(container.textContent).not.toMatch(/perdi|rompi|fall|apag|castig|error|racha rota/iu);
    });
  });
});
