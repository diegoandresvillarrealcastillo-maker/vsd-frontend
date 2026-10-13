import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

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
