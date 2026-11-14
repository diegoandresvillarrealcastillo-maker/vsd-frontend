import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EstadoDeCarga } from './EstadoDeCarga.tsx';
import { Esqueleto } from './Esqueleto.tsx';

describe('Esqueleto (SCRUM-180)', () => {
  it('es decorativo: un lector de pantalla no lo anuncia', () => {
    const { container } = render(<Esqueleto />);

    expect(container.querySelector('.esqueleto')).toHaveAttribute('aria-hidden', 'true');
  });

  it('tiene la forma que se le pide, y linea por defecto', () => {
    const { container } = render(
      <>
        <Esqueleto />
        <Esqueleto forma="bloque" />
        <Esqueleto forma="circulo" />
      </>,
    );

    const piezas = [...container.querySelectorAll('.esqueleto')];

    expect(piezas.map((pieza) => pieza.className)).toEqual([
      'esqueleto esqueleto--linea',
      'esqueleto esqueleto--bloque',
      'esqueleto esqueleto--circulo',
    ]);
  });

  it('acepta ancho y alto sin pisar el resto de los estilos', () => {
    const { container } = render(<Esqueleto ancho="40%" alto="2rem" />);
    const pieza = container.querySelector<HTMLElement>('.esqueleto');

    expect(pieza?.style.width).toBe('40%');
    expect(pieza?.style.height).toBe('2rem');
  });
});

describe('EstadoDeCarga (SCRUM-180)', () => {
  it('anuncia que esta cargando y dice que es lo que carga', () => {
    const { getByRole } = render(<EstadoDeCarga mensaje="Cargando tu espacio…" />);
    const estado = getByRole('status');

    expect(estado).toHaveTextContent('Cargando tu espacio…');
    expect(estado).toHaveAttribute('aria-busy', 'true');
  });

  it('el mensaje se ve: con movimiento reducido el esqueleto es solo una forma quieta', () => {
    const { getByText } = render(<EstadoDeCarga mensaje="Cargando tu diario…" />);

    expect(getByText('Cargando tu diario…')).toBeVisible();
  });

  it('las formas no se anuncian: solo el mensaje', () => {
    const { container } = render(<EstadoDeCarga mensaje="Cargando…" tarjetas={2} />);
    const marcas = container.querySelector('.estado-de-carga__marcas');

    expect(marcas).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.estado-de-carga__tarjeta')).toHaveLength(2);
  });

  it('con cero tarjetas no pinta formas y sigue diciendo el mensaje', () => {
    const { container, getByRole } = render(<EstadoDeCarga mensaje="Cargando…" tarjetas={0} />);

    expect(container.querySelectorAll('.esqueleto')).toHaveLength(0);
    expect(getByRole('status')).toHaveTextContent('Cargando…');
  });
});
