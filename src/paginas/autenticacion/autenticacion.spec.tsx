import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Acceso } from './Acceso.tsx';
import { ContrasenaNueva } from './ContrasenaNueva.tsx';
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
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn(),
    ...parcial,
  };
}

/**
 * Escribe sin pausa entre tecla y tecla.
 *
 * Por defecto `userEvent` espera entre cada pulsacion, y una contrasena larga
 * costaba casi un segundo por campo. Con la suite entera en paralelo, algunas
 * pruebas pasaban del limite de 5 s y fallaban sin que nada estuviera roto
 * (SCRUM-103). Lo que se comprueba no depende de esa pausa.
 */
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
});

/**
 * Rellena un campo de una vez, como al pegar.
 *
 * Tecla a tecla, cada pulsacion vuelve a pintar el formulario, y eso es lo que
 * hacia lentas estas pruebas. Lo que se comprueba —que valida, que avisa, que
 * no envia— depende del valor final del campo, no de como se llego a el.
 */
async function escribir(campo: HTMLElement, valor: string): Promise<void> {
  await usuario.click(campo);
  await usuario.paste(valor);
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

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'UnaContrasena#2026');

    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(screen.getByText(/hace falta aceptar el aviso/i)).toBeInTheDocument();
  });

  it('avisa cuando las dos contrasenas no coinciden', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'OtraDistinta#2026');
    await usuario.click(screen.getByLabelText(/Acepto el tratamiento/));

    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
  });

  it('rechaza una contrasena demasiado corta antes de ir al servidor', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'corta');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'corta');
    await usuario.click(screen.getByLabelText(/Acepto el tratamiento/));

    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();

    // Se busca por `alert` y no por el texto: la lista de requisitos del
    // medidor tambien dice "Al menos 8 caracteres", y buscar el texto suelto
    // encontraria los dos sin distinguir cual es el error.
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos 8 caracteres/i);
  });

  it('dice que le falta a una contrasena larga que no cumple la regla', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    // Es larga, pero sin mayuscula, sin numero y sin simbolo.
    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'todoenminusculas');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'todoenminusculas');
    await usuario.click(screen.getByLabelText(/Acepto el tratamiento/));

    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('una mayúscula');
    expect(alerta).toHaveTextContent('un número');
    expect(alerta).toHaveTextContent('un símbolo');
    // Lo que si cumple no se vuelve a pedir.
    expect(alerta).not.toHaveTextContent(/minúscula/i);
    expect(alerta).not.toHaveTextContent(/al menos 8/i);
  });

  it('acepta un simbolo que no esta en @$!%*?&', async () => {
    // La regla pide un simbolo, no uno de seis. Cerrar el conjunto dejaria
    // fuera `#`, `_` o `.`, y empujaria a escribir una predecible.
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'Con_guion.Bajo7');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'Con_guion.Bajo7');
    await usuario.click(screen.getByLabelText(/Acepto el tratamiento/));

    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).toHaveBeenCalledTimes(1);
  });

  it('muestra el medidor mientras se escribe, y lo enlaza al campo', async () => {
    pintar(<Registro />, estado());

    const campo = screen.getByLabelText('Contraseña');
    // El boton de envio tiene su propio `status`, asi que se busca por texto.
    const fuerza = () => screen.getByText(/Escribe tu contraseña|Seguridad:/);

    expect(fuerza()).toHaveTextContent('Escribe tu contraseña');

    await escribir(campo, 'abc');
    expect(fuerza()).toHaveTextContent('Débil');

    await escribir(campo, 'UnaContrasena#2026');
    expect(fuerza()).toHaveTextContent('Fuerte');

    // El campo apunta al medidor: al entrar, el lector de pantalla lee lo que
    // se pide y cuanto se cumple.
    const ids = (campo.getAttribute('aria-describedby') ?? '').split(' ');
    const descripcion = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(descripcion).toContain('Una mayúscula: cumplido');
  });

  it('crea la cuenta con todo en orden, y con el consentimiento marcado', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Registro />, estado({ registrarse }));

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repite la contraseña'), 'UnaContrasena#2026');
    await usuario.click(screen.getByLabelText(/Acepto el tratamiento/));

    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).toHaveBeenCalledWith({
      correo: 'alguien@ejemplo.com',
      contrasena: 'UnaContrasena#2026',
      aceptaElAviso: true,
    });
  });
});

