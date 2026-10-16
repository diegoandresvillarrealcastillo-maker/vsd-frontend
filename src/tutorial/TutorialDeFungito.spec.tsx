import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PASOS_DEL_TUTORIAL } from './pasos.ts';
import {
  marcarElTutorialComoVisto,
  tutorialVisto,
  volverAVerElTutorial,
} from './memoriaDelTutorial.ts';
import { TutorialDeFungito } from './TutorialDeFungito.tsx';

/**
 * El tutorial de Fungito (SCRUM-187).
 *
 * Lo que se vigila: que se recorre paso a paso, que **siempre se puede omitir** (con boton y con
 * Escape), que no reaparece una vez visto —ni omitido—, que es de cada cuenta y que ningun texto
 * apura, exige ni reprocha.
 */
const CUENTA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-9222-222222222222';

const usuario = userEvent.setup({ delay: null });

beforeEach(() => {
  volverAVerElTutorial(CUENTA);
  volverAVerElTutorial(OTRA);
});

describe('memoria del tutorial', () => {
  it('una cuenta nueva no lo ha visto', () => {
    expect(tutorialVisto(CUENTA)).toBe(false);
  });

  it('marcarlo visto es por cuenta', () => {
    marcarElTutorialComoVisto(CUENTA);

    expect(tutorialVisto(CUENTA)).toBe(true);
    expect(tutorialVisto(OTRA)).toBe(false);
  });

  it('se puede volver a ver', () => {
    marcarElTutorialComoVisto(CUENTA);
    volverAVerElTutorial(CUENTA);

    expect(tutorialVisto(CUENTA)).toBe(false);
  });
});

describe('los pasos', () => {
  it('son varios, cada uno con titulo y texto, y el primero presenta a Fungito', () => {
    expect(PASOS_DEL_TUTORIAL.length).toBeGreaterThanOrEqual(5);
    expect(PASOS_DEL_TUTORIAL[0]?.titulo).toMatch(/Fungito/);

    for (const paso of PASOS_DEL_TUTORIAL) {
      expect(paso.titulo.trim()).not.toBe('');
      expect(paso.texto.trim()).not.toBe('');
    }
  });

  it('ningun texto apura, exige ni reprocha', () => {
    const todo = PASOS_DEL_TUTORIAL.map((paso) => `${paso.titulo} ${paso.texto}`).join(' ');

    expect(todo).not.toMatch(/debes|tienes que|obligatori|no olvides|perd|castig|falla/i);
  });

  it('no promete lo que la app no hace: el asistente no diagnostica', () => {
    const asistente = PASOS_DEL_TUTORIAL.find((paso) => paso.titulo.includes('VSD IA'));

    expect(asistente?.texto).toMatch(/no (sustituye|diagnostica)/i);
  });
});

/**
 * El spotlight (SCRUM-201): la pantalla se atenua y el paso senala el elemento real.
 *
 * jsdom no calcula el diseno, asi que cada elemento marcado recibe a mano su rectangulo. Lo que se
 * vigila es la **decision**: a donde mira cada paso, que pasa si el elemento no esta o no se ve, y
 * que lo de SCRUM-187 (omitir, Escape, una vez por cuenta) sigue igual.
 */
