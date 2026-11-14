import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { SelectorDeTema } from './SelectorDeTema.tsx';

/**
 * Va en su propio archivo porque Framer Motion lee la preferencia una sola vez
 * por carga del modulo: mezclada con las pruebas del movimiento normal, el
 * valor que se fijara primero decidiria el de todas.
 */
beforeAll(() => {
  window.matchMedia = (consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'),
    media: consulta,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
});

describe('SelectorDeTema con "reducir movimiento"', () => {
  it('cambia el tema sin marcar ningun movimiento', () => {
    document.documentElement.dataset.tema = 'claro';
    render(<SelectorDeTema />);

    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }));

    // El tema cambia igual: lo que se quita es el recorrido, no la funcion.
    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(screen.getByRole('group', { name: 'Tema de la aplicación' })).not.toHaveAttribute(
      'data-moviendo',
    );
  });
});