describe('ContrasenaNueva', () => {
  // Basta con que haya sesion: es lo que deja el enlace del correo.
  const conSesion = { user: { id: 'u1' } } as unknown as EstadoDeSesion['sesion'];

  it('no cambia una contrasena que no cumple la regla, y dice que le falta', async () => {
    const cambiarContrasena = vi.fn().mockResolvedValue({ ok: true });
    pintar(<ContrasenaNueva />, estado({ sesion: conSesion, cambiarContrasena }));

    await escribir(screen.getByLabelText('Contraseña nueva'), 'sinsimbolos');
    await escribir(screen.getByLabelText('Repítela'), 'sinsimbolos');
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    expect(cambiarContrasena).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'una mayúscula, un número y un símbolo',
    );
  });

  it('cambia una contrasena que cumple', async () => {
    const cambiarContrasena = vi.fn().mockResolvedValue({ ok: true });
    pintar(<ContrasenaNueva />, estado({ sesion: conSesion, cambiarContrasena }));

    await escribir(screen.getByLabelText('Contraseña nueva'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repítela'), 'UnaContrasena#2026');
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    expect(cambiarContrasena).toHaveBeenCalledWith('UnaContrasena#2026');
  });

  it('dice que cerro la sesion de los demas dispositivos (SCRUM-154)', async () => {
    const cambiarContrasena = vi
      .fn()
      .mockResolvedValue({ ok: true, mensaje: 'Cerramos tu sesión en los demás dispositivos.' });
    pintar(<ContrasenaNueva />, estado({ sesion: conSesion, cambiarContrasena }));

    await escribir(screen.getByLabelText('Contraseña nueva'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repítela'), 'UnaContrasena#2026');
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    // El medidor de la contrasena tambien es un `status`: se busca por el texto.
    expect(
      await screen.findByText('Cerramos tu sesión en los demás dispositivos.'),
    ).toBeInTheDocument();
  });

  it('si el cierre no se pudo, tambien lo dice, y la contrasena queda cambiada', async () => {
    const cambiarContrasena = vi.fn().mockResolvedValue({
      ok: true,
      mensaje: 'No pudimos cerrar tu sesión en los demás dispositivos.',
    });
    pintar(<ContrasenaNueva />, estado({ sesion: conSesion, cambiarContrasena }));

    await escribir(screen.getByLabelText('Contraseña nueva'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repítela'), 'UnaContrasena#2026');
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    expect(await screen.findByText(/No pudimos cerrar tu sesión/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sin nada que decir de las demas sesiones, no pinta ningun aviso', async () => {
    const cambiarContrasena = vi.fn().mockResolvedValue({ ok: true });
    pintar(<ContrasenaNueva />, estado({ sesion: conSesion, cambiarContrasena }));

    await escribir(screen.getByLabelText('Contraseña nueva'), 'UnaContrasena#2026');
    await escribir(screen.getByLabelText('Repítela'), 'UnaContrasena#2026');
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    expect(cambiarContrasena).toHaveBeenCalled();
    expect(screen.queryByText(/demás dispositivos/)).not.toBeInTheDocument();
  });
});

describe('Acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no mantiene la sesion en el equipo si no se toca la casilla', async () => {
    // Desmarcada por defecto (SCRUM-164, D9): en una sala de computo lo seguro
    // es lo que pasa si nadie toca nada.
    const entrar = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Acceso />, estado({ entrar }));

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'loQueSea123');

    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).toHaveBeenCalledWith({
      correo: 'alguien@ejemplo.com',
      contrasena: 'loQueSea123',
      recordar: false,
    });
  });

  it('mantiene la sesion en el equipo al marcar la casilla', async () => {
    // Es la opcion de quien entra desde su propio equipo. Si el valor no
    // viajara, nadie podria conservar su sesion.
    const entrar = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Acceso />, estado({ entrar }));

    await escribir(screen.getByLabelText('Correo'), 'alguien@ejemplo.com');
    await escribir(screen.getByLabelText('Contraseña'), 'loQueSea123');
    await usuario.click(screen.getByLabelText(/Mantener la sesión en este equipo/));

    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(entrar).toHaveBeenCalledWith(
      expect.objectContaining({ recordar: true }) as Record<string, unknown>,
    );
  });

  it('no pregunta por mantener la sesion al registrarse', () => {
    // Al crear la cuenta la pregunta no tiene sentido: acabas de hacerla y vas
    // a entrar igual. La unica casilla que queda ahi es la del consentimiento.
    pintar(<Registro />, estado());

    expect(screen.queryByLabelText(/Mantener la sesión en este equipo/)).toBeNull();
  });

  it('muestra el error sin decir si la cuenta existe', async () => {
    const entrar = vi
      .fn()
      .mockResolvedValue({ ok: false, mensaje: 'El correo o la contraseña no coinciden.' });

    pintar(<Acceso />, estado({ entrar }));

    await escribir(screen.getByLabelText('Correo'), 'noexiste@ejemplo.test');
    await escribir(screen.getByLabelText('Contraseña'), 'loQueSea123');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    const aviso = await screen.findByRole('alert');

    expect(aviso).toHaveTextContent('El correo o la contraseña no coinciden.');
    // Cualquiera de estas frases permitiria averiguar quien tiene cuenta
    // probando direcciones una a una.
    expect(aviso).not.toHaveTextContent(/no existe|no registrado|no encontrad/i);
  });
});

describe('Recuperar', () => {
  it('responde lo mismo exista la cuenta o no', async () => {
    const pedirRecuperacion = vi.fn().mockResolvedValue({ ok: true });
    pintar(<Recuperar />, estado({ pedirRecuperacion }));

    await escribir(screen.getByLabelText('Correo'), 'quiensabe@ejemplo.test');
    await usuario.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

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
