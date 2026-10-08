import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Portada } from './Portada.tsx';

/**
 * El pie de la portada no muestra el ambiente en produccion (L-07 de la auditoria
 * 360): es un dato interno que le sirve a quien prueba en desarrollo o en PRE, y a
 * nadie mas.
 */
const { entorno } = vi.hoisted(() => ({
  entorno: { nombre: 'development', conGoogle: false },
}));

vi.mock('../../infraestructura/entorno.ts', () => ({ entorno }));

function estado(): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: null,
    cargando: false,
    correo: null,
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn(),
  };
}

function pintar() {
  return render(
    <SesionContexto.Provider value={estado()}>
      <MemoryRouter>
        <Portada />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

beforeEach(() => {
  entorno.nombre = 'development';
});

describe('El pie de la portada y el ambiente', () => {
  it.each(['development', 'preproduction'])('en %s dice en que ambiente esta', (nombre) => {
    entorno.nombre = nombre;
    pintar();

    expect(screen.getByText(`Ambiente: ${nombre}`)).toBeInTheDocument();
  });

  it('en produccion no lo muestra', () => {
    entorno.nombre = 'production';
    const { container } = pintar();

    expect(screen.queryByText(/Ambiente:/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/production|preproduction|development/);
  });

  it('el resto del pie sigue igual en produccion: el aviso, los documentos y el año', () => {
    entorno.nombre = 'production';
    pintar();

    const pie = screen.getByRole('contentinfo');

    expect(pie).toHaveTextContent(`© ${new Date().getFullYear()} VSD Health`);
    expect(pie).toHaveTextContent('no diagnostica');
    expect(screen.getByRole('navigation', { name: 'Documentos legales' })).toBeInTheDocument();
  });
});
