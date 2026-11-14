import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { RUTAS } from '../rutas/rutas.ts';
import { MarcaDeLaApp } from './MarcaDeLaApp.tsx';

function pintar() {
  return render(
    <MemoryRouter>
      <MarcaDeLaApp />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-tema');
});

describe('MarcaDeLaApp', () => {
  it('es un enlace a la portada que se llama como lo que se ve', () => {
    pintar();

    const enlace = screen.getByRole('link', { name: 'VSD-H, inicio' });

    // La portada y no el panel (SCRUM-287): con la sesion abierta, la marca lleva a la portada
    // informativa y esta ofrece "Ir a mi panel".
    expect(enlace).toHaveAttribute('href', RUTAS.INICIO);
    expect(enlace).toHaveTextContent('VSD-H');
  });

  it('dibuja el loto y no el pulso de antes', () => {
    const { container } = pintar();

    expect(container.querySelector('img.isotipo')).toHaveAttribute('src', '/loto-vsd-health.webp');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('no se lee como imagen para quien usa lector de pantalla', () => {
    const { container } = pintar();
    const loto = container.querySelector('img.isotipo');

    expect(loto).toHaveAttribute('aria-hidden', 'true');
    expect(loto).toHaveAttribute('alt', '');
  });

  it('es identica en el tema claro y en el oscuro', () => {
    // El motivo de que exista: la marca no puede cambiar de cara segun el tema.
    document.documentElement.setAttribute('data-tema', 'claro');
    const claro = pintar();
    const enClaro = claro.container.innerHTML;
    claro.unmount();

    document.documentElement.setAttribute('data-tema', 'oscuro');
    const oscuro = pintar();

    expect(oscuro.container.innerHTML).toBe(enClaro);
  });
});
