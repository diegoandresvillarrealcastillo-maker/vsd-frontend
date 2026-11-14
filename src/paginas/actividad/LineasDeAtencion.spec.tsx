import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { LineasDeAtencion } from './LineasDeAtencion.tsx';

/**
 * Las lineas despues de una actividad: «Llamar ahora» (SCRUM-257) sale solo con un
 * telefono verificado.
 */
const CON_TELEFONO = {
  id: 'l-192',
  titulo: 'Línea 192, opción 4',
  descripcion: 'Se marca 192 y se elige la opción 4.',
  tipo: 'contacto',
  cobertura: 'nacional',
  enlace: 'https://www.minsalud.gov.co/',
  telefono: '192',
};

const SIN_TELEFONO = {
  id: 'directorio',
  titulo: 'Directorio internacional de líneas de ayuda',
  tipo: 'contacto',
  cobertura: 'internacional',
  enlace: 'https://findahelpline.com/',
};

beforeEach(() => {
  fijarLaZonaDeLaCuenta('America/Bogota');
});

describe('LineasDeAtencion y «Llamar ahora»', () => {
  it('una linea con telefono trae su boton, con la opcion a la vista en la descripcion', () => {
    render(<LineasDeAtencion lineas={[CON_TELEFONO]} />);

    expect(screen.getByRole('link', { name: 'Llamar ahora: Línea 192, opción 4' })).toHaveAttribute(
      'href',
      'tel:192',
    );
    expect(screen.getByText('Se marca 192 y se elige la opción 4.')).toBeInTheDocument();
  });

  it('la que no trae telefono no tiene boton, y conserva su enlace', () => {
    render(<LineasDeAtencion lineas={[SIN_TELEFONO]} />);

    expect(screen.queryByRole('link', { name: /Llamar ahora/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Más información sobre/ })).toHaveAttribute(
      'href',
      'https://findahelpline.com/',
    );
  });

  it('con las lineas de Colombia de respaldo, la 192 y la 123 se pueden marcar', () => {
    render(<LineasDeAtencion lineas={undefined} />);

    expect(screen.getByRole('link', { name: /Llamar ahora: Línea 192/ })).toHaveAttribute(
      'href',
      'tel:192',
    );
    expect(screen.getByRole('link', { name: /Llamar ahora: Línea 123/ })).toHaveAttribute(
      'href',
      'tel:123',
    );
  });

  it('fuera de Colombia, sin lineas del servidor, no hay ningun boton: se manda al directorio', () => {
    fijarLaZonaDeLaCuenta('Europe/Madrid');
    render(<LineasDeAtencion lineas={undefined} />);

    expect(screen.queryByRole('link', { name: /Llamar ahora/ })).not.toBeInTheDocument();
  });
});
