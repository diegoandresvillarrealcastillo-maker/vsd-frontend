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
  it('es un enlace al panel que se llama como lo que se ve', () => {
    pintar();

    const enlace = screen.getByRole('link', { name: 'VSD-H, inicio' });

    expect(enlace).toHaveAttribute('href', RUTAS.PANEL);
    expect(enlace).toHaveTextContent('VSD-H');
  });

  it('dibuja el isotipo verde con el pulso blanco', () => {
    const { container } = pintar();

    expect(container.querySelector('rect')).toHaveAttribute('fill', '#3d7a6b');
    expect(container.querySelector('path')).toHaveAttribute('stroke', '#ffffff');
  });

  it('no se lee como imagen para quien usa lector de pantalla', () => {
    const { container } = pintar();

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
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
