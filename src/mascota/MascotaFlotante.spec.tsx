import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Mascota } from '../infraestructura/api/cuenta.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { MascotaFlotante, PULSACION_LARGA_MS } from './MascotaFlotante.tsx';
import { PERSONAJES } from './personajes.ts';
import { INACTIVIDAD_MS } from './useExpresion.ts';

// VSD IA se abre desde la mascota (SCRUM-100); sus respuestas se prueban en
// `Asistente.spec.tsx`.
vi.mock('../infraestructura/api/asistente.ts', () => ({
  LARGO_MAXIMO_DE_LA_PREGUNTA: 1000,
  preguntarAlAsistente: () => new Promise(() => undefined),
}));

/**
 * La mascota flotante, con relojes simulados.
 *
 * Se pide menos movimiento para toda la prueba: las animaciones de reposo son
 * infinitas, y con el reloj simulado cada minuto que se adelanta serian miles
 * de fotogramas que no comprueban nada.
 */
const DE_DIA = new Date('2026-10-03T15:00:00Z'); // 10:00 en Bogota
const DE_NOCHE = new Date('2026-10-04T04:30:00Z'); // 23:30 en Bogota

const SPARKY: Mascota = { forma: 'sparky', nombre: 'Chispita' };

beforeAll(() => {
  const original = window.matchMedia;

  window.matchMedia = (consulta: string) => ({
    ...original(consulta),
    matches: consulta.includes('prefers-reduced-motion'),
  });
});

