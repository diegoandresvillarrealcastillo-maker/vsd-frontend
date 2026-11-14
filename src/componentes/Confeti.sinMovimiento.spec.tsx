import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { Confeti } from './Confeti.tsx';

/**
 * En su propio archivo: Framer Motion lee la preferencia una sola vez por carga del
 * modulo, y mezclada con las pruebas del movimiento normal decidiria el valor de todas.
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

describe('Confeti con "reducir movimiento"', () => {
  it('no pinta nada: la celebracion queda en el resto de la pantalla', () => {
    const { container } = render(<Confeti />);

    expect(container).toBeEmptyDOMElement();
  });
});
