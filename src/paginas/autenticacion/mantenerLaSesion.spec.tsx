import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Acceso } from './Acceso.tsx';
import { Registro } from './Registro.tsx';

// Con las credenciales de Google puestas, para poder probar el boton.
vi.mock('../../infraestructura/entorno.ts', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../infraestructura/entorno.ts')>();

  return { ...original, entorno: { ...original.entorno, conGoogle: true } };
});

/**
 * «Mantener la sesión en este equipo» (SCRUM-164, decisión D9).
 *
 * Buena parte de quien usa VSD Health entra desde una sala de cómputo. Una
 * sesión que se queda abierta allí es el diario de una persona a la vista de la
 * siguiente, así que lo seguro tiene que ser lo que pasa si no se toca nada.
 */
function estado(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
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
    ...parcial,
  };
}

function pintar(pantalla: React.ReactNode, valor: EstadoDeSesion) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[RUTAS.ACCESO]}>
        <Routes>
          <Route path={RUTAS.ACCESO} element={pantalla} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

describe('La casilla «Mantener la sesión en este equipo»', () => {
  it('empieza desmarcada', () => {
    pintar(<Acceso />, estado());

    expect(screen.getByLabelText(/Mantener la sesión en este equipo/)).not.toBeChecked();
  });

  it('dice en su nota cuándo conviene marcarla y qué pasa si no', () => {
    pintar(<Acceso />, estado());

    const casilla = screen.getByLabelText(/Mantener la sesión en este equipo/);
    const nota = casilla.getAttribute('aria-describedby');

    expect(nota).not.toBeNull();
    expect(document.getElementById(nota ?? '')).toHaveTextContent(/solo en tu propio equipo/i);
    expect(document.getElementById(nota ?? '')).toHaveTextContent(/cierra al cerrar la pestaña/i);
  });

  it('se maneja con teclado: se alcanza con Tab y se marca con la barra espaciadora', async () => {
    const usuario = userEvent.setup({ delay: null });

    pintar(<Acceso />, estado());

    const casilla = screen.getByLabelText(/Mantener la sesión en este equipo/);

    await usuario.click(screen.getByLabelText('Contraseña'));

    // Entre la contraseña y la casilla puede haber un control (mostrar la
    // contraseña): se avanza con Tab hasta llegar, y tiene que llegar pronto.
    for (let tabulaciones = 0; tabulaciones < 3 && document.activeElement !== casilla;) {
      await usuario.tab();
      tabulaciones += 1;
    }

    expect(casilla).toHaveFocus();

    await usuario.keyboard(' ');

    expect(casilla).toBeChecked();
  });

  it('no se puede cambiar mientras se envía el formulario', async () => {
    const usuario = userEvent.setup({ delay: null });
    const entrar = vi.fn(() => new Promise<never>(() => undefined));

    pintar(<Acceso />, estado({ entrar }));

    await usuario.click(screen.getByLabelText('Correo'));
    await usuario.paste('alguien@ejemplo.com');
    await usuario.click(screen.getByLabelText('Contraseña'));
    await usuario.paste('loQueSea123');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByLabelText(/Mantener la sesión en este equipo/)).toBeDisabled();
  });
});

describe('«Continuar con Google»', () => {
  it('en la pantalla de acceso, sin tocar la casilla, no mantiene la sesión', async () => {
    const usuario = userEvent.setup({ delay: null });
    const entrarConGoogle = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Acceso />, estado({ entrarConGoogle }));
    await usuario.click(screen.getByRole('button', { name: /Google/i }));

    expect(entrarConGoogle).toHaveBeenCalledWith(false);
  });

  it('en la pantalla de acceso, con la casilla marcada, sí la mantiene', async () => {
    const usuario = userEvent.setup({ delay: null });
    const entrarConGoogle = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Acceso />, estado({ entrarConGoogle }));
    await usuario.click(screen.getByLabelText(/Mantener la sesión en este equipo/));
    await usuario.click(screen.getByRole('button', { name: /Google/i }));

    expect(entrarConGoogle).toHaveBeenCalledWith(true);
  });

  it('en la de registro no mantiene la sesión: allí no se pregunta, y lo seguro es no hacerlo', async () => {
    const usuario = userEvent.setup({ delay: null });
    const entrarConGoogle = vi.fn().mockResolvedValue({ ok: true });

    pintar(<Registro />, estado({ entrarConGoogle }));
    await usuario.click(screen.getByRole('button', { name: /Google/i }));

    expect(entrarConGoogle).toHaveBeenCalledWith(false);
  });
});
