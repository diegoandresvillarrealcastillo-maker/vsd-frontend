import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BarraDeProgreso } from './BarraDeProgreso.tsx';
import { OpcionGrande } from './OpcionGrande.tsx';
import { PasoAnimado } from './PasoAnimado.tsx';
import { VozDeLaMascota } from './VozDeLaMascota.tsx';

/**
 * En su propio archivo: Framer Motion lee la preferencia una sola vez por carga del modulo, y
 * mezclada con las pruebas del movimiento normal decidiria el valor de todas.
 *
 * Con «reducir movimiento» las actividades siguen siendo las mismas, solo que quietas: la barra
 * se llena de golpe, el paso nuevo no se desplaza y el telefono no vibra.
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

describe('El kit de las actividades con "reducir movimiento"', () => {
  it('la barra se llena de golpe, sin resorte', () => {
    const { container } = render(<BarraDeProgreso paso={3} total={5} hechos={2} />);

    expect(container.querySelector<HTMLElement>('.viva-progreso__relleno')?.style.width).toBe(
      '40%',
    );
  });

  it('el globo cambia de texto sin esperar ni rebotar', () => {
    const { rerender } = render(<VozDeLaMascota mascota={null} mensaje="Uno" />);

    rerender(<VozDeLaMascota mascota={null} mensaje="Dos" latido={3} />);

    expect(screen.getByText('Dos')).toBeInTheDocument();
    expect(document.querySelector<HTMLElement>('.viva-voz__globo > div')?.style.opacity).not.toBe(
      '0',
    );
  });

  it('el paso nuevo no se desplaza: se pinta sin moverse de sitio', () => {
    render(
      <PasoAnimado clave="uno" direccion={1} titulo="Primero">
        <p>Hola</p>
      </PasoAnimado>,
    );

    const seccion = screen.getByRole('region', { name: 'Primero' });

    expect(seccion.style.transform).not.toMatch(/translateX\((?!0)/);
  });

  it('elegir una opcion no hace vibrar el telefono', async () => {
    const vibrar = vi.fn();

    Object.defineProperty(navigator, 'vibrate', { value: vibrar, configurable: true });

    render(
      <OpcionGrande
        tipo="radio"
        nombre="x"
        valor="a"
        marcada={false}
        alCambiar={() => undefined}
        texto="Una"
      />,
    );

    await userEvent.setup({ delay: null }).click(screen.getByRole('radio'));

    expect(vibrar).not.toHaveBeenCalled();

    Reflect.deleteProperty(navigator, 'vibrate');
  });
});
