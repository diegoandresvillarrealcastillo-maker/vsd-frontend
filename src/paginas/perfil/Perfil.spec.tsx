import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLaFoto } from '../../foto/fotoDePerfil.ts';
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
  guardarLaFoto,
  quitarLaFoto,
  prepararLaFoto,
} = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  cambiarPreferencias: vi.fn(),
  exportarMisDatos: vi.fn(),
  borrarMiCuenta: vi.fn(),
  guardarLaFoto: vi.fn(),
  quitarLaFoto: vi.fn(),
  prepararLaFoto: vi.fn(),
}));

// La foto (SCRUM-120): el recorte y la API se simulan, y el resto es de verdad.
vi.mock('../../infraestructura/api/foto.ts', () => ({
  guardarLaFoto,
  quitarLaFoto,
  pedirLaFoto: vi.fn(),
}));
vi.mock('../../foto/prepararLaFoto.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('../../foto/prepararLaFoto.ts')>()),
  prepararLaFoto,
}));

// Los avisos (SCRUM-102) se prueban en `TusAvisos.spec.tsx`.
vi.mock('../../infraestructura/api/notificaciones.ts', () => ({
  consultarLasNotificaciones: () =>
    Promise.resolve({ disponible: false, clavePublica: null, horaSemaforo: null, horaRacha: null }),
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
  zonaHoraria: 'America/Bogota',
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
  olvidarLaFoto();
  vi.restoreAllMocks();
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
    it('ofrece los cinco personajes, sin Trama; sin mascota guardada, Fungito', async () => {
      pintar();

      const seccion = await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(seccion).getAllByRole('radio')).toHaveLength(5);
      expect(within(seccion).queryByRole('radio', { name: /Trama/ })).not.toBeInTheDocument();
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

      await usuario.click(within(seccion).getByRole('radio', { name: /Obsidian/ }));

      expect(within(seccion).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Papelito',
      );
    });

    it('una cuenta que todavia tenia a Trama (SCRUM-121) abre el perfil con Fungito y su nombre', async () => {
      darDeAltaLaCuenta.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'trama', nombre: 'Hilo' },
      });

      pintar();

      const seccion = await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(seccion).getByRole('radio', { name: /Fungito/ })).toBeChecked();
      expect(within(seccion).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue('Hilo');
      expect(screen.getByRole('button', { name: 'Hilo, tu mascota' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
      // Con el formulario abierto hay otro `status`: el del medidor.
      expect(screen.getByText(/Te enviamos un código/)).toHaveTextContent(CUENTA.correo);

      await usuario.type(screen.getByLabelText('Código del correo'), '123456');
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'UnaClave#Nueva9');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'UnaClave#Nueva9');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(valor.cambiarContrasenaConCodigo).toHaveBeenCalledWith('UnaClave#Nueva9', '123456');
      expect(screen.getByRole('status')).toHaveTextContent('quedó cambiada');
    });

    it('sin el codigo no la cambia', async () => {
      const valor = pintar();

      await usuario.click(await screen.findByRole('button', { name: 'Enviarme un código' }));
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'UnaClave#Nueva9');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'UnaClave#Nueva9');
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
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'UnaClave#Nueva9');
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
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'UnaClave#Nueva9');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'UnaClave#Nueva9');
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

describe('la foto de perfil en el perfil (SCRUM-120)', () => {
  const MARCA = '2026-10-09T15:30:00.000Z';
  const LISTA = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const ELEGIDA = new File([new Uint8Array(2000)], 'verano.png', { type: 'image/png' });

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto-de-prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    prepararLaFoto.mockResolvedValue(LISTA);
  });

  it('tiene su apartado, entre el nombre y los modulos', async () => {
    pintar();

    const nombre = await screen.findByRole('region', { name: 'Cómo te llamamos' });
    const foto = screen.getByRole('region', { name: 'Tu foto' });
    const modulos = screen.getByRole('region', { name: 'Tus módulos' });

    expect(nombre.compareDocumentPosition(foto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(foto.compareDocumentPosition(modulos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('al elegir una foto se guarda lo que salio de prepararla, y el perfil pinta la cuenta que volvio', async () => {
    // La cuenta que vuelve trae otra mascota: es lo que prueba que el perfil la pinto.
    guardarLaFoto.mockResolvedValue({
      ...CUENTA,
      mascota: { forma: 'ori', nombre: 'Papelito' },
      foto: { actualizadaEl: MARCA },
    });

    pintar();

    const seccion = await screen.findByRole('region', { name: 'Tu foto' });

    expect(within(seccion).queryByRole('img')).not.toBeInTheDocument();

    await usuario.upload(within(seccion).getByLabelText('Elegir una foto'), ELEGIDA);

    expect(prepararLaFoto).toHaveBeenCalledWith(ELEGIDA);
    expect(guardarLaFoto).toHaveBeenCalledWith(LISTA);
    expect(await within(seccion).findByRole('status')).toHaveTextContent('Listo, esta es tu foto.');
    expect(within(seccion).getByRole('img', { name: 'Tu foto de perfil' })).toHaveAttribute(
      'src',
      'blob:foto-de-prueba',
    );
    expect(await screen.findByRole('button', { name: 'Papelito, tu mascota' })).toBeInTheDocument();
  });

  it('la foto no pasa por las preferencias: es su propia ruta', async () => {
    guardarLaFoto.mockResolvedValue({ ...CUENTA, foto: { actualizadaEl: MARCA } });

    pintar();

    const seccion = await screen.findByRole('region', { name: 'Tu foto' });

    await usuario.upload(within(seccion).getByLabelText('Elegir una foto'), ELEGIDA);
    await within(seccion).findByRole('status');

    expect(cambiarPreferencias).not.toHaveBeenCalled();
  });

  it('quitarla deja el apartado sin foto y el perfil pinta la cuenta que volvio', async () => {
    guardarLaFoto.mockResolvedValue({ ...CUENTA, foto: { actualizadaEl: MARCA } });
    quitarLaFoto.mockResolvedValue({
      ...CUENTA,
      mascota: { forma: 'sparky', nombre: 'Chispa' },
      foto: null,
    });

    pintar();

    const seccion = await screen.findByRole('region', { name: 'Tu foto' });

    await usuario.upload(within(seccion).getByLabelText('Elegir una foto'), ELEGIDA);
    await usuario.click(await within(seccion).findByRole('button', { name: 'Quitar la foto' }));

    expect(quitarLaFoto).toHaveBeenCalledOnce();
    expect(await within(seccion).findByRole('status')).toHaveTextContent('Quitaste tu foto.');
    expect(within(seccion).queryByRole('img')).not.toBeInTheDocument();
    expect(within(seccion).getByLabelText('Elegir una foto')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Chispa, tu mascota' })).toBeInTheDocument();
  });

  it('si la API rechaza la foto, el perfil sigue como estaba y lo dice', async () => {
    guardarLaFoto.mockRejectedValue(new ErrorDeLaApi(413, 'x', undefined, 'FOTO_DEMASIADO_PESADA'));

    pintar();

    const seccion = await screen.findByRole('region', { name: 'Tu foto' });

    await usuario.upload(within(seccion).getByLabelText('Elegir una foto'), ELEGIDA);

    expect(await within(seccion).findByRole('alert')).toHaveTextContent('menos de 50 KB');
    expect(within(seccion).queryByRole('img')).not.toBeInTheDocument();
  });
});
