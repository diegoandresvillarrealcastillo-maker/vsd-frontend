import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { Perfil } from './Perfil.tsx';

/**
 * El perfil, con la API y la sesion simuladas y la pantalla de verdad.
 */
const {
  consultarLaVersionDelAviso,
  darDeAltaLaCuenta,
  cambiarPreferencias,
  exportarMisDatos,
  borrarMiCuenta,
} = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  cambiarPreferencias: vi.fn(),
  exportarMisDatos: vi.fn(),
  borrarMiCuenta: vi.fn(),
}));

// El semaforo flota en esta pantalla (SCRUM-98); aqui no se prueba.
vi.mock('../../infraestructura/api/pendientes.ts', () => ({
  consultarElSemaforo: () => Promise.resolve({ pendientes: [], recordatorio: null }),
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLaVersionDelAviso }));
vi.mock('../../infraestructura/api/cuenta.ts', () => ({
  darDeAltaLaCuenta,
  cambiarPreferencias,
  exportarMisDatos,
  borrarMiCuenta,
  FRASE_PARA_BORRAR: 'BORRAR MI CUENTA',
}));

const CUENTA: Cuenta = {
  id: '11111111-1111-4111-8111-111111111111',
  correo: 'marina@ejemplo.test',
  rol: 'usuario',
  nombre: 'Marina',
  consentimiento: { versionPolitica: '2026-09-1', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['cognicion', 'bienestar'],
  mascota: null,
  diarioConRecomendaciones: false,
};

const usuario = userEvent.setup({ delay: null });

function sesion(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
  const bien = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: { user: { email: CUENTA.correo } } as Session,
    cargando: false,
    correo: CUENTA.correo,
    registrarse: bien,
    entrar: bien,
    entrarConGoogle: bien,
    pedirRecuperacion: bien,
    cambiarContrasena: bien,
    pedirCodigoDeVerificacion: vi.fn().mockResolvedValue({ ok: true }),
    cambiarContrasenaConCodigo: vi.fn().mockResolvedValue({ ok: true }),
    salir: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  };
}

function pintar(valor: EstadoDeSesion = sesion()) {
  render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[RUTAS.PERFIL]}>
        <Routes>
          <Route path={RUTAS.PERFIL} element={<Perfil />} />
          <Route path={RUTAS.INICIO} element={<p>Portada</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );

  return valor;
}

function apartado(titulo: string) {
  return screen.getByRole('region', { name: titulo });
}

