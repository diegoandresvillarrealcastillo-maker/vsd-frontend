import { render, screen, within } from '@testing-library/react';
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

describe('El pie y el cuerpo de la portada: los telefonos (SCRUM-257)', () => {
  it('el equipo deja su telefono tecnico, y dice que es solo para problemas tecnicos', () => {
    pintar();

    const pie = screen.getByRole('contentinfo');

    expect(within(pie).getByRole('link', { name: /Llamar a Diego/ })).toHaveAttribute(
      'href',
      'tel:+573112801363',
    );
    expect(within(pie).getByRole('link', { name: /Llamar a Samuel/ })).toHaveAttribute(
      'href',
      'tel:+573245889281',
    );
    expect(pie).toHaveTextContent('311 280 1363');
    expect(pie).toHaveTextContent('324 588 9281');
    expect(pie).toHaveTextContent('Son solo para problemas técnicos de la aplicación');
    expect(pie).toHaveTextContent('No son una línea de ayuda');
  });

  it('las dos lineas de Colombia que nombra la portada se pueden marcar, y son las de siempre', () => {
    pintar();

    expect(screen.getByRole('link', { name: 'Llamar al 192' })).toHaveAttribute('href', 'tel:192');
    expect(screen.getByRole('link', { name: 'Llamar al 123' })).toHaveAttribute('href', 'tel:123');
  });

  it('el telefono del equipo no esta junto a «Llamar ahora»: ese texto es solo de las lineas', () => {
    pintar();

    expect(screen.queryByRole('link', { name: /Llamar ahora/ })).not.toBeInTheDocument();
  });
});
