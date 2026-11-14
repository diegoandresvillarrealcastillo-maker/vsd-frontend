import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { alPulsarElFondo } from './alPulsarElFondo.ts';

/**
 * Cerrar una ventana al pulsar el fondo (SCRUM-158): el fondo es suyo, lo de dentro
 * no cuenta.
 */
describe('alPulsarElFondo', () => {
  function pintar(alCerrar: () => void) {
    render(
      <div data-testid="fondo" role="presentation" onClick={alPulsarElFondo(alCerrar)}>
        <div role="dialog" aria-label="Ventana">
          <p>Texto</p>
          <button type="button">Dentro</button>
        </div>
      </div>,
    );
  }

  it('cierra al pulsar el fondo', async () => {
    const alCerrar = vi.fn();

    pintar(alCerrar);
    await userEvent.click(screen.getByTestId('fondo'));

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('no cierra al pulsar dentro de la ventana, ni en su texto ni en sus botones', async () => {
    const alCerrar = vi.fn();

    pintar(alCerrar);
    await userEvent.click(screen.getByRole('dialog'));
    await userEvent.click(screen.getByText('Texto'));
    await userEvent.click(screen.getByRole('button', { name: 'Dentro' }));

    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('un boton de dentro que se quita al pulsarlo no cierra la ventana', async () => {
    // El clic sigue subiendo hasta el fondo aunque el boton ya no este: lo que
    // importa es donde se pulso, y se pulso dentro.
    const alCerrar = vi.fn();

    render(
      <div data-testid="fondo" role="presentation" onClick={alPulsarElFondo(alCerrar)}>
        <div role="dialog" aria-label="Ventana">
          <button
            type="button"
            onClick={(evento) => {
              evento.currentTarget.remove();
            }}
          >
            Quitar
          </button>
        </div>
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(alCerrar).not.toHaveBeenCalled();
  });
});