beforeEach(() => {
  consultarLaVersionDelAviso.mockResolvedValue('version-de-la-api');
  darDeAltaLaCuenta.mockResolvedValue(CUENTA);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Perfil', () => {
  it('carga la cuenta con el alta, como el panel', async () => {
    pintar();

    expect(await screen.findByRole('heading', { name: 'Tu perfil' })).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Cómo te llamamos' });

    expect(darDeAltaLaCuenta).toHaveBeenCalledWith('version-de-la-api', expect.anything());
  });

  describe('el nombre', () => {
    it('muestra el actual y guarda el nuevo', async () => {
      cambiarPreferencias.mockResolvedValue({ ...CUENTA, nombre: 'Mari' });

      pintar();

      const campo = await screen.findByRole('textbox', { name: 'Nombre' });

      expect(campo).toHaveValue('Marina');

      await usuario.clear(campo);
      await usuario.type(campo, 'Mari');
      await usuario.click(screen.getByRole('button', { name: 'Guardar nombre' }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({ nombre: 'Mari' });
      expect(within(apartado('Cómo te llamamos')).getByRole('status')).toHaveTextContent('Listo');
    });

    it('vacio no se guarda', async () => {
      pintar();

      await usuario.clear(await screen.findByRole('textbox', { name: 'Nombre' }));
      await usuario.click(screen.getByRole('button', { name: 'Guardar nombre' }));

      expect(cambiarPreferencias).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Escribe cómo quieres');
    });
  });

  describe('los modulos', () => {
    it('muestra cuales estan activos y guarda el cambio', async () => {
      cambiarPreferencias.mockResolvedValue({ ...CUENTA, modulosActivos: ['cognicion'] });

      pintar();

      const bienestar = await screen.findByRole('switch', { name: /Bienestar/ });

      expect(bienestar).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('switch', { name: /Emociones/ })).toHaveAttribute(
        'aria-checked',
        'false',
      );

      await usuario.click(bienestar);
      await usuario.click(screen.getByRole('button', { name: 'Guardar módulos' }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({ modulosActivos: ['cognicion'] });
    });

    it('sin cambios no hay nada que guardar', async () => {
      pintar();

      expect(await screen.findByRole('button', { name: 'Guardar módulos' })).toBeDisabled();
    });

    it('no deja quedarse sin modulos', async () => {
      pintar();

      await usuario.click(await screen.findByRole('switch', { name: /Bienestar/ }));
      await usuario.click(screen.getByRole('switch', { name: /Cognición/ }));
      await usuario.click(screen.getByRole('button', { name: 'Guardar módulos' }));

      expect(cambiarPreferencias).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('al menos un módulo');
    });
  });

  describe('la mascota (SCRUM-99)', () => {
    it('ofrece los seis personajes; sin mascota guardada, Fungito', async () => {
      pintar();

      const seccion = await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(seccion).getAllByRole('radio')).toHaveLength(6);
      expect(within(seccion).getByRole('radio', { name: /Fungito/ })).toBeChecked();
      expect(within(seccion).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Fungito',
      );
      // Sin mascota guardada todavia, guardar la de siempre tambien cuenta.
      expect(within(seccion).getByRole('button', { name: 'Guardar mascota' })).toBeEnabled();
    });

    it('al elegir otro personaje, el nombre cambia con el y se guarda', async () => {
      cambiarPreferencias.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'sparky', nombre: 'Sparky' },
      });

      pintar();

      const seccion = await screen.findByRole('region', { name: 'Tu mascota' });

      await usuario.click(within(seccion).getByRole('radio', { name: /Sparky/ }));

      expect(within(seccion).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue('Sparky');

      await usuario.click(within(seccion).getByRole('button', { name: 'Guardar mascota' }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({
        mascota: { forma: 'sparky', nombre: 'Sparky' },
      });
      expect(within(seccion).getByRole('status')).toHaveTextContent('Sparky te acompaña');
      // La que flota cambia sin recargar.
      expect(screen.getByRole('button', { name: 'Sparky, tu mascota' })).toBeInTheDocument();
    });

    it('un nombre propio se respeta al cambiar de personaje', async () => {
      darDeAltaLaCuenta.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'ori', nombre: 'Papelito' },
      });

      pintar();

      const seccion = await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(seccion).getByRole('radio', { name: /Ori/ })).toBeChecked();
      // Ya guardada y sin cambios: no hay nada que guardar.
      expect(within(seccion).getByRole('button', { name: 'Guardar mascota' })).toBeDisabled();

      await usuario.click(within(seccion).getByRole('radio', { name: /Trama/ }));

      expect(within(seccion).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Papelito',
      );
    });

    it('sin nombre no se guarda, y un nombre invalido se explica', async () => {
      cambiarPreferencias.mockRejectedValue(
        new ErrorDeLaApi(400, 'da igual', undefined, 'MASCOTA_INVALIDA'),
      );

      pintar();

      const seccion = await screen.findByRole('region', { name: 'Tu mascota' });
      const campo = within(seccion).getByRole('textbox', { name: 'Cómo se llama' });
      const guardarMascota = within(seccion).getByRole('button', { name: 'Guardar mascota' });

      await usuario.clear(campo);
      await usuario.click(guardarMascota);

      expect(cambiarPreferencias).not.toHaveBeenCalled();
      expect(within(seccion).getByRole('alert')).toHaveTextContent('Ponle un nombre');

      await usuario.type(campo, 'Luz');
      await usuario.click(guardarMascota);

      expect(within(seccion).getByRole('alert')).toHaveTextContent('entre 1 y 30 caracteres');
    });
  });

  it('el correo se muestra y no hay forma de editarlo', async () => {
    pintar();

    const correo = await screen.findByRole('region', { name: 'Tu correo' });

    expect(correo).toHaveTextContent(CUENTA.correo);
    expect(within(correo).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(correo).queryByRole('button')).not.toBeInTheDocument();
  });

  describe('el permiso del diario (SCRUM-108)', () => {
    async function interruptor() {
      const seccion = await screen.findByRole('region', { name: 'Tu diario' });

      return {
        seccion,
        boton: within(seccion).getByRole('switch', { name: 'Recomendaciones según mi diario' }),
      };
    }

    it('esta apagado y explica que se puede apagar cuando se quiera', async () => {
      pintar();

      const { boton } = await interruptor();

      expect(boton).toHaveAttribute('aria-checked', 'false');
      expect(boton).toHaveAccessibleDescription(/Puedes apagarlo cuando quieras/);
    });

    it('se enciende al pulsarlo, sin boton de guardar', async () => {
      cambiarPreferencias.mockResolvedValue({ ...CUENTA, diarioConRecomendaciones: true });

      pintar();

      const { seccion, boton } = await interruptor();

      await usuario.click(boton);

      expect(cambiarPreferencias).toHaveBeenCalledWith({ diarioConRecomendaciones: true });
      expect(boton).toHaveAttribute('aria-checked', 'true');
      expect(within(seccion).getByRole('status')).toHaveTextContent('a dónde acudir');
    });

    it('se apaga igual', async () => {
      darDeAltaLaCuenta.mockResolvedValue({ ...CUENTA, diarioConRecomendaciones: true });
      cambiarPreferencias.mockResolvedValue({ ...CUENTA, diarioConRecomendaciones: false });

      pintar();

      const { seccion, boton } = await interruptor();

      expect(boton).toHaveAttribute('aria-checked', 'true');

      await usuario.click(boton);

      expect(cambiarPreferencias).toHaveBeenCalledWith({ diarioConRecomendaciones: false });
      expect(boton).toHaveAttribute('aria-checked', 'false');
      expect(within(seccion).getByRole('status')).toHaveTextContent('ya no se revisa');
    });

    it('si no se pudo guardar, sigue como estaba y lo dice', async () => {
      cambiarPreferencias.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      const { seccion, boton } = await interruptor();

      await usuario.click(boton);

      expect(boton).toHaveAttribute('aria-checked', 'false');
      expect(within(seccion).getByRole('alert')).toHaveTextContent('No se pudo guardar');
    });
  });

  describe('la contrasena', () => {
    it('primero pide el codigo al correo y despues la cambia con el', async () => {
      const valor = pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Enviarme un código' }));

      expect(valor.pedirCodigoDeVerificacion).toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(CUENTA.correo);

      await usuario.type(screen.getByLabelText('Código del correo'), '123456');
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'unaClaveNueva');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'unaClaveNueva');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(valor.cambiarContrasenaConCodigo).toHaveBeenCalledWith('unaClaveNueva', '123456');
      expect(screen.getByRole('status')).toHaveTextContent('quedó cambiada');
    });

    it('sin el codigo no la cambia', async () => {
      const valor = pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Enviarme un código' }));
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'unaClaveNueva');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'unaClaveNueva');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(valor.cambiarContrasenaConCodigo).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Escribe el código');
    });

    it('si no coinciden o es corta, lo dice antes de ir a Supabase', async () => {
      const valor = pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Enviarme un código' }));
      await usuario.type(screen.getByLabelText('Código del correo'), '123456');
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'corta');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'corta');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(screen.getByRole('alert')).toHaveTextContent('al menos 8');

      await usuario.clear(screen.getByLabelText('Contraseña nueva'));
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'unaClaveNueva');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
      expect(valor.cambiarContrasenaConCodigo).not.toHaveBeenCalled();
    });

    it('si Supabase rechaza el codigo, lo explica', async () => {
      const valor = pintar(
        sesion({
          cambiarContrasenaConCodigo: vi.fn().mockResolvedValue({
            ok: false,
            mensaje: 'El código no es válido o ya venció. Pide uno nuevo.',
          }),
        }),
      );

      await usuario.click(await screen.findByRole('button', { name: 'Enviarme un código' }));
      await usuario.type(screen.getByLabelText('Código del correo'), '000000');
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'unaClaveNueva');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'unaClaveNueva');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(valor.cambiarContrasenaConCodigo).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('no es válido');
    });
  });

  it('descarga los datos propios como archivo', async () => {
    exportarMisDatos.mockResolvedValue({ cuenta: { correo: CUENTA.correo } });
    const crear = vi.fn().mockReturnValue('blob:prueba');
    const revocar = vi.fn();

    vi.stubGlobal('URL', { ...URL, createObjectURL: crear, revokeObjectURL: revocar });

    pintar();

    await usuario.click(await screen.findByRole('button', { name: 'Descargar mis datos' }));

    expect(exportarMisDatos).toHaveBeenCalled();
    expect(crear).toHaveBeenCalledWith(expect.any(Blob));
    expect(await screen.findByText('Tus datos se descargaron.')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  describe('borrar la cuenta', () => {
    it('el boton no se habilita hasta escribir la frase exacta', async () => {
      pintar();

      const boton = await screen.findByRole('button', { name: /Borrar mi cuenta/ });

      expect(boton).toBeDisabled();

      await usuario.type(screen.getByLabelText(/Para confirmar/), 'borrar mi cuenta');

      expect(boton).toBeDisabled();
    });

    it('con la frase exacta la borra, cierra la sesion y lleva a la portada', async () => {
      borrarMiCuenta.mockResolvedValue(undefined);
      const valor = pintar();

      await usuario.type(await screen.findByLabelText(/Para confirmar/), 'BORRAR MI CUENTA');
      await usuario.click(screen.getByRole('button', { name: /Borrar mi cuenta/ }));

      expect(borrarMiCuenta).toHaveBeenCalledWith('BORRAR MI CUENTA');
      expect(valor.salir).toHaveBeenCalled();
      expect(await screen.findByText('Portada')).toBeInTheDocument();
    });

    it('si el proveedor falla, dice que no se borro nada y no cierra la sesion', async () => {
      borrarMiCuenta.mockRejectedValue(
        new ErrorDeLaApi(503, 'x', undefined, 'BORRADO_NO_COMPLETADO'),
      );
      const valor = pintar();

      await usuario.type(await screen.findByLabelText(/Para confirmar/), 'BORRAR MI CUENTA');
      await usuario.click(screen.getByRole('button', { name: /Borrar mi cuenta/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('no se borró nada');
      expect(valor.salir).not.toHaveBeenCalled();
    });
  });

  it('si la carga falla, lo explica y deja reintentar', async () => {
    darDeAltaLaCuenta.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    pintar();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('region', { name: 'Tu correo' })).toBeInTheDocument();
  });
});
