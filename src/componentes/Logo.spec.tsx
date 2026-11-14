import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RUTAS } from '../rutas/rutas.ts';
import { Isotipo } from './Isotipo.tsx';
import { Logo } from './Logo.tsx';

function pintar(elemento: React.ReactElement) {
  return render(<MemoryRouter>{elemento}</MemoryRouter>);
}

describe('Logo (SCRUM-287)', () => {
  it('por omision es el logo completo y lleva a la portada', () => {
    pintar(<Logo />);

    const enlace = screen.getByRole('link', { name: 'VSD Health' });

    expect(enlace).toHaveAttribute('href', RUTAS.INICIO);
    expect(screen.getByRole('img', { name: 'VSD Health' })).toHaveAttribute(
      'src',
      '/logo-completo.webp',
    );
  });

  it('la variante `loto` usa el loto solo', () => {
    pintar(<Logo variante="loto" />);

    expect(screen.getByRole('img', { name: 'VSD Health' })).toHaveAttribute(
      'src',
      '/loto-vsd-health.webp',
    );
  });

  it('con el nombre escrito, el texto es el del enlace y la imagen no se anuncia', () => {
    pintar(<Logo variante="loto" conNombre />);

    expect(screen.getByRole('link', { name: 'VSD Health' })).toHaveTextContent('VSD Health');
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Isotipo (SCRUM-287)', () => {
  it('guarda la proporcion del loto al cambiar el alto', () => {
    const { container } = pintar(<Isotipo tamano={40} />);
    const imagen = container.querySelector('img');

    expect(imagen).toHaveAttribute('height', '40');
    expect(imagen).toHaveAttribute('width', String(Math.round((40 * 192) / 130)));
  });
});
