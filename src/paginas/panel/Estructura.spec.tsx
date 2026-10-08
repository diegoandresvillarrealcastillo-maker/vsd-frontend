import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { cicloActual, encolar } from '../../sincronizacion/ciclo.ts';
import type { EstadoDeOperacion } from '../../sincronizacion/cola.ts';

import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { BarraSuperior } from './Estructura.tsx';

/**
 * El boton redondo de la cuenta, en la barra de arriba de toda la aplicacion.
 * Aqui solo se prueba lo que se agrego con la foto de perfil (SCRUM-120).
 */
const { foto } = vi.hoisted(() => ({ foto: { url: null as string | null } }));

vi.mock('../../foto/fotoDePerfil.ts', () => ({ useFotoDePerfil: () => foto.url }));

const salir = vi.fn().mockResolvedValue(undefined);

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
    salir,
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

describe('cerrar sesion con cambios sin enviar (SCRUM-142)', () => {
  const usuario = userEvent.setup({ delay: null });
  let contador = 0;

  /** Un cambio guardado en este equipo, en el estado que se diga. */
  async function guardar(estado: EstadoDeOperacion) {
    contador += 1;

    const guardada = await encolar({
      operationId: `op-${String(contador)}`,
      tipo: 'pendiente.crear',
      entidad: `pendiente:${String(contador)}`,
      payload: { texto: 'Algo' },
    });

    await cicloActual()?.almacen.guardarOperacion({ ...guardada, estado });
  }

  async function pulsarCerrarSesion() {
    pintar();
    await usuario.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  }

  /** Lo que hace el motor al enviar: deja la primera operacion `hecha`. */
  function elMotorEnviaUna() {
    return vi.spyOn(cicloActual()!.motor, 'sincronizar').mockImplementation(async () => {
      const [una] = await cicloActual()!.almacen.operaciones();

      await cicloActual()!.almacen.guardarOperacion({ ...una!, estado: 'hecha' });

      return { estado: 'terminada' } as never;
    });
  }

  beforeEach(async () => {
    contador = 0;
    salir.mockClear();
    foto.url = null;
    // Con conexion, pero sin que el motor envie nada: se mira lo que queda.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await abrirUnAlmacenDePrueba();
  });

  afterEach(() => {
    cerrarElAlmacenDePrueba();
    vi.restoreAllMocks();
  });

  it('sin nada que enviar, sale de una vez, como siempre', async () => {
    await pulsarCerrarSesion();

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lo que ya se envio no cuenta: sale de una vez', async () => {
    await guardar('hecha');

    await pulsarCerrarSesion();

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
  });

  it('con algo sin enviar, pregunta y NO sale todavia', async () => {
    await guardar('pendiente');
    await guardar('requiere_atencion');

    await pulsarCerrarSesion();

    expect(await screen.findByRole('alertdialog', { name: '¿Salir ahora?' })).toHaveTextContent(
      'Tienes 2 cambios guardados en este equipo que no se han enviado. Si sales ahora, se perderán.',
    );
    expect(salir).not.toHaveBeenCalled();
  });

  it('esperar no sale, cierra la pregunta y devuelve el foco al boton de la cuenta', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    await usuario.click(screen.getByRole('button', { name: 'Esperar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(salir).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' })).toHaveFocus();
  });

  it('«Salir y perderlos» si sale', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    await usuario.click(screen.getByRole('button', { name: 'Salir y perderlos' }));

    expect(salir).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sin conexion no se ofrece enviar, y se puede esperar o salir', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await guardar('pendiente');

    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    expect(screen.queryByRole('button', { name: 'Enviarlos ahora' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esperar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir y perderlos' })).toBeInTheDocument();
  });

  it('«Enviarlos ahora» envia, y si no queda nada, sale', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    const enviar = elMotorEnviaUna();

    await usuario.click(screen.getByRole('button', { name: 'Enviarlos ahora' }));

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('«Enviarlos ahora» con algo que no salio: no sale, y dice cuantos quedan', async () => {
    await guardar('pendiente');
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    elMotorEnviaUna();

    await usuario.click(screen.getByRole('button', { name: 'Enviarlos ahora' }));

    expect(await screen.findByText(/Tienes 1 cambio guardado/)).toBeInTheDocument();
    expect(salir).not.toHaveBeenCalled();
    // Y se puede volver a intentar.
    expect(screen.getByRole('button', { name: 'Enviarlos ahora' })).toBeInTheDocument();
  });

  it('el menu se cierra al preguntar: no queda detras del dialogo', async () => {
    await guardar('pendiente');
    await pulsarCerrarSesion();
    await screen.findByRole('alertdialog');

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('sin almacen abierto, sale de una vez: no hay nada que perder', async () => {
    cerrarElAlmacenDePrueba();

    await pulsarCerrarSesion();

    await waitFor(() => {
      expect(salir).toHaveBeenCalledTimes(1);
    });
  });
});
