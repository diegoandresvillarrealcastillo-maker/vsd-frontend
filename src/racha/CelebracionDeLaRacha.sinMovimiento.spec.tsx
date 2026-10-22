import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { CelebracionDeLaRacha } from './CelebracionDeLaRacha.tsx';

/**
 * La celebracion con «reducir movimiento» (SCRUM-243).
 *
 * En su propio archivo: Framer Motion lee la preferencia una sola vez por carga del modulo, y
 * mezclada con las pruebas del movimiento normal decidiria el valor de todas.
 *
 * Con la preferencia puesta la informacion es la misma —los dias, la semana, la mascota y la frase—
 * pero nada salta ni vuela: el contador muestra ya el numero final, no hay confeti, chispas, fuegos
 * artificiales ni lluvia, y el boton esta ahi desde el primer momento.
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

function pintar(hito: number | null, dias: number) {
  return render(
    <div className="actividad">
      <CelebracionDeLaRacha
        momento={hito === null ? { tipo: 'dia' } : { tipo: 'hito', hito }}
        racha={rachaDePrueba({ dias })}
        mascota={{ forma: 'ori', nombre: 'Ori' }}
        alCerrar={vi.fn()}
      />
    </div>,
  );
}

describe('CelebracionDeLaRacha con "reducir movimiento"', () => {
  it('el contador muestra ya el numero final, sin el que se va', () => {
    const { container } = pintar(null, 12);

    expect(container.querySelector('.racha-celebracion__cifra-nueva')?.textContent).toBe('12');
    expect(container.querySelector('.racha-celebracion__cifra-vieja')).toBeNull();
  });

  it('sigue diciendo todo: dialogo, semana, frase y boton', () => {
    pintar(14, 14);

    expect(screen.getByRole('dialog', { name: '¡14 días! Dos semanas' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tu semana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir' })).toHaveFocus();
  });

  it('en la escena del ano no hay nada que se mueva: ni confeti, ni chispas, ni fuegos, ni lluvia', () => {
    const { container } = pintar(365, 365);

    expect(container.querySelector('.confeti')).toBeNull();
    expect(container.querySelector('.racha-celebracion__estallido')).toBeNull();
    expect(container.querySelector('.racha-celebracion__orbita')).toBeNull();
    expect(container.querySelector('.racha-celebracion__fuegos')).toBeNull();
    expect(container.querySelector('.racha-celebracion__lluvia')).toBeNull();
  });

  it('lo que es solo luz se queda, quieto: la estrella, el halo y los rayos', () => {
    const { container } = pintar(365, 365);

    expect(container.querySelector('.racha-celebracion__estrella')).not.toBeNull();
    expect(container.querySelector('.racha-celebracion__halo')).not.toBeNull();
    expect(container.querySelector('.racha-celebracion__rayos')).not.toBeNull();
  });
});
