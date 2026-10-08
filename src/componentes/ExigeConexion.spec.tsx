import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExigeConexion, NECESITAS_CONEXION } from './ExigeConexion.tsx';

afterEach(() => {
  vi.restoreAllMocks();
});

function conLaRed(hay: boolean) {
  return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(hay);
}

function cambiarLaRed(red: ReturnType<typeof conLaRed>, hay: boolean) {
  act(() => {
    red.mockReturnValue(hay);
    window.dispatchEvent(new Event(hay ? 'online' : 'offline'));
  });
}

/** Un formulario de prueba: un campo, un boton y un enlace, y el estado del campo a la vista. */
function Formulario() {
  const [texto, setTexto] = useState('');

  return (
    <ExigeConexion>
      <label>
        Nombre
        <input value={texto} onChange={(evento) => setTexto(evento.target.value)} />
      </label>
      <button type="button">Guardar</button>
      <a href="#ayuda">Ayuda</a>
    </ExigeConexion>
  );
}

describe('ExigeConexion (SCRUM-142)', () => {
  it('con conexion no estorba: ni aviso ni nada deshabilitado', () => {
    conLaRed(true);

    render(<Formulario />);

    expect(screen.queryByText(NECESITAS_CONEXION)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('sin conexion dice que la necesita, y deshabilita todo lo de dentro', () => {
    conLaRed(false);

    render(<Formulario />);

    expect(screen.getByText('Necesitas conexión para esto.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('el aviso se anuncia solo y es lo que describe el bloque', () => {
    conLaRed(false);

    render(<Formulario />);

    const aviso = screen.getByRole('status');

    expect(aviso).toHaveTextContent(NECESITAS_CONEXION);
    expect(screen.getByRole('group')).toHaveAccessibleDescription(NECESITAS_CONEXION);
  });

  it('con conexion el bloque no dice que este descrito por nada', () => {
    conLaRed(true);

    render(<Formulario />);

    expect(screen.getByRole('group')).not.toHaveAttribute('aria-describedby');
  });

  it('lo escrito no se pierde: se va la red, vuelve, y el campo sigue como estaba', async () => {
    const red = conLaRed(true);

    render(<Formulario />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Marina');

    cambiarLaRed(red, false);

    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Marina');

    cambiarLaRed(red, true);

    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Marina');
    expect(screen.queryByText(NECESITAS_CONEXION)).not.toBeInTheDocument();
  });

  it('los enlaces no son controles de formulario: siguen sirviendo', () => {
    conLaRed(false);

    render(<Formulario />);

    expect(screen.getByRole('link', { name: 'Ayuda' })).toHaveAttribute('href', '#ayuda');
  });
});
