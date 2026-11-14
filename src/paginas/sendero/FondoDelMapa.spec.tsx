import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { Icono } from '../panel/Icono.tsx';
import { FORMA_QUE_FLOTA } from '../panel/modulos.ts';
import { FondoDelMapa } from './FondoDelMapa.tsx';

/**
 * El fondo animado detras del arbol de cada modulo (SCRUM-310): hojas, destellos o corazones segun
 * el modulo. Es adorno: no se toca ni lo lee un lector de pantalla.
 */
const MODULOS: readonly Modulo[] = ['bienestar', 'cognicion', 'emociones'];

function pintar(modulo: Modulo) {
  const { container } = render(<FondoDelMapa modulo={modulo} />);

  return container.firstElementChild as HTMLElement;
}

function dibujo(nombre: Parameters<typeof Icono>[0]['nombre']): string {
  const { container } = render(<Icono nombre={nombre} />);

  return container.querySelector('svg')!.innerHTML;
}

describe('FondoDelMapa', () => {
  it.each(MODULOS)(
    'es solo adorno en %s: oculto, sin texto y sin nada que se pueda tocar',
    (modulo) => {
      const fondo = pintar(modulo);

      expect(fondo).toHaveAttribute('aria-hidden', 'true');
      expect(fondo.textContent).toBe('');
      expect(fondo.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
    },
  );

  it.each(MODULOS)(
    'en %s lleva su clase de modulo, para que cada uno se mueva a lo suyo',
    (modulo) => {
      expect(pintar(modulo)).toHaveClass('mapa-fondo', `mapa-fondo--${modulo}`);
    },
  );

  it.each(MODULOS)('en %s flotan seis formas, todas la del modulo', (modulo) => {
    const formas = pintar(modulo).querySelectorAll('.mapa-fondo__forma');

    expect(formas).toHaveLength(6);

    for (const forma of formas) {
      expect(forma.querySelector('svg')!.innerHTML).toBe(dibujo(FORMA_QUE_FLOTA[modulo]));
    }
  });

  it('cada modulo flota una forma distinta: hojas, destellos y corazones', () => {
    expect(new Set(MODULOS.map((modulo) => FORMA_QUE_FLOTA[modulo])).size).toBe(3);
    expect(FORMA_QUE_FLOTA).toEqual({
      bienestar: 'leaf',
      cognicion: 'sparkles',
      emociones: 'heart',
    });
  });

  it('cada forma sube a su ritmo y desde su sitio, sin azar: pintarlo dos veces da lo mismo', () => {
    const una = [...pintar('bienestar').querySelectorAll<HTMLElement>('.mapa-fondo__forma')];
    const otra = [...pintar('bienestar').querySelectorAll<HTMLElement>('.mapa-fondo__forma')];

    expect(una.map((f) => f.getAttribute('style'))).toEqual(
      otra.map((f) => f.getAttribute('style')),
    );
    expect(new Set(una.map((f) => f.style.getPropertyValue('--x'))).size).toBe(6);
    expect(new Set(una.map((f) => f.style.getPropertyValue('--dur'))).size).toBeGreaterThan(3);
  });
});
