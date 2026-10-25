import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LlamarAhora } from './LlamarAhora.tsx';
import { telefonoParaMarcar } from './telefonoParaMarcar.ts';

/**
 * «Llamar ahora» (SCRUM-257): un `tel:` con el numero verificado de la linea, y nada
 * mas que un numero que se pueda marcar.
 */
const LINEA = { titulo: 'Línea 192, opción 4', telefono: '192' };

describe('LlamarAhora', () => {
  it('con un telefono, abre el marcador con ese numero', () => {
    render(<LlamarAhora linea={LINEA} />);

    const boton = screen.getByRole('link', { name: 'Llamar ahora: Línea 192, opción 4' });

    expect(boton).toHaveAttribute('href', 'tel:192');
    expect(boton).toHaveTextContent('Llamar ahora');
  });

  it('el nombre accesible empieza por lo que se ve, y dice de cual linea es', () => {
    render(<LlamarAhora linea={LINEA} />);

    expect(screen.getByRole('link')).toHaveAccessibleName(/^Llamar ahora/);
    expect(screen.getByRole('link')).toHaveAccessibleName(/192/);
  });

  it('con una etiqueta, el texto dice cual es y no hace falta mas nombre', () => {
    render(
      <LlamarAhora
        linea={{ ...LINEA, titulo: 'Línea 123', telefono: '123' }}
        etiqueta="Llamar al 123"
      />,
    );

    const boton = screen.getByRole('link', { name: 'Llamar al 123' });

    expect(boton).toHaveAttribute('href', 'tel:123');
  });

  it.each(['+573112801363', '8009112000', '024', '988'])('marca "%s" tal cual', (telefono) => {
    render(<LlamarAhora linea={{ ...LINEA, telefono }} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', `tel:${telefono}`);
  });

  it('sin telefono no hay boton: el directorio internacional, o un servidor anterior', () => {
    const { container } = render(<LlamarAhora linea={{ titulo: 'Directorio internacional' }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    '',
    '12',
    '1234567890123456',
    '192, opción 4',
    '192,4',
    '192 4',
    '800 911 2000',
    'tel:192',
    'javascript:alert(1)',
    '192;4',
    '192#',
    '+',
    '++192',
    '192+',
    '<script>',
  ])('no pinta un boton con "%s": lo que se marca solo puede ser un numero', (telefono) => {
    const { container } = render(<LlamarAhora linea={{ ...LINEA, telefono }} />);

    expect(container).toBeEmptyDOMElement();
    expect(telefonoParaMarcar(telefono)).toBeUndefined();
  });
});
