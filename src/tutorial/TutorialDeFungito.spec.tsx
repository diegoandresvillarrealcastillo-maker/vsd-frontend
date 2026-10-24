import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HOJA from '../estilos/tutorial.css?raw';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
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
    const todo = PASOS_DEL_TUTORIAL.map(
      (paso) => `${paso.titulo} ${paso.texto} ${paso.alProbar ?? ''}`,
    ).join(' ');

    expect(todo).not.toMatch(/debes|tienes que|obligatori|no olvides|perd|castig|falla/i);
  });

  it('lo que dice el globo al tocar el elemento es breve, y solo lo tienen los pasos con algo que tocar', () => {
    const conToque = PASOS_DEL_TUTORIAL.filter((paso) => paso.alProbar !== undefined);

    expect(conToque.map((paso) => paso.id)).toEqual(['llama', 'semaforo', 'diario', 'asistente']);

    for (const paso of conToque) {
      expect(paso.ancla, paso.id).toBeDefined();
      expect(paso.alProbar?.split(/\s+/).length, paso.id).toBeLessThanOrEqual(20);
    }
    // La ruta se senala pero no se toca.
    expect(PASOS_DEL_TUTORIAL.find((paso) => paso.id === 'ruta')?.alProbar).toBeUndefined();
  });

  it('el asistente se toca en la mascota de la persona: el globo no habla en primera persona de ella', () => {
    const asistente = PASOS_DEL_TUTORIAL.find((paso) => paso.id === 'asistente');

    expect(asistente?.alProbar).not.toMatch(/\bmi\b|\bmí\b|\bme\b/i);
  });

  it('el diario dice donde esta en el celular y en el computador', () => {
    const diario = PASOS_DEL_TUTORIAL.find((paso) => paso.id === 'diario');

    expect(diario?.texto).toMatch(/celular/);
    expect(diario?.texto).toMatch(/computador/);
    // En el computador esta en la barra de arriba, junto a Inicio y Progreso (SCRUM-249).
    expect(diario?.texto).toMatch(/junto a Inicio y Progreso/);
    expect(diario?.texto).not.toMatch(/menú de tu cuenta/);
  });

  it('cada paso es breve: cabe en una lectura de unos segundos', () => {
    for (const paso of PASOS_DEL_TUTORIAL) {
      expect(paso.texto.split(/\s+/).length, paso.id).toBeLessThanOrEqual(45);
    }
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

  /**
   * Le da al elemento su rectangulo, como propiedad suya. No es `vi.spyOn(nodo, ...)`: si el
   * prototipo ya esta espiado (el globo mide otra cosa), eso devolveria el mismo espia y todos los
   * elementos medirian lo mismo.
   */
  function conRectangulo(
    nodo: HTMLElement,
    rect: { left: number; top: number; width: number; height: number },
  ): HTMLElement {
    Object.defineProperty(nodo, 'getBoundingClientRect', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }),
    });

    return nodo;
  }

  /** Un elemento de la pagina marcado como ancla, con el rectangulo que se le diga. */
  function anclar(ancla: string, rect = RECTANGULO): HTMLElement {
    const nodo = document.createElement('div');

    nodo.setAttribute('data-tutorial', ancla);
    conRectangulo(nodo, rect);
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

  it('pegado a un elemento el dialogo ya no es modal (la pagina sigue ahi), pero conserva su nombre', async () => {
    anclar('semaforo', { left: 330, top: 700, width: 56, height: 56 });
    render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('semaforo');

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).not.toHaveAttribute('aria-modal');
    expect(dialogo).toHaveAccessibleName('Tu semáforo');
  });

  it('centrado, en cambio, si es modal', async () => {
    render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('ruta');

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  // El diario esta en dos sitios y de los dos se ve uno: en escritorio, el enlace de la barra de
  // arriba (SCRUM-249); en el movil, el del dock. El que no se ve (sin tamano) se salta.
  it('en escritorio, el diario se senala en el enlace de la barra de arriba', async () => {
    anclar('diario', { left: 560, top: 18, width: 120, height: 40 });
    anclar('diario', { left: 0, top: 0, width: 0, height: 0 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('diario');

    expect(container.querySelector('.tutorial--spotlight')).not.toBeNull();
    expect(hueco(container)).toHaveStyle({ left: '552px', top: '10px' });
  });

  it('en el movil, el diario se senala en el dock, y el de la barra de arriba se salta', async () => {
    anclar('diario', { left: 0, top: 0, width: 0, height: 0 });
    anclar('diario', { left: 280, top: 700, width: 70, height: 56 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('diario');

    expect(hueco(container)).toHaveStyle({ left: '272px', top: '692px' });
  });

  it('un diario que no se ve en ningun sitio deja el paso centrado', async () => {
    anclar('diario', { left: 0, top: 0, width: 0, height: 0 });
    const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

    await irAlPaso('diario');

    expect(hueco(container)).toBeNull();
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

  /**
   * El globo pegado al elemento y el elemento que se puede tocar (SCRUM-252).
   *
   * jsdom no mide ni apila: al globo se le da el tamano que haria falta, y lo que se vigila es la
   * decision (de que lado va, hacia donde apunta, que pasa al tocar el elemento y quien se queda
   * con el teclado). Los paneles que atrapan el puntero y las capas se miden en un navegador.
   */
  describe('el globo y el toque (SCRUM-252)', () => {
    /** El rectangulo de un elemento de la pagina. */
    const LLAMA = { left: 800, top: 10, width: 40, height: 40 };
    const SEMAFORO = { left: 940, top: 690, width: 56, height: 56 };

    function medirElGlobo(ancho = 352, alto = 220) {
      const original = Element.prototype.getBoundingClientRect;

      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        return this.classList.contains('tutorial__caja')
          ? ({ width: ancho, height: alto, left: 0, top: 0, right: ancho, bottom: alto } as DOMRect)
          : original.call(this);
      });
    }

    /** Un elemento marcado que se puede enfocar: como la llama, que lleva un boton dentro. */
    function anclarConBoton(ancla: string, rect = LLAMA) {
      const nodo = anclar(ancla, rect);
      const boton = document.createElement('button');

      boton.textContent = `Tu ${ancla}`;
      nodo.append(boton);

      return { nodo, boton };
    }

    const globo = (contenedor: HTMLElement) =>
      contenedor.querySelector<HTMLElement>('.tutorial__globo');

    beforeEach(() => {
      medirElGlobo();
    });

    it('el elemento esta arriba: el globo va debajo, a una flecha de distancia, y la flecha apunta a su centro', async () => {
      anclar('llama', LLAMA);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');

      // Hueco: x 792, y 2, 56 x 56. Su centro, 820; un globo de 352 con su centro ahi empezaria en
      // 644, que cabe. Debajo del hueco (58) y la flecha (14): 72.
      expect(globo(container)).toHaveClass('tutorial__globo--abajo');
      expect(globo(container)).toHaveStyle({ left: '644px', top: '72px' });
      expect(container.querySelector('.tutorial__flecha')).toHaveStyle({ left: '176px' });
    });

    it('el elemento esta abajo: el globo va encima y no lo tapa', async () => {
      anclar('semaforo', SEMAFORO);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('semaforo');

      // Hueco: y 682, alto 72. El globo mide 220: termina una flecha (14) antes del hueco.
      expect(globo(container)).toHaveClass('tutorial__globo--arriba');
      expect(globo(container)).toHaveStyle({ top: '448px' });
      expect(container.querySelector('.tutorial--arriba')).not.toBeNull();
    });

    it('si el globo no cabe junto al elemento, el paso va centrado y modal, como sin elemento', async () => {
      vi.restoreAllMocks();
      medirElGlobo(352, 900);
      anclar('llama', LLAMA);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');

      expect(hueco(container)).toBeNull();
      expect(globo(container)).toBeNull();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('lo de alrededor del hueco atrapa el puntero con cuatro paneles que lo dejan libre', async () => {
      anclar('ruta', { left: 40, top: 120, width: 300, height: 200 });
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('ruta');

      const paneles = [...container.querySelectorAll<HTMLElement>('.tutorial__bloqueo')];

      // Hueco: x 32, y 112, 316 x 216.
      expect(paneles).toHaveLength(4);
      expect(paneles[0]).toHaveStyle({ left: '0px', right: '0px', top: '0px', height: '112px' });
      expect(paneles[1]).toHaveStyle({ left: '0px', right: '0px', top: '328px', bottom: '0px' });
      expect(paneles[2]).toHaveStyle({ left: '0px', width: '32px', top: '112px', height: '216px' });
      expect(paneles[3]).toHaveStyle({
        left: '348px',
        right: '0px',
        top: '112px',
        height: '216px',
      });

      for (const panel of paneles) {
        expect(panel).toHaveAttribute('aria-hidden', 'true');
      }
    });

    it('centrado no hay paneles: la raiz entera atrapa el puntero', async () => {
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('ruta');

      expect(container.querySelectorAll('.tutorial__bloqueo')).toHaveLength(0);
    });

    it('antes de tocar el elemento, el globo invita a tocarlo, y el aviso espera vacio', async () => {
      anclar('llama', LLAMA);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');

      expect(screen.getByText('Puedes tocarlo para probarlo.')).toBeInTheDocument();
      // Siempre esta, vacio: un aviso que aparece ya lleno no siempre se anuncia.
      expect(container.querySelector('[role="status"]')).toBeEmptyDOMElement();
    });

    it('un paso con un elemento que no se toca (la ruta) no invita a tocarlo', async () => {
      anclar('ruta');
      render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('ruta');

      expect(screen.queryByText(/Puedes tocarlo/)).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('tocar el elemento lo deja hacer lo suyo, y el globo lo reconoce y se va al borde contrario', async () => {
      const { nodo, boton } = anclarConBoton('llama');
      const alTocar = vi.fn();

      boton.addEventListener('click', alTocar);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');
      expect(container.querySelector('.tutorial--abajo')).not.toBeNull();

      await usuario.click(boton);

      // El elemento recibio el toque: es lo que abre el panel de la llama.
      expect(alTocar).toHaveBeenCalledTimes(1);
      expect(nodo).toBeInTheDocument();
      // Y el globo lo dice sin interrumpir, y se va arriba: la llama esta arriba y su panel se
      // abre debajo.
      expect(screen.getByRole('status')).toHaveTextContent(/Ahí ves tu avance/);
      expect(container.querySelector('.tutorial--dock')).not.toBeNull();
      expect(container.querySelector('.tutorial--abajo')).not.toBeNull();
      expect(globo(container)).toBeNull();
      expect(screen.queryByText(/Puedes tocarlo/)).toBeNull();
    });

    it('pegado a un elemento, no tiene fallos de accesibilidad', async () => {
      anclarConBoton('llama');
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');

      expect(globo(container)).not.toBeNull();
      expect(await fallosDeAccesibilidad(container)).toEqual([]);
    });

    it('ya probado, tampoco', async () => {
      const { boton } = anclarConBoton('llama');
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');
      await usuario.click(boton);

      expect(container.querySelector('.tutorial--dock')).not.toBeNull();
      expect(await fallosDeAccesibilidad(container)).toEqual([]);
    });

    it('con el elemento abajo, ya probado, el globo se va arriba', async () => {
      const { boton } = anclarConBoton('semaforo', SEMAFORO);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('semaforo');
      await usuario.click(boton);

      expect(container.querySelector('.tutorial--dock.tutorial--arriba')).not.toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent(/anotas lo que tienes pendiente/);
    });

    it('ya probado, se sigue con Siguiente y el paso nuevo empieza sin probar', async () => {
      const { boton } = anclarConBoton('llama');

      anclar('semaforo', SEMAFORO);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');
      await usuario.click(boton);
      await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

      expect(screen.getByRole('dialog')).toHaveAccessibleName('Tu semáforo');
      expect(container.querySelector('.tutorial--dock')).toBeNull();
      expect(globo(container)).not.toBeNull();
      expect(container.querySelector('[role="status"]')).toBeEmptyDOMElement();
    });

    it('un toque fuera del elemento no cuenta como probarlo', async () => {
      anclarConBoton('llama');
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('llama');
      await usuario.click(screen.getByText('Tu llama', { selector: 'h2' }));

      expect(container.querySelector('.tutorial--dock')).toBeNull();
    });

    it('el diario no navega: el toque se reconoce, pero no llega al enlace', async () => {
      const enlace = document.createElement('a');
      const alTocar = vi.fn();

      enlace.href = '#panel';
      enlace.setAttribute('data-tutorial', 'diario');
      enlace.textContent = 'Mi diario';
      enlace.addEventListener('click', alTocar);
      conRectangulo(enlace, { left: 560, top: 18, width: 120, height: 40 });
      enlace.scrollIntoView = vi.fn();
      document.body.append(enlace);
      const { container } = render(<TutorialDeFungito cuenta={CUENTA} />);

      await irAlPaso('diario');
      expect(screen.getByText('Puedes tocarlo: el recorrido sigue aquí.')).toBeInTheDocument();

      const toque = new MouseEvent('click', { bubbles: true, cancelable: true });

      act(() => {
        enlace.dispatchEvent(toque);
      });

      expect(toque.defaultPrevented).toBe(true);
      expect(alTocar).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(/Lo abres cuando termine el recorrido/);
      // Sigue en el recorrido.
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Tu diario');
      expect(container.querySelector('.tutorial--dock')).not.toBeNull();
    });

    it('lo que si navega no se detiene: solo el diario lo hace', () => {
      const detenidos = PASOS_DEL_TUTORIAL.filter((paso) => paso.noNavega === true);

      expect(detenidos.map((paso) => paso.id)).toEqual(['diario']);
    });

    it('Escape solo omite el tutorial si el foco esta en el globo: con otra cosa abierta, es de ella', async () => {
      const { boton } = anclarConBoton('llama');

      render(<TutorialDeFungito cuenta={CUENTA} />);
      await irAlPaso('llama');

      // El panel de la llama manda el foco a su panel y cierra con Escape: el tutorial no.
      boton.focus();
      await usuario.keyboard('{Escape}');

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(tutorialVisto(CUENTA)).toBe(false);

      screen.getByRole('button', { name: 'Siguiente' }).focus();
      await usuario.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(tutorialVisto(CUENTA)).toBe(true);
    });

    it('con el teclado, el foco da la vuelta entre el globo y el elemento', async () => {
      const { boton } = anclarConBoton('llama');

      render(<TutorialDeFungito cuenta={CUENTA} />);
      await irAlPaso('llama');

      expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();

      await usuario.tab();
      expect(boton).toHaveFocus();

      await usuario.tab();
      expect(screen.getByRole('button', { name: 'Omitir' })).toHaveFocus();

      await usuario.tab({ shift: true });
      expect(boton).toHaveFocus();

      await usuario.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
    });

    it('con el foco en otra cosa (lo que abrio el elemento), Tab no es del tutorial', async () => {
      anclarConBoton('llama');
      const panel = document.createElement('button');

      panel.textContent = 'Algo abierto';
      document.body.append(panel);
      render(<TutorialDeFungito cuenta={CUENTA} />);
      await irAlPaso('llama');
      panel.focus();

      const tecla = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

      document.dispatchEvent(tecla);

      expect(tecla.defaultPrevented).toBe(false);
      expect(panel).toHaveFocus();
      panel.remove();
    });

    it('centrado, en cambio, el foco no sale del dialogo: Tab desde fuera entra', async () => {
      const fuera = document.createElement('button');

      document.body.append(fuera);
      render(<TutorialDeFungito cuenta={CUENTA} />);
      fuera.focus();

      await usuario.tab();

      expect(screen.getByRole('button', { name: 'Omitir' })).toHaveFocus();
      fuera.remove();
    });

    it('mientras esta abierto, el cuerpo de la pagina lo dice, para que lo que abre el elemento quede encima', async () => {
      const { unmount } = render(<TutorialDeFungito cuenta={CUENTA} />);

      expect(document.body).toHaveClass('con-tutorial');

      await usuario.click(screen.getByRole('button', { name: 'Omitir' }));
      expect(document.body).not.toHaveClass('con-tutorial');

      volverAVerElTutorial(CUENTA);
      unmount();
      render(<TutorialDeFungito cuenta={CUENTA} />);
      expect(document.body).toHaveClass('con-tutorial');
    });

    it('ya probado, el cuerpo de la pagina dice cual era el elemento, hasta que se sigue', async () => {
      const { boton } = anclarConBoton('asistente', { left: 4, top: 571, width: 88, height: 88 });

      render(<TutorialDeFungito cuenta={CUENTA} />);
      await irAlPaso('asistente');
      expect(document.body.dataset.tutorialProbando).toBeUndefined();

      await usuario.click(boton);
      expect(document.body.dataset.tutorialProbando).toBe('asistente');

      await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(document.body.dataset.tutorialProbando).toBeUndefined();
    });

    it('al desmontarse tampoco deja la marca', () => {
      const { unmount } = render(<TutorialDeFungito cuenta={CUENTA} />);

      unmount();

      expect(document.body).not.toHaveClass('con-tutorial');
    });
  });
});

/**
 * Las capas y el puntero del tutorial pegado a un elemento (SCRUM-252). jsdom no apila ni atrapa
 * el puntero: se vigila que las reglas esten, y el resultado se midio en un navegador.
 */
describe('las capas y el puntero del tutorial (SCRUM-252)', () => {
  const sinNotas = HOJA.replace(/\/\*[\s\S]*?\*\//g, '');

  const bloque = (selector: string): string => {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

    return new RegExp(String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`).exec(sinNotas)?.[1] ?? '';
  };

  it('la raiz pegada a un elemento no recibe el puntero, y el hueco lo deja pasar', () => {
    expect(bloque('.tutorial--spotlight')).toMatch(/pointer-events:\s*none/);
    expect(bloque('.tutorial__hueco')).toMatch(/pointer-events:\s*none/);
  });

  it('los paneles de alrededor y el globo si lo reciben, porque el puntero se hereda', () => {
    const conjunto =
      /\.tutorial--spotlight \.tutorial__caja,\s*\.tutorial__bloqueo\s*\{([^}]*)\}/.exec(
        sinNotas,
      )?.[1];

    expect(conjunto).toMatch(/pointer-events:\s*auto/);
  });

  it('lo que abren la llama, el semaforo y el asistente queda por encima del tutorial (z-index 70)', () => {
    const regla = /body\.con-tutorial \.llama__velo,[^{]*\{([^}]*)\}/.exec(sinNotas)?.[1] ?? '';
    const zDelTutorial = Number(/\.tutorial\s*\{[^}]*z-index:\s*(\d+)/.exec(sinNotas)?.[1]);

    expect(zDelTutorial).toBe(70);
    expect(Number(/z-index:\s*(\d+)/.exec(regla)?.[1])).toBeGreaterThan(zDelTutorial);
    expect(/body\.con-tutorial \.llama__velo,[^{]*/.exec(sinNotas)?.[0]).toMatch(
      /\.llama__panel[\s\S]*\.semaforo-velo[\s\S]*\.asistente-velo/,
    );
    // La mascota posada sobre el asistente va un poco mas arriba que su velo.
    expect(
      Number(/z-index:\s*(\d+)/.exec(bloque('body.con-tutorial .mascota--con-asistente'))?.[1]),
    ).toBeGreaterThan(Number(/z-index:\s*(\d+)/.exec(regla)?.[1]));
  });

  it('el globo queda por encima de los paneles que atrapan el puntero: sin eso, ya probado no recibe ni un clic', () => {
    // Los paneles son posicionados y la caja de ya probado, que va en el borde, no lo es: pintada
    // debajo de ellos. Se vio en el navegador: «Siguiente» no respondia.
    const caja = bloque('.tutorial--spotlight .tutorial__caja');

    expect(caja).toMatch(/position:\s*relative/);
    expect(Number(/z-index:\s*(\d+)/.exec(caja)?.[1])).toBeGreaterThanOrEqual(1);
  });

  it('ya probada, la mascota sube por encima del tutorial para poder pulsar su frase, y por debajo de lo que abre', () => {
    const mascota = bloque("body[data-tutorial-probando='asistente'] .mascota");
    const z = Number(/z-index:\s*(\d+)/.exec(mascota)?.[1]);
    const deLosPaneles = Number(
      /z-index:\s*(\d+)/.exec(
        /body\.con-tutorial \.llama__velo,[^{]*\{([^}]*)\}/.exec(sinNotas)?.[1] ?? '',
      )?.[1],
    );

    expect(z).toBeGreaterThan(70);
    expect(z).toBeLessThan(deLosPaneles);
  });

  it('con movimiento reducido el globo aparece ya puesto', () => {
    expect(sinNotas).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.tutorial--spotlight \.tutorial__globo\s*\{[^}]*animation:\s*none/,
    );
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

    // Siempre esta, para que los botones no cambien de sitio, y apagado donde no hay a donde volver.
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByRole('button', { name: 'Atrás' })).toBeEnabled();

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

/**
 * Los botones del tutorial (SCRUM-246). jsdom no pinta, asi que lo que se vigila son las reglas de
 * cada estado: que no se quiten sin darse cuenta. Los contrastes se midieron en un navegador, en
 * claro y en oscuro, y estan en la descripcion del PR.
 */
describe('los botones del tutorial tienen todos sus estados', () => {
  const sinNotas = HOJA.replace(/\/\*[\s\S]*?\*\//g, '');

  it.each([
    ['apagado', '.tutorial__boton:disabled', /cursor:\s*not-allowed/],
    ['apagado: no solo cambia el color', '.tutorial__boton:disabled', /border-style:\s*dashed/],
    ['pulsado', '.tutorial__boton:active:not(:disabled)', /transform:\s*scale\(/],
    ['foco visible', '.tutorial__boton:focus-visible', /outline:\s*3px solid/],
  ])('%s', (_estado, selector, declaracion) => {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const bloque = new RegExp(String.raw`${escapado}[^{]*\{([^}]*)\}`).exec(sinNotas)?.[1];

    expect(bloque, selector).toMatch(declaracion);
  });

  it('el hover solo se aplica donde hay raton, y no sobre un boton apagado', () => {
    expect(sinNotas).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)\s*\{[^@]*\.tutorial__boton:hover:not\(:disabled\)/,
    );
  });
});
