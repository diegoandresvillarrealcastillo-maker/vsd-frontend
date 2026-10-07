import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Mascota } from '../infraestructura/api/cuenta.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { frasesDelMomento } from './bancoDeFrases.ts';
import { MascotaFlotante, PULSACION_LARGA_MS } from './MascotaFlotante.tsx';
import { PERSONAJES } from './personajes.ts';
import { INACTIVIDAD_MS } from './useExpresion.ts';

// El dibujo de la mascota propia (SCRUM-122) lo da el servidor; aqui se controla.
const { dibujoPropio } = vi.hoisted(() => ({
  dibujoPropio: { url: null as string | null, cargando: false },
}));

vi.mock('../foto/mascotaPropia.ts', () => ({
  useMascotaPropia: () => ({ url: dibujoPropio.url, cargando: dibujoPropio.cargando }),
}));

// El movimiento de la mascota propia se prueba en `movimientoDeLaPropia.spec.ts`;
// aqui se espia para comprobar que la mascota lo usa, y solo ella.
const { movimiento } = vi.hoisted(() => ({ movimiento: vi.fn() }));

vi.mock('./movimientoDeLaPropia.ts', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('./movimientoDeLaPropia.ts')>();

  movimiento.mockImplementation(original.movimientoDeLaPropia);

  return { movimientoDeLaPropia: movimiento };
});

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
  dibujoPropio.url = null;
  dibujoPropio.cargando = false;
  movimiento.mockClear();
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

  describe('las frases (SCRUM-129)', () => {
    /** La frase que se ve en el globo. */
    function fraseVisible(): string {
      return document.querySelector('.mascota__frase')?.textContent ?? '';
    }

    /**
     * Toca una vez por cada frase del momento y devuelve las que salieron,
     * ordenadas. Si la mascota mezclara otro momento, saldria alguna de mas y
     * alguna de menos: con una sola frase, las generales (que estan en todos los
     * momentos) hacian pasar la prueba por azar.
     */
    function agotar(momento: Parameters<typeof frasesDelMomento>[0]): string[] {
      const salidas: string[] = [];

      for (const _frase of frasesDelMomento(momento)) {
        fireEvent.click(mascota());
        salidas.push(fraseVisible());
      }

      return salidas.sort();
    }

    it('al tocarla dice una frase del banco, que se puede cerrar', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());

      // Son las diez de la manana en Bogota: sale una de la manana o una
      // general. Las propias del personaje solo entran en las generales.
      expect(frasesDelMomento('manana')).toContain(fraseVisible());
      expect(screen.getByText('Chispita te acompaña')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar la frase' }));

      expect(screen.queryByText('Chispita te acompaña')).not.toBeInTheDocument();
    });

    it('cada toque trae una frase distinta hasta agotar las del momento, y el globo se va solo', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      const total = frasesDelMomento('manana').length;
      const vistas: string[] = [];

      for (let toque = 0; toque < total; toque += 1) {
        fireEvent.click(mascota());
        vistas.push(fraseVisible());
      }

      // Ninguna se repitio, y salieron todas.
      expect(new Set(vistas).size).toBe(total);
      expect([...vistas].sort()).toEqual([...frasesDelMomento('manana')].sort());

      // Con la siguiente empieza otra vuelta, sin repetir justo la ultima.
      fireEvent.click(mascota());

      expect(fraseVisible()).not.toBe(vistas[vistas.length - 1]);

      adelantar(8_000);

      expect(screen.queryByText('Chispita te acompaña')).not.toBeInTheDocument();
    });

    it('la frase tambien se anuncia a los lectores de pantalla', () => {
      render(<MascotaFlotante mascota={SPARKY} />);

      fireEvent.click(mascota());

      const anuncio = document.querySelector('[aria-live="polite"]');

      expect(anuncio).toHaveTextContent(`Chispita: ${fraseVisible()}`);
    });

    it('lo que ya dijo se recuerda al volver: no repite aunque se desmonte y se monte otra vez', () => {
      const vistas: string[] = [];

      for (let visita = 0; visita < 12; visita += 1) {
        const { unmount } = render(<MascotaFlotante mascota={SPARKY} />);

        fireEvent.click(mascota());
        vistas.push(fraseVisible());
        unmount();
      }

      expect(new Set(vistas).size).toBe(12);
    });

    it('de noche dice las de la noche, o las generales, y no las de la manana', () => {
      vi.setSystemTime(DE_NOCHE);
      render(<MascotaFlotante mascota={SPARKY} />);

      expect(agotar('noche')).toEqual([...frasesDelMomento('noche')].sort());
    });

    it('al celebrar dice las de despues de una actividad, o las generales', () => {
      render(<MascotaFlotante mascota={SPARKY} celebrar />);

      expect(agotar('actividad')).toEqual([...frasesDelMomento('actividad')].sort());
    });

    it.each(['racha', 'diario'] as const)(
      'si la pantalla pide «%s», dice las de ese momento, o las generales',
      (momento) => {
        render(<MascotaFlotante mascota={SPARKY} momento={momento} />);

        expect(agotar(momento)).toEqual([...frasesDelMomento(momento)].sort());
      },
    );

    it('celebrar gana a lo que pida la pantalla', () => {
      render(<MascotaFlotante mascota={SPARKY} celebrar momento="diario" />);

      expect(agotar('actividad')).toEqual([...frasesDelMomento('actividad')].sort());
    });

    it('las propias del personaje pueden salir cuando el momento es general', () => {
      // Las tres de la tarde en Bogota: ninguna hora pide un momento concreto.
      vi.setSystemTime(new Date('2026-10-03T20:00:00Z'));
      render(<MascotaFlotante mascota={SPARKY} />);

      const total = frasesDelMomento('general', PERSONAJES.sparky.frases).length;
      const vistas = new Set<string>();

      for (let toque = 0; toque < total; toque += 1) {
        fireEvent.click(mascota());
        vistas.add(fraseVisible());
      }

      for (const propia of PERSONAJES.sparky.frases) {
        expect(vistas).toContain(propia);
      }
    });

    it('una mascota personalizada, sin personaje conocido, tambien dice frases', () => {
      render(
        <MascotaFlotante
          mascota={{ forma: 'brote', color: '#a2d9b6', accesorio: 'ninguno', nombre: 'Luma' }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Luma, tu mascota' }));

      expect(frasesDelMomento('manana')).toContain(fraseVisible());
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

describe('MascotaFlotante: la mascota propia (SCRUM-122)', () => {
  const PROPIA: Mascota = { forma: 'propia', nombre: 'Luma' };
  const DE_TARDE = new Date('2026-10-03T20:00:00Z'); // 15:00 en Bogota: ningun momento concreto

  function dibujo(): HTMLImageElement {
    const imagen = mascota('Luma').querySelector('img');

    if (imagen === null) {
      throw new Error('La mascota no tiene dibujo');
    }

    return imagen;
  }

  describe('que se dibuja', () => {
    it('con su dibujo ya cargado, se pinta ese, con el nombre que le puso la persona', () => {
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(dibujo()).toHaveAttribute('src', 'blob:mi-mascota');
      expect(raiz().dataset.personaje).toBe('propia');
      expect(mascota('Luma')).toBeInTheDocument();
    });

    it('mientras llega su dibujo, no se pinta Fungito un instante: no se ve nada', () => {
      dibujoPropio.cargando = true;

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(dibujo()).toHaveClass('mascota__dibujo--esperando');
      expect(raiz().dataset.personaje).not.toBe('propia');
    });

    it('si su dibujo no llego ni esta llegando, se queda con Fungito en vez de quedarse sin mascota', () => {
      render(<MascotaFlotante mascota={PROPIA} />);

      expect(dibujo().getAttribute('src')).toMatch(/fungito-/);
      expect(dibujo()).not.toHaveClass('mascota__dibujo--esperando');
      expect(raiz().dataset.personaje).toBe('fungito');
    });

    it('una vez cargado el dibujo, deja de estar escondida', () => {
      dibujoPropio.url = 'blob:mi-mascota';
      dibujoPropio.cargando = false;

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(dibujo()).not.toHaveClass('mascota__dibujo--esperando');
    });

    it('quien tiene elegido otro personaje ve a ese, aunque haya subido su dibujo', () => {
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={SPARKY} />);

      expect(mascota().querySelector('img')?.getAttribute('src')).toMatch(/sparky-/);
      expect(raiz().dataset.personaje).toBe('sparky');
    });

    it('quien no tiene mascota guardada ve a Fungito, aunque haya subido su dibujo', () => {
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={null} />);

      expect(raiz().dataset.personaje).toBe('fungito');
    });

    it('el dibujo propio es decorativo: el boton ya dice quien es', () => {
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(dibujo()).toHaveAttribute('alt', '');
    });
  });

  describe('las expresiones se reemplazan con movimiento y brillo, porque no hay cuatro dibujos', () => {
    it('cambia de expresion como cualquier mascota, sin cambiar de dibujo', () => {
      dibujoPropio.url = 'blob:mi-mascota';
      sessionStorage.setItem('vsd-h:mascota-saludo', '1');

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(expresion()).toBe('normal');

      fireEvent.click(mascota('Luma'));

      expect(expresion()).toBe('feliz');
      expect(dibujo()).toHaveAttribute('src', 'blob:mi-mascota');

      adelantar(5_000);

      expect(expresion()).toBe('normal');
    });

    it('celebra cuando la pantalla lo pide, con el mismo dibujo', () => {
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={PROPIA} celebrar />);

      expect(expresion()).toBe('celebrando');
      expect(dibujo()).toHaveAttribute('src', 'blob:mi-mascota');
    });

    it('de noche duerme, con unas «z», y esas «z» no las lee un lector de pantalla', () => {
      vi.setSystemTime(DE_NOCHE);
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(expresion()).toBe('dormida');

      const sueno = document.querySelector('.mascota__sueno');

      expect(sueno).toHaveTextContent('z z');
      expect(sueno).toHaveAttribute('aria-hidden', 'true');
    });

    it('despierta y las «z» desaparecen', () => {
      vi.setSystemTime(DE_NOCHE);
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={PROPIA} />);

      fireEvent.click(mascota('Luma'));

      expect(expresion()).toBe('feliz');
      expect(document.querySelector('.mascota__sueno')).toBeNull();
    });

    it('un personaje de la lista no lleva «z»: tiene su propia cara dormida', () => {
      vi.setSystemTime(DE_NOCHE);

      render(<MascotaFlotante mascota={SPARKY} />);

      expect(expresion()).toBe('dormida');
      expect(document.querySelector('.mascota__sueno')).toBeNull();
    });

    it('mientras llega su dibujo no hay «z», aunque sea de noche', () => {
      vi.setSystemTime(DE_NOCHE);
      dibujoPropio.cargando = true;

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(document.querySelector('.mascota__sueno')).toBeNull();
    });
  });

  describe('el movimiento', () => {
    // Esta prueba corre con prefers-reduced-motion: el segundo argumento es `true`.
    it('se mueve con el movimiento de la propia, que respeta prefers-reduced-motion', () => {
      dibujoPropio.url = 'blob:mi-mascota';
      sessionStorage.setItem('vsd-h:mascota-saludo', '1');

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(movimiento).toHaveBeenCalledWith('normal', true);
    });

    it('al cambiar de expresion, su movimiento cambia con ella', () => {
      dibujoPropio.url = 'blob:mi-mascota';
      sessionStorage.setItem('vsd-h:mascota-saludo', '1');

      render(<MascotaFlotante mascota={PROPIA} />);

      expect(movimiento).not.toHaveBeenCalledWith('feliz', true);

      fireEvent.click(mascota('Luma'));

      expect(movimiento).toHaveBeenCalledWith('feliz', true);
    });

    it('un personaje de la lista no usa el movimiento de la propia', () => {
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={SPARKY} />);
      fireEvent.click(mascota());

      expect(movimiento).not.toHaveBeenCalled();
    });

    it('mientras no tiene su dibujo, y se pinta Fungito, tampoco', () => {
      render(<MascotaFlotante mascota={PROPIA} />);

      expect(movimiento).not.toHaveBeenCalled();
    });
  });

  describe('las frases', () => {
    it('dice las del banco general y ninguna de un personaje: no tiene personalidad propia', () => {
      vi.setSystemTime(DE_TARDE);
      dibujoPropio.url = 'blob:mi-mascota';

      render(<MascotaFlotante mascota={PROPIA} />);

      const generales = frasesDelMomento('general');
      const vistas = new Set<string>();

      // Un toque por cada frase general: una vuelta entera del banco.
      generales.forEach(() => {
        fireEvent.click(mascota('Luma'));
        vistas.add(document.querySelector('.mascota__frase')?.textContent ?? '');
      });

      // Una vuelta entera: salen todas las generales, y nada mas.
      expect([...vistas].sort()).toEqual([...generales].sort());

      for (const personaje of Object.values(PERSONAJES)) {
        for (const frase of personaje.frases) {
          expect(vistas).not.toContain(frase);
        }
      }
    });

    it('tambien las dice mientras llega su dibujo, y si no llega', () => {
      vi.setSystemTime(DE_TARDE);

      render(<MascotaFlotante mascota={PROPIA} />);

      fireEvent.click(mascota('Luma'));

      expect(frasesDelMomento('general')).toContain(
        document.querySelector('.mascota__frase')?.textContent ?? '',
      );
    });
  });
});
