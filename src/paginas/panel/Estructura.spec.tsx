import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { BarraSuperior } from './Estructura.tsx';

/**
 * El boton redondo de la cuenta, en la barra de arriba de toda la aplicacion.
 * Aqui solo se prueba lo que se agrego con la foto de perfil (SCRUM-120).
 */
const { foto } = vi.hoisted(() => ({ foto: { url: null as string | null } }));

vi.mock('../../foto/fotoDePerfil.ts', () => ({ useFotoDePerfil: () => foto.url }));

function sesion(): EstadoDeSesion {
  const bien = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: { user: { email: 'ana@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'ana@ejemplo.test',
    registrarse: bien,
    entrar: bien,
    entrarConGoogle: bien,
    pedirRecuperacion: bien,
    cambiarContrasena: bien,
    pedirCodigoDeVerificacion: bien,
    cambiarContrasenaConCodigo: bien,
    salir: vi.fn().mockResolvedValue(undefined),
  };
}

function pintar() {
  render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter>
        <BarraSuperior conSecciones={false} />
      </MemoryRouter>
    </SesionContexto.Provider>,
  );

  return screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' });
}

describe('el avatar de la barra de arriba (SCRUM-120)', () => {
  it('sin foto, muestra el icono de siempre', () => {
    foto.url = null;

    const avatar = pintar();

    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.querySelector('svg')).not.toBeNull();
  });

  it('con foto, la muestra en lugar del icono', () => {
    foto.url = 'blob:la-foto';

    const avatar = pintar();

    expect(avatar.querySelector('img')).toHaveAttribute('src', 'blob:la-foto');
    expect(avatar.querySelector('svg')).toBeNull();
  });

  it('la foto es decorativa: el boton ya se llama «Abrir el menú de tu cuenta»', () => {
    foto.url = 'blob:la-foto';

    const avatar = pintar();

    expect(avatar.querySelector('img')).toHaveAttribute('alt', '');
    expect(avatar).toHaveAccessibleName('Abrir el menú de tu cuenta');
  });
});
