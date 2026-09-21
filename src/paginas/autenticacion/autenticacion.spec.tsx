import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Acceso } from './Acceso.tsx';
import { Recuperar } from './Recuperar.tsx';
import { Registro } from './Registro.tsx';

/**
 * Se construye el estado a mano en vez de levantar el proveedor. Asi las
 * pruebas hablan de lo que hacen las pantallas y no dependen de Supabase ni de
 * la red.
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

describe('Registro', () => {
  it('no crea la cuenta sin el consentimiento', async () => {
    // No es una validacion de formulario cualquiera. Sin autorizacion previa y
    // expresa no hay base legal para guardar un solo dato de salud.
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await userEvent.type(screen.getByLabelText('Correo'), 'alguien@ucundinamarca.edu.co');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'unaContrasenaLarga');
    await userEvent.type(screen.getByLabelText('Repite la contrasena'), 'unaContrasenaLarga');

    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(screen.getByText(/hace falta aceptar el aviso/i)).toBeInTheDocument();
  });

  it('avisa cuando las dos contrasenas no coinciden', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await userEvent.type(screen.getByLabelText('Correo'), 'alguien@ucundinamarca.edu.co');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'unaContrasenaLarga');
    await userEvent.type(screen.getByLabelText('Repite la contrasena'), 'otraDistinta');
    await userEvent.click(screen.getByLabelText(/Acepto el tratamiento/));

    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
  });

  it('rechaza una contrasena demasiado corta antes de ir al servidor', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await userEvent.type(screen.getByLabelText('Correo'), 'alguien@ucundinamarca.edu.co');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'corta');
    await userEvent.type(screen.getByLabelText('Repite la contrasena'), 'corta');
    await userEvent.click(screen.getByLabelText(/Acepto el tratamiento/));

    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();

    // Se busca por `alert` y no por el texto: el mismo mensaje aparece tambien
    // como ayuda permanente bajo el campo, y buscar el texto suelto
    // encontraria los dos sin distinguir cual es el error.
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos 8 caracteres/i);
  });

  it('crea la cuenta con todo en orden, y con el consentimiento marcado', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await userEvent.type(screen.getByLabelText('Correo'), 'alguien@ucundinamarca.edu.co');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'unaContrasenaLarga');
    await userEvent.type(screen.getByLabelText('Repite la contrasena'), 'unaContrasenaLarga');
    await userEvent.click(screen.getByLabelText(/Acepto el tratamiento/));

    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).toHaveBeenCalledWith({
      correo: 'alguien@ucundinamarca.edu.co',
      contrasena: 'unaContrasenaLarga',
      recordar: true,
      aceptaElAviso: true,
    });
  });
});

describe('Acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pasa "no recordar" cuando se marca la casilla', async () => {
    // Es la casilla de las salas de computo de la universidad. Si el valor no
    // viajara, la sesion quedaria abierta en un equipo compartido.
    const entrar = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Acceso />, estado({ entrar }));

    await userEvent.type(screen.getByLabelText('Correo'), 'alguien@ucundinamarca.edu.co');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'loQueSea123');
    await userEvent.click(screen.getByLabelText(/No recordar en este equipo/));

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).toHaveBeenCalledWith(
      expect.objectContaining({ recordar: false }) as Record<string, unknown>,
    );
  });

  it('recuerda el equipo si no se marca nada', async () => {
    const entrar = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Acceso />, estado({ entrar }));

    await userEvent.type(screen.getByLabelText('Correo'), 'alguien@ucundinamarca.edu.co');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'loQueSea123');

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).toHaveBeenCalledWith(
      expect.objectContaining({ recordar: true }) as Record<string, unknown>,
    );
  });

  it('muestra el error sin decir si la cuenta existe', async () => {
    const entrar = vi
      .fn()
      .mockResolvedValue({ ok: false, mensaje: 'El correo o la contrasena no coinciden.' });

    pintar(<Acceso />, estado({ entrar }));

    await userEvent.type(screen.getByLabelText('Correo'), 'noexiste@ejemplo.test');
    await userEvent.type(screen.getByLabelText('Contrasena'), 'loQueSea123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const aviso = await screen.findByRole('alert');

    expect(aviso).toHaveTextContent('El correo o la contrasena no coinciden.');
    // Cualquiera de estas frases permitiria averiguar quien tiene cuenta
    // probando direcciones una a una.
    expect(aviso).not.toHaveTextContent(/no existe|no registrado|no encontrad/i);
  });
});

describe('Recuperar', () => {
  it('responde lo mismo exista la cuenta o no', async () => {
    const pedirRecuperacion = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Recuperar />, estado({ pedirRecuperacion }));

    await userEvent.type(screen.getByLabelText('Correo'), 'quiensabe@ejemplo.test');
    await userEvent.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

    // "Si existe una cuenta" es deliberado: confirmar que un correo esta
    // registrado convertiria esta pantalla en un directorio de usuarios.
    expect(await screen.findByText(/si existe una cuenta/i)).toBeInTheDocument();
  });
});

describe('accesibilidad de las tres pantallas', () => {
  it('todos los campos tienen etiqueta asociada', () => {
    // Un input sin etiqueta deja a quien usa lector de pantalla sin saber que
    // se le pide. Es el fallo de accesibilidad mas facil de cometer.
    for (const pantalla of [<Acceso key="a" />, <Registro key="r" />, <Recuperar key="c" />]) {
      const { unmount } = pintar(pantalla, estado());

      for (const campo of screen.getAllByRole('textbox')) {
        expect(campo).toHaveAccessibleName();
      }

      unmount();
    }
  });

  it('el aviso clinico aparece en el registro', () => {
    pintar(<Registro />, estado());

    expect(screen.getByText(/no diagnostica/i)).toBeInTheDocument();
  });
});

describe('el boton de Google', () => {
  it('no aparece mientras no haya credenciales configuradas', () => {
    // Sin VITE_PROVEEDOR_GOOGLE en si, el boton lleva a una pantalla de error
    // de Google. Quien lo pulse va a pensar que la aplicacion esta rota, asi
    // que es preferible no ofrecerlo.
    for (const pantalla of [<Acceso key="a" />, <Registro key="r" />]) {
      const { unmount } = pintar(pantalla, estado());

      expect(screen.queryByRole('button', { name: /Google/i })).not.toBeInTheDocument();

      unmount();
    }
  });
});