describe('el spotlight (SCRUM-201)', () => {
  const RECTANGULO = { left: 40, top: 120, width: 300, height: 200 };

  /** Un elemento de la pagina marcado como ancla, con el rectangulo que se le diga. */
  function anclar(ancla: string, rect = RECTANGULO): HTMLElement {
    const nodo = document.createElement('div');

    nodo.setAttribute('data-tutorial', ancla);
    vi.spyOn(nodo, 'getBoundingClientRect').mockReturnValue({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    });
    nodo.scrollIntoView = vi.fn();
    document.body.append(nodo);

    return nodo;
  }

  /** Va al paso con ese id, pulsando «Siguiente». */
  async function irAlPaso(id: string) {
    const indice = PASOS_DEL_TUTORIAL.findIndex((paso) => paso.id === id);

    for (let i = 0; i < indice; i++) {
      await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    }
  }

  const hueco = (contenedor: HTMLElement) =>
    contenedor.querySelector<HTMLElement>('.tutorial__hueco');

  afterEach(() => {
    document.body.querySelectorAll('[data-tutorial]').forEach((nodo) => {
      nodo.remove();
    });
    vi.restoreAllMocks();
  });

  it('los pasos del recorrido con elemento: ruta, llama, semaforo, diario y asistente', () => {
    const conAncla = PASOS_DEL_TUTORIAL.filter((paso) => paso.ancla !== undefined);

    expect(conAncla.map((paso) => paso.ancla)).toEqual([
      'ruta',
      'llama',
      'semaforo',
      'diario',
      'asistente',
    ]);
  });

  it('el primer paso y el ultimo se quedan centrados: no senalan nada', () => {
    expect(PASOS_DEL_TUTORIAL.at(0)?.ancla).toBeUndefined();
    expect(PASOS_DEL_TUTORIAL.at(-1)?.ancla).toBeUndefined();
  });

  it('sin el elemento en la pagina, el paso se ve centrado: sin hueco', async () => {
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');

    expect(hueco(container)).toBeNull();
    expect(container.querySelector('.tutorial--spotlight')).toBeNull();
  });

  it('con el elemento, ilumina un hueco con el margen puesto', async () => {
    anclar('ruta');
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');

    const luz = hueco(container);

    expect(container.querySelector('.tutorial--spotlight')).not.toBeNull();
    expect(luz).not.toBeNull();
    expect(luz).toHaveStyle({ left: '32px', top: '112px', width: '316px', height: '216px' });
    // Es solo un dibujo: no se anuncia ni recibe el puntero.
    expect(luz).toHaveAttribute('aria-hidden', 'true');
  });

  it('lleva el elemento a la vista antes de medirlo', async () => {
    const ruta = anclar('ruta');
    render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');

    expect(ruta.scrollIntoView).toHaveBeenCalled();
  });

  it('cada paso mueve el hueco a su elemento', async () => {
    anclar('ruta', { left: 40, top: 120, width: 300, height: 200 });
    anclar('llama', { left: 300, top: 10, width: 40, height: 40 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');
    const enRuta = hueco(container)?.getAttribute('style');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    const enLlama = hueco(container)?.getAttribute('style');

    expect(enRuta).toBeTruthy();
    expect(enLlama).toBeTruthy();
    expect(enLlama).not.toBe(enRuta);
    expect(hueco(container)).toHaveStyle({ left: '292px', top: '2px' });
  });

  it('un elemento que existe pero no se ve (sin tamano) cae al paso centrado', async () => {
    anclar('ruta', { left: 0, top: 0, width: 0, height: 0 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');

    expect(hueco(container)).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un elemento que ocupa casi toda la pantalla cae al paso centrado', async () => {
    anclar('ruta', { left: 0, top: 0, width: 300, height: 700 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');

    expect(hueco(container)).toBeNull();
  });

  it('la caja va arriba cuando el elemento esta en la parte de abajo', async () => {
    anclar('diario', { left: 20, top: 700, width: 60, height: 50 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('diario');

    expect(container.querySelector('.tutorial--arriba')).not.toBeNull();
  });

  it('la caja va abajo cuando el elemento esta en la parte de arriba', async () => {
    anclar('llama', { left: 300, top: 10, width: 40, height: 40 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('llama');

    expect(container.querySelector('.tutorial--abajo')).not.toBeNull();
  });

  it('si cambia el tamano de la ventana, el hueco sigue al elemento', async () => {
    const ruta = anclar('ruta');
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');
    expect(hueco(container)).toHaveStyle({ left: '32px' });

    vi.mocked(ruta.getBoundingClientRect).mockReturnValue({
      left: 100,
      top: 120,
      width: 300,
      height: 200,
      right: 400,
      bottom: 320,
      x: 100,
      y: 120,
      toJSON: () => ({}),
    });
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });

    expect(hueco(container)).toHaveStyle({ left: '92px' });
  });

  it('con el spotlight se puede omitir con el boton y con Escape, como siempre', async () => {
    anclar('ruta');
    const { unmount } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');
    await usuario.click(screen.getByRole('button', { name: 'Omitir' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tutorialVisto(CUENTA)).toBe(true);

    unmount();
    volverAVerElTutorial(CUENTA);
    render(<TutorialDeFungito cuenta={CUENTA} />);
    await irAlPaso('ruta');
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('el dialogo sigue siendo modal y con nombre, tambien con el spotlight', async () => {
    anclar('semaforo', { left: 330, top: 700, width: 56, height: 56 });
    render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('semaforo');

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Tu semáforo');
  });

  it('las anclas que usan los pasos existen en el codigo de la app', () => {
    const FUENTES = import.meta.glob<string>(['../**/*.tsx', '!../**/*.spec.tsx'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const todo = Object.values(FUENTES).join('\n');

    for (const paso of PASOS_DEL_TUTORIAL) {
      if (paso.ancla !== undefined) {
        expect(todo, `nadie marca data-tutorial="${paso.ancla}"`).toMatch(
          new RegExp(`data-tutorial=["']${paso.ancla}["']`),
        );
      }
    }
  });
});

describe('TutorialDeFungito', () => {
  it('la primera vez se abre en el primer paso', () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName(PASOS_DEL_TUTORIAL[0]?.titulo ?? '');
    expect(screen.getByText(`Paso 1 de ${String(PASOS_DEL_TUTORIAL.length)}`)).toBeInTheDocument();
  });

  it('el foco entra al boton principal, para seguir con Intro', () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
  });

  it('avanza y retrocede paso a paso', async () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    expect(screen.queryByRole('button', { name: 'Atrás' })).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName(PASOS_DEL_TUTORIAL[1]?.titulo ?? '');
    expect(screen.getByText(/Paso 2 de/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Atrás' }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName(PASOS_DEL_TUTORIAL[0]?.titulo ?? '');
  });

  it('el ultimo paso cierra y lo deja visto', async () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    for (let i = 0; i < PASOS_DEL_TUTORIAL.length - 1; i++) {
      await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    }

    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();

    await usuario.click(screen.getByRole('button', { name: '¡Vamos!' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tutorialVisto(CUENTA)).toBe(true);
  });

  it('se puede omitir en cualquier paso, y cuenta como visto', async () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    await usuario.click(screen.getByRole('button', { name: 'Omitir' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tutorialVisto(CUENTA)).toBe(true);
  });

  it('Escape lo omite', async () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tutorialVisto(CUENTA)).toBe(true);
  });

  it('pulsar el fondo no lo cierra por accidente', async () => {
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    const fondo = container.querySelector<HTMLElement>('.tutorial');

    expect(fondo).not.toBeNull();

    await usuario.click(fondo!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ya visto, no aparece', () => {
    marcarElTutorialComoVisto(CUENTA);

    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lo visto por una cuenta no lo oculta a otra', () => {
    marcarElTutorialComoVisto(OTRA);

    render(<TutorialDeFungito cuenta={CUENTA} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Fungito es decorativo: no se anuncia', () => {
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);
    const imagen = container.querySelector('img');

    expect(imagen).toHaveAttribute('alt', '');
  });
});