beforeEach(() => {
  vi.useFakeTimers({ now: DE_DIA });
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

function raiz(): HTMLElement {
  const elemento = document.querySelector<HTMLElement>('.mascota');

  if (elemento === null) {
    throw new Error('La mascota no esta en pantalla');
  }

  return elemento;
}

function expresion(): string | undefined {
  return raiz().dataset.expresion;
}

function mascota(nombre = 'Chispita'): HTMLElement {
  return screen.getByRole('button', { name: `${nombre}, tu mascota` });
}

function adelantar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('MascotaFlotante', () => {
  describe('quien es', () => {
    it('dibuja el personaje guardado con su nombre', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      expect(mascota()).toBeInTheDocument();
      expect(raiz().dataset.personaje).toBe('sparky');
      expect(mascota().querySelector('img')?.getAttribute('src')).toMatch(/sparky-/);
    });

    it('sin mascota guardada acompaña Fungito', () => {
      render(<MascotaFlotante mascota={null} />);

      expect(mascota('Fungito')).toBeInTheDocument();
      expect(raiz().dataset.personaje).toBe('fungito');
    });
  });

  describe('las frases', () => {
    it('al tocarla dice una frase de su personaje, que se puede cerrar', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());

      const [primera] = PERSONAJES.sparky.frases;

      expect(screen.getByText(primera ?? '')).toBeInTheDocument();
      expect(screen.getByText('Chispita te acompaña')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar la frase' }));

      expect(screen.queryByText('Chispita te acompaña')).not.toBeInTheDocument();
    });

    it('cada toque trae la siguiente frase, y el globo se va solo', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());
      fireEvent.click(mascota());

      expect(screen.getByText(PERSONAJES.sparky.frases[1] ?? '')).toBeInTheDocument();

      adelantar(8_000);

      expect(screen.queryByText('Chispita te acompaña')).not.toBeInTheDocument();
    });

    it('la frase tambien se anuncia a los lectores de pantalla', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());

      const anuncio = document.querySelector('[aria-live="polite"]');

      expect(anuncio).toHaveTextContent(`Chispita: ${PERSONAJES.sparky.frases[0] ?? ''}`);
    });
  });

  describe('las expresiones', () => {
    it('saluda feliz la primera vez en la pestaña y despues queda normal', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      expect(expresion()).toBe('feliz');

      adelantar(5_000);

      expect(expresion()).toBe('normal');
    });

    it('en la siguiente pantalla ya no vuelve a saludar', () => {
      const { unmount } = render(<MascotaFlotante mascota={SPARKY} />);

      unmount();
      render(<MascotaFlotante mascota={SPARKY} />);

      expect(expresion()).toBe('normal');
    });

    it('celebra un rato cuando la pantalla lo pide, y vuelve a celebrar si lo pide otra vez', () => {
      const { rerender } = render(<MascotaFlotante mascota={SPARKY} celebrar />);

      expect(expresion()).toBe('celebrando');

      adelantar(8_000);

      expect(expresion()).toBe('normal');

      rerender(<MascotaFlotante mascota={SPARKY} celebrar={false} />);
      rerender(<MascotaFlotante mascota={SPARKY} celebrar />);

      expect(expresion()).toBe('celebrando');
    });

    it('de noche duerme, y al tocarla despierta un momento', () => {
      vi.setSystemTime(DE_NOCHE);

      render(<MascotaFlotante mascota={SPARKY} />);

      expect(expresion()).toBe('dormida');

      fireEvent.click(mascota());

      expect(expresion()).toBe('feliz');

      adelantar(4_000);

      expect(expresion()).toBe('dormida');
    });

    it('de noche es de noche donde esta la persona, no en Colombia (SCRUM-123)', () => {
      // 04:30 UTC son las 23:30 en Bogota, pero las 6:30 en Madrid: ya de dia.
      fijarLaZonaDeLaCuenta('Europe/Madrid');
      vi.setSystemTime(DE_NOCHE);

      render(<MascotaFlotante mascota={SPARKY} />);

      expect(expresion()).not.toBe('dormida');
    });

    it('se duerme tras un rato sin actividad, y una tecla la despierta', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      adelantar(INACTIVIDAD_MS);

      expect(expresion()).toBe('dormida');

      fireEvent.keyDown(document.body, { key: 'a' });

      expect(expresion()).toBe('normal');
    });
  });

  describe('donde esta', () => {
    function posicionGuardada(): unknown {
      return JSON.parse(localStorage.getItem('vsd-h:mascota-posicion') ?? 'null');
    }

    it('con las flechas cambia de lado y sube, y lo recuerda', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.keyDown(mascota(), { key: 'ArrowRight' });

      expect(posicionGuardada()).toEqual({ lado: 'derecha', y: 0.85 });

      fireEvent.keyDown(mascota(), { key: 'ArrowUp' });

      expect(posicionGuardada()).toMatchObject({ lado: 'derecha' });
      expect((posicionGuardada() as { y: number }).y).toBeLessThan(0.85);
    });

    it('arrastrarla al otro lado la pega a ese borde, y no cuenta como toque', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      const boton = mascota();

      fireEvent.pointerDown(boton, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 40,
        clientY: 600,
      });
      fireEvent.pointerMove(boton, { pointerId: 1, isPrimary: true, clientX: 900, clientY: 300 });
      fireEvent.pointerUp(boton, { pointerId: 1, isPrimary: true, clientX: 900, clientY: 300 });
      fireEvent.click(boton);

      expect(posicionGuardada()).toMatchObject({ lado: 'derecha' });
      expect(screen.queryByText('Chispita te acompaña')).not.toBeInTheDocument();
    });

    it('vuelve donde la dejaron', () => {
      localStorage.setItem('vsd-h:mascota-posicion', JSON.stringify({ lado: 'derecha', y: 0.2 }));

      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.keyDown(mascota(), { key: 'ArrowDown' });

      expect(posicionGuardada()).toMatchObject({ lado: 'derecha' });
    });

    it('mientras se escribe en un campo se aparta, y vuelve al salir', () => {
      render(
        <>
          <input aria-label="Un campo" />
          <MascotaFlotante mascota={SPARKY} />
        </>,
      );

      act(() => {
        screen.getByLabelText('Un campo').focus();
      });

      expect(raiz()).toHaveClass('mascota--apartada');

      act(() => {
        screen.getByLabelText('Un campo').blur();
      });

      expect(raiz()).not.toHaveClass('mascota--apartada');
    });

    it('un radio con el foco no cuenta como escribir', () => {
      render(
        <>
          <input type="radio" aria-label="Una opcion" />
          <MascotaFlotante mascota={SPARKY} />
        </>,
      );

      act(() => {
        screen.getByLabelText('Una opcion').focus();
      });

      expect(raiz()).not.toHaveClass('mascota--apartada');
    });
  });

  describe('VSD IA (SCRUM-100)', () => {
    function presionar(boton: HTMLElement) {
      fireEvent.pointerDown(boton, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 40,
        clientY: 600,
      });
    }

    function soltar(boton: HTMLElement) {
      fireEvent.pointerUp(boton, { pointerId: 1, isPrimary: true, clientX: 40, clientY: 600 });
      fireEvent.click(boton);
    }

    it('mantenerla pulsada abre VSD IA, y soltarla no cuenta como toque', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      const boton = mascota();

      presionar(boton);
      adelantar(PULSACION_LARGA_MS);
      soltar(boton);

      expect(screen.getByRole('dialog', { name: 'VSD IA' })).toHaveTextContent('Con Chispita');
      expect(screen.queryByText('Chispita te acompaña')).not.toBeInTheDocument();
      // Posada en la esquina del asistente, es solo un dibujo.
      expect(raiz()).toHaveClass('mascota--con-asistente');
    });

    it('un toque corto sigue siendo una frase', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      const boton = mascota();

      presionar(boton);
      adelantar(PULSACION_LARGA_MS - 100);
      soltar(boton);
      adelantar(200);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Chispita te acompaña')).toBeInTheDocument();
    });

    it('arrastrarla no lo abre', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      const boton = mascota();

      presionar(boton);
      fireEvent.pointerMove(boton, { pointerId: 1, isPrimary: true, clientX: 60, clientY: 500 });
      adelantar(PULSACION_LARGA_MS);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('con teclado se abre desde su frase, y al cerrar vuelve a la mascota', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());
      fireEvent.click(screen.getByRole('button', { name: 'Hablar con VSD IA' }));

      expect(screen.getByRole('dialog', { name: 'VSD IA' })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(raiz()).not.toHaveClass('mascota--con-asistente');
      expect(mascota()).toHaveFocus();
    });

    it('con menos movimiento, se abre sin desplazarse', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());
      fireEvent.click(screen.getByRole('button', { name: 'Hablar con VSD IA' }));

      expect(screen.getByRole('dialog', { name: 'VSD IA' }).style.transform).not.toMatch(
        /scale|translate/,
      );
    });

    it('al cerrarlo se olvida lo escrito', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      const abrir = () => {
        fireEvent.click(mascota());
        fireEvent.click(screen.getByRole('button', { name: 'Hablar con VSD IA' }));
      };

      abrir();
      fireEvent.change(screen.getByRole('textbox', { name: 'Escribe tu pregunta' }), {
        target: { value: 'algo mío' },
      });
      fireEvent.submit(
        screen.getByRole('textbox', { name: 'Escribe tu pregunta' }).closest('form')!,
      );

      expect(screen.getByRole('log')).toHaveTextContent('algo mío');

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar VSD IA' }));
      abrir();

      expect(screen.getByRole('log')).not.toHaveTextContent('algo mío');
    });
  });
});
