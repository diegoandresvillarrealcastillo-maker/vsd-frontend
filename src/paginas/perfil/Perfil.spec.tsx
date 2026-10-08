import type { Session } from '@supabase/supabase-js';
import { act, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarLaFoto } from '../../foto/fotoDePerfil.ts';
import { olvidarLaMascotaPropia, sincronizarLaMascotaPropia } from '../../foto/mascotaPropia.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import {
  cicloActual,
  encolar,
  olvidarLosDatosDeLaSesionActual,
} from '../../sincronizacion/ciclo.ts';
import { CLAVE_DEL_PANEL, guardarElPanel } from '../../sincronizacion/panelLocal.ts';
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
  guardarLaMascotaPropia,
  quitarLaMascotaPropia,
  pedirLaMascotaPropia,
} = vi.hoisted(() => ({
  consultarLaVersionDelAviso: vi.fn(),
  darDeAltaLaCuenta: vi.fn(),
  cambiarPreferencias: vi.fn(),
  exportarMisDatos: vi.fn(),
  borrarMiCuenta: vi.fn(),
  guardarLaFoto: vi.fn(),
  quitarLaFoto: vi.fn(),
  prepararLaFoto: vi.fn(),
  guardarLaMascotaPropia: vi.fn(),
  quitarLaMascotaPropia: vi.fn(),
  pedirLaMascotaPropia: vi.fn(),
}));

// La mascota propia (SCRUM-122): solo la API se simula, y el resto es de verdad.
vi.mock('../../infraestructura/api/mascotaPropia.ts', () => ({
  guardarLaMascotaPropia,
  quitarLaMascotaPropia,
  pedirLaMascotaPropia,
  TIPO_DEL_SVG: 'image/svg+xml',
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

// El almacen es de verdad; solo se espia que se olvide al borrar la cuenta (SCRUM-142).
vi.mock('../../sincronizacion/ciclo.ts', async (importar) => ({
  ...(await importar<typeof import('../../sincronizacion/ciclo.ts')>()),
  olvidarLosDatosDeLaSesionActual: vi.fn().mockResolvedValue(undefined),
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
  olvidarLaMascotaPropia();
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

    it('al cambiarla dice que cerro la sesion de los demas dispositivos (SCRUM-154)', async () => {
      pintar(
        sesion({
          cambiarContrasenaConCodigo: vi.fn().mockResolvedValue({
            ok: true,
            mensaje: 'Cerramos tu sesión en los demás dispositivos.',
          }),
        }),
      );

      await usuario.click(await screen.findByRole('button', { name: 'Enviarme un código' }));
      await usuario.type(screen.getByLabelText('Código del correo'), '123456');
      await usuario.type(screen.getByLabelText('Contraseña nueva'), 'UnaClave#Nueva9');
      await usuario.type(screen.getByLabelText('Repite la contraseña nueva'), 'UnaClave#Nueva9');
      await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(screen.getByRole('status')).toHaveTextContent(
        'Tu contraseña quedó cambiada. Cerramos tu sesión en los demás dispositivos.',
      );
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

  describe('la descarga incluye lo que este equipo no ha enviado (SCRUM-142)', () => {
    /** Descarga los datos y devuelve lo que se escribio en el archivo. */
    async function descargarYLeer(): Promise<Record<string, unknown>> {
      let archivo: Blob | null = null;

      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: (blob: Blob) => {
          archivo = blob;

          return 'blob:prueba';
        },
        revokeObjectURL: vi.fn(),
      });

      await usuario.click(await screen.findByRole('button', { name: 'Descargar mis datos' }));
      await screen.findByText('Tus datos se descargaron.');

      const blob = archivo as Blob | null;

      if (blob === null) {
        throw new Error('No se descargo nada');
      }

      const texto = await new Promise<string>((resolver, rechazar) => {
        const lector = new FileReader();

        lector.onload = () => {
          resolver(typeof lector.result === 'string' ? lector.result : '');
        };
        lector.onerror = () => {
          rechazar(new Error('No se pudo leer el archivo'));
        };
        lector.readAsText(blob);
      });

      return JSON.parse(texto) as Record<string, unknown>;
    }

    beforeEach(async () => {
      exportarMisDatos.mockResolvedValue({ cuenta: { correo: CUENTA.correo }, diario: [] });
      await abrirUnAlmacenDePrueba();
    });

    afterEach(() => {
      cerrarElAlmacenDePrueba();
      vi.unstubAllGlobals();
    });

    it('lo que el servidor no tiene va aparte, con lo que se escribio', async () => {
      const guardada = await encolar({
        operationId: 'op-sin-enviar',
        tipo: 'pendiente.crear',
        entidad: 'pendiente:1',
        payload: { texto: 'Llamar a la EPS' },
      });

      await cicloActual()?.almacen.guardarOperacion({ ...guardada, estado: 'requiere_atencion' });
      pintar();

      const archivo = await descargarYLeer();

      expect(archivo).toMatchObject({
        cuenta: { correo: CUENTA.correo },
        diario: [],
        sinEnviarDesdeEsteEquipo: [
          {
            operationId: 'op-sin-enviar',
            tipo: 'pendiente.crear',
            estado: 'requiere_atencion',
            contenido: { texto: 'Llamar a la EPS' },
          },
        ],
      });
    });

    it('lo que ya se envio no va: el servidor ya lo tiene', async () => {
      const guardada = await encolar({
        operationId: 'op-enviada',
        tipo: 'pendiente.crear',
        entidad: 'pendiente:1',
        payload: { texto: 'Ya esta' },
      });

      await cicloActual()?.almacen.guardarOperacion({ ...guardada, estado: 'hecha' });
      pintar();

      expect(await descargarYLeer()).toEqual({ cuenta: { correo: CUENTA.correo }, diario: [] });
    });

    it('sin nada sin enviar, es el archivo de siempre', async () => {
      pintar();

      expect(await descargarYLeer()).toEqual({ cuenta: { correo: CUENTA.correo }, diario: [] });
    });
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

    it('olvida tambien todo lo que este equipo guardaba de ella, antes de cerrar la sesion (SCRUM-142)', async () => {
      borrarMiCuenta.mockResolvedValue(undefined);
      const valor = pintar();

      await usuario.type(await screen.findByLabelText(/Para confirmar/), 'BORRAR MI CUENTA');
      await usuario.click(screen.getByRole('button', { name: /Borrar mi cuenta/ }));

      await screen.findByText('Portada');

      expect(olvidarLosDatosDeLaSesionActual).toHaveBeenCalledTimes(1);
      expect(borrarMiCuenta.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(olvidarLosDatosDeLaSesionActual).mock.invocationCallOrder[0] ?? 0,
      );
      expect(vi.mocked(olvidarLosDatosDeLaSesionActual).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(valor.salir).mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('si la cuenta no se borro, no se olvida nada: lo guardado todavia tiene a quien enviarse', async () => {
      borrarMiCuenta.mockRejectedValue(new TypeError('Failed to fetch'));
      pintar();

      await usuario.type(await screen.findByLabelText(/Para confirmar/), 'BORRAR MI CUENTA');
      await usuario.click(screen.getByRole('button', { name: /Borrar mi cuenta/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu conexión');
      expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
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

describe('la mascota propia en el perfil (SCRUM-122)', () => {
  const MARCA = '2026-10-12T15:30:00.000Z';
  const OTRA_MARCA = '2026-10-13T09:00:00.000Z';
  const DIBUJO = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'luma.svg', {
    type: 'image/svg+xml',
  });
  /** Tiene su dibujo y es la que la acompana, con un nombre que le puso. */
  const ELEGIDA_LA_PROPIA: Cuenta = {
    ...CUENTA,
    mascota: { forma: 'propia', nombre: 'Luma' },
    mascotaPropia: { actualizadaEl: MARCA },
  };

  const mascotas = () => screen.getByRole('region', { name: 'Tu mascota' });
  const propia = () => screen.getByRole('region', { name: 'Tu propia mascota' });

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mascota-de-prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    pedirLaMascotaPropia.mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
  });

  it('tiene su apartado, justo despues de «Tu mascota»', async () => {
    pintar();

    const tuMascota = await screen.findByRole('region', { name: 'Tu mascota' });
    const tuPropia = propia();
    const diario = screen.getByRole('region', { name: 'Tu diario' });

    expect(
      tuMascota.compareDocumentPosition(tuPropia) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      tuPropia.compareDocumentPosition(diario) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe('sin mascota propia', () => {
    it('no hay nada nuevo que elegir: siguen siendo los cinco personajes', async () => {
      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(5);
      expect(
        within(mascotas()).queryByRole('radio', { name: /Mi mascota/ }),
      ).not.toBeInTheDocument();
      expect(mascotas().querySelector('fieldset.perfil__personajes')).not.toHaveClass(
        'perfil__personajes--con-propia',
      );
      expect(within(propia()).getByLabelText('Subir mi dibujo')).toBeInTheDocument();
    });

    it('una forma «propia» guardada sin dibujo se ve como Fungito, con su nombre, y sin error', async () => {
      darDeAltaLaCuenta.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'propia', nombre: 'Luma' },
        mascotaPropia: null,
      });

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(5);
      expect(within(mascotas()).getByRole('radio', { name: /Fungito/ })).toBeChecked();
      expect(within(mascotas()).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Luma',
      );
      expect(screen.getByRole('button', { name: 'Luma, tu mascota' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('con mascota propia', () => {
    beforeEach(() => {
      darDeAltaLaCuenta.mockResolvedValue(ELEGIDA_LA_PROPIA);
    });

    it('«Mi mascota» es la sexta opcion y es la elegida, con su nombre', async () => {
      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(6);
      expect(within(mascotas()).getByRole('radio', { name: /Mi mascota/ })).toBeChecked();
      // Donde un personaje dice su rasgo, ella dice que es su dibujo.
      expect(
        within(mascotas()).getByRole('radio', { name: /Mi mascota.*Tu dibujo/ }),
      ).toBeChecked();
      expect(within(mascotas()).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Luma',
      );
      expect(mascotas().querySelector('fieldset.perfil__personajes')).toHaveClass(
        'perfil__personajes--con-propia',
      );
      expect(mascotas()).toHaveTextContent('Es el dibujo que subiste');
      // Ya guardada y sin cambios: no hay nada que guardar.
      expect(within(mascotas()).getByRole('button', { name: 'Guardar mascota' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Luma, tu mascota' })).toBeInTheDocument();
    });

    it('en la opcion se ve su dibujo, el que devuelve el servidor', async () => {
      sincronizarLaMascotaPropia(ELEGIDA_LA_PROPIA);
      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });

      const opcion = within(mascotas())
        .getByRole('radio', { name: /Mi mascota/ })
        .closest('label');

      await waitFor(() => {
        expect(opcion?.querySelector('img')).toHaveAttribute('src', 'blob:mascota-de-prueba');
      });
      expect(pedirLaMascotaPropia).toHaveBeenCalledOnce();
    });

    it('mientras no llega su dibujo, la opcion queda con un cuadro vacio, sin imagen rota', async () => {
      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });

      const opcion = within(mascotas())
        .getByRole('radio', { name: /Mi mascota/ })
        .closest('label');

      expect(opcion?.querySelector('img')).toBeNull();
      expect(opcion?.querySelector('.perfil__personaje-dibujo--vacio')).not.toBeNull();
    });

    it('se puede volver a un personaje: el nombre que le puso se respeta y se guarda', async () => {
      cambiarPreferencias.mockResolvedValue({
        ...ELEGIDA_LA_PROPIA,
        mascota: { forma: 'obsidian', nombre: 'Luma' },
      });

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.click(within(mascotas()).getByRole('radio', { name: /Obsidian/ }));

      expect(within(mascotas()).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Luma',
      );

      await usuario.click(within(mascotas()).getByRole('button', { name: 'Guardar mascota' }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({
        mascota: { forma: 'obsidian', nombre: 'Luma' },
      });
    });

    it('guardar la eleccion no pierde su aviso: la mascota propia no cambio', async () => {
      cambiarPreferencias.mockResolvedValue({
        ...ELEGIDA_LA_PROPIA,
        mascota: { forma: 'sparky', nombre: 'Luma' },
      });

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.click(within(mascotas()).getByRole('radio', { name: /Sparky/ }));
      await usuario.click(within(mascotas()).getByRole('button', { name: 'Guardar mascota' }));

      expect(await within(mascotas()).findByRole('status')).toHaveTextContent('Luma te acompaña');
      expect(within(mascotas()).getByRole('radio', { name: /Sparky/ })).toBeChecked();
      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(6);
    });

    it('elegirla otra vez la guarda con su forma, y su nombre de fabrica si no tenia uno propio', async () => {
      darDeAltaLaCuenta.mockResolvedValue({
        ...ELEGIDA_LA_PROPIA,
        mascota: { forma: 'sparky', nombre: 'Sparky' },
      });
      cambiarPreferencias.mockResolvedValue(ELEGIDA_LA_PROPIA);

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.click(within(mascotas()).getByRole('radio', { name: /Mi mascota/ }));

      expect(within(mascotas()).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Mi mascota',
      );

      await usuario.click(within(mascotas()).getByRole('button', { name: 'Guardar mascota' }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({
        mascota: { forma: 'propia', nombre: 'Mi mascota' },
      });
    });

    it('cambiar el dibujo no cambia cual esta elegida ni su nombre', async () => {
      guardarLaMascotaPropia.mockResolvedValue({
        ...ELEGIDA_LA_PROPIA,
        mascotaPropia: { actualizadaEl: OTRA_MARCA },
      });

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.upload(within(propia()).getByLabelText('Cambiar mi dibujo'), DIBUJO);

      expect(await within(propia()).findByRole('status')).toHaveTextContent(
        'Listo, esta es tu mascota.',
      );
      expect(cambiarPreferencias).not.toHaveBeenCalled();
      expect(within(mascotas()).getByRole('radio', { name: /Mi mascota/ })).toBeChecked();
      expect(within(mascotas()).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Luma',
      );
    });

    it('quitarla deja los cinco personajes, vuelve a Fungito con su nombre y lo dice', async () => {
      quitarLaMascotaPropia.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'fungito', nombre: 'Luma' },
        mascotaPropia: null,
      });

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.click(within(propia()).getByRole('button', { name: 'Quitar mi mascota' }));

      expect(await within(propia()).findByRole('status')).toHaveTextContent(
        'Quitaste tu mascota propia. Tu acompañante vuelve a ser Fungito.',
      );
      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(5);
      expect(within(mascotas()).getByRole('radio', { name: /Fungito/ })).toBeChecked();
      expect(within(mascotas()).getByRole('textbox', { name: 'Cómo se llama' })).toHaveValue(
        'Luma',
      );
      expect(screen.getByRole('button', { name: 'Luma, tu mascota' })).toBeInTheDocument();
      expect(within(propia()).getByLabelText('Subir mi dibujo')).toBeInTheDocument();
    });
  });

  describe('subir la primera', () => {
    it('queda como la elegida, y las opciones pasan a ser seis', async () => {
      guardarLaMascotaPropia.mockResolvedValue({
        ...CUENTA,
        mascotaPropia: { actualizadaEl: MARCA },
      });
      cambiarPreferencias.mockResolvedValue({
        ...CUENTA,
        mascota: { forma: 'propia', nombre: 'Mi mascota' },
        mascotaPropia: { actualizadaEl: MARCA },
      });

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });

      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(5);

      await usuario.upload(within(propia()).getByLabelText('Subir mi dibujo'), DIBUJO);

      expect(await within(propia()).findByRole('status')).toHaveTextContent(
        'Listo, tu mascota ya te acompaña.',
      );
      expect(guardarLaMascotaPropia).toHaveBeenCalledWith(DIBUJO);
      expect(cambiarPreferencias).toHaveBeenCalledWith({
        mascota: { forma: 'propia', nombre: 'Mi mascota' },
      });
      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(6);
      expect(within(mascotas()).getByRole('radio', { name: /Mi mascota/ })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Mi mascota, tu mascota' })).toBeInTheDocument();
      expect(within(propia()).getByLabelText('Cambiar mi dibujo')).toBeInTheDocument();
    });

    it('si no se pudo dejar como la elegida, queda como una opcion mas y se dice como elegirla', async () => {
      guardarLaMascotaPropia.mockResolvedValue({
        ...CUENTA,
        mascotaPropia: { actualizadaEl: MARCA },
      });
      cambiarPreferencias.mockRejectedValue(new TypeError('Failed to fetch'));

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.upload(within(propia()).getByLabelText('Subir mi dibujo'), DIBUJO);

      expect(await within(propia()).findByRole('alert')).toHaveTextContent(
        'Elígelo en «Tu mascota»',
      );
      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(6);
      // Sigue con Fungito, y la opcion nueva esta a la vista para elegirla.
      expect(within(mascotas()).getByRole('radio', { name: /Fungito/ })).toBeChecked();
      expect(within(mascotas()).getByRole('radio', { name: /Mi mascota/ })).not.toBeChecked();
    });

    it('si la API rechaza el dibujo, no cambia nada y dice por que', async () => {
      guardarLaMascotaPropia.mockRejectedValue(
        new ErrorDeLaApi(400, 'x', undefined, 'MASCOTA_SVG_NO_ADMITIDO'),
      );

      pintar();

      await screen.findByRole('region', { name: 'Tu mascota' });
      await usuario.upload(within(propia()).getByLabelText('Subir mi dibujo'), DIBUJO);

      expect(await within(propia()).findByRole('alert')).toHaveTextContent(
        'textos, imágenes, filtros o estilos',
      );
      expect(cambiarPreferencias).not.toHaveBeenCalled();
      expect(within(mascotas()).getAllByRole('radio')).toHaveLength(5);
    });
  });
});

describe('sin conexion (SCRUM-142)', () => {
  const NECESITAS = 'Necesitas conexión para esto.';

  function sinConexion() {
    return vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  }

  /** Los apartados que cambian algo en el servidor: todos menos el correo, que solo se ve. */
  const CAMBIAN_ALGO = [
    'Cómo te llamamos',
    'Tus módulos',
    'Tu diario',
    'Contraseña',
    'Tus datos',
    'Borrar tu cuenta',
  ];

  it.each(CAMBIAN_ALGO)(
    '«%s» dice que necesita conexion y no deja usar sus controles',
    async (titulo) => {
      sinConexion();
      pintar();
      await screen.findByRole('heading', { name: 'Tu perfil' });

      const seccion = apartado(titulo);

      expect(within(seccion).getByText(NECESITAS)).toBeInTheDocument();
      expect(within(seccion).getByRole('group')).toBeDisabled();

      for (const control of seccion.querySelectorAll('button, input')) {
        expect(control, titulo).toBeDisabled();
      }
    },
  );

  it('la foto, la mascota y los avisos tambien', async () => {
    sinConexion();
    pintar();
    await screen.findByRole('heading', { name: 'Tu perfil' });

    for (const seccion of screen.getAllByRole('region')) {
      const titulo = within(seccion).getByRole('heading', { level: 2 }).textContent ?? '';

      if (titulo === 'Tu correo' || /Semáforo|VSD/.test(titulo)) {
        continue;
      }

      const controles = seccion.querySelectorAll('button, input, select, textarea');

      for (const control of controles) {
        expect(control, `${titulo}: ${control.outerHTML.slice(0, 60)}`).toBeDisabled();
      }
    }
  });

  it('el correo solo se muestra: no se bloquea ni dice que necesita conexion', async () => {
    sinConexion();
    pintar();
    await screen.findByRole('heading', { name: 'Tu perfil' });

    const correo = apartado('Tu correo');

    expect(correo).toHaveTextContent(CUENTA.correo);
    expect(within(correo).queryByText(NECESITAS)).not.toBeInTheDocument();
    expect(within(correo).queryByRole('group')).not.toBeInTheDocument();
  });

  it('con conexion nada dice que haga falta', async () => {
    pintar();
    await screen.findByRole('heading', { name: 'Tu perfil' });

    expect(screen.queryByText(NECESITAS)).not.toBeInTheDocument();
    expect(within(apartado('Cómo te llamamos')).getByRole('button')).toBeEnabled();
  });

  it('no se simula un exito: ni se llama a la API ni se dice que se guardo', async () => {
    const red = sinConexion();

    pintar();
    await screen.findByRole('heading', { name: 'Tu perfil' });

    const nombre = within(apartado('Cómo te llamamos')).getByRole('textbox', { name: 'Nombre' });

    // Un campo deshabilitado no recibe nada, y el boton no hace nada.
    await usuario.type(nombre, 'Otro');
    await usuario.click(within(apartado('Cómo te llamamos')).getByRole('button'));

    expect(cambiarPreferencias).not.toHaveBeenCalled();
    expect(screen.queryByText('Listo, así te llamaremos.')).not.toBeInTheDocument();

    red.mockReturnValue(true);
  });

  it('lo que se habia escrito no se pierde al irse la red, y se puede seguir al volver', async () => {
    const red = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    cambiarPreferencias.mockResolvedValue({ ...CUENTA, nombre: 'Marina Isabel' });
    pintar();
    await screen.findByRole('heading', { name: 'Tu perfil' });

    const nombre = () =>
      within(apartado('Cómo te llamamos')).getByRole('textbox', { name: 'Nombre' });

    await usuario.clear(nombre());
    await usuario.type(nombre(), 'Marina Isabel');

    act(() => {
      red.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(nombre()).toBeDisabled();
    expect(nombre()).toHaveValue('Marina Isabel');

    act(() => {
      red.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });
    await usuario.click(within(apartado('Cómo te llamamos')).getByRole('button'));

    expect(cambiarPreferencias).toHaveBeenCalledWith({ nombre: 'Marina Isabel' });
  });

  it('el codigo y la contrasena que se escribian no se pierden al irse la red', async () => {
    const red = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    pintar();
    await screen.findByRole('heading', { name: 'Tu perfil' });
    await usuario.click(
      within(apartado('Contraseña')).getByRole('button', { name: 'Enviarme un código' }),
    );
    await usuario.type(
      await within(apartado('Contraseña')).findByLabelText('Código del correo'),
      '123456',
    );

    act(() => {
      red.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(within(apartado('Contraseña')).getByLabelText('Código del correo')).toBeDisabled();
    expect(within(apartado('Contraseña')).getByLabelText('Código del correo')).toHaveValue(
      '123456',
    );
    expect(
      within(apartado('Contraseña')).getByRole('button', { name: 'Cambiar contraseña' }),
    ).toBeDisabled();
  });

  describe('con la copia de la cuenta que guardo el panel', () => {
    const SIN_RED = () => Promise.reject(new TypeError('Failed to fetch'));
    const HAY_COPIA = /Datos de hace/;

    beforeEach(async () => {
      // Estas pruebas esperan lecturas del almacen y dos vueltas a la API: con la suite completa
      // en marcha, el segundo por omision se queda corto y flaquean sin que nada este mal.
      configure({ asyncUtilTimeout: 3000 });
      await abrirUnAlmacenDePrueba();
    });

    afterEach(() => {
      configure({ asyncUtilTimeout: 1000 });
      cerrarElAlmacenDePrueba();
    });

    /**
     * Espera a ver la copia y a que se hayan suscrito los efectos de la pantalla. Sin lo segundo, un
     * `online` enviado enseguida a veces llega antes de que alguien lo escuche y se pierde.
     */
    async function verLaCopia() {
      await screen.findByText(HAY_COPIA);
      await act(async () => {
        await Promise.resolve();
      });
    }

    async function guardarLaCopia(cuenta: Cuenta = { ...CUENTA, nombre: 'Marina de ayer' }) {
      await guardarElPanel({ cuenta, progreso: [] });
    }

    it('sin conexion ensena la cuenta guardada, dice de cuando es y no deja cambiar nada', async () => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockImplementation(SIN_RED);
      sinConexion();
      pintar();

      expect(await screen.findByText(HAY_COPIA)).toHaveTextContent('Se ponen al día solo cuando');

      const nombre = within(apartado('Cómo te llamamos')).getByRole('textbox', { name: 'Nombre' });

      expect(nombre).toHaveValue('Marina de ayer');
      expect(nombre).toBeDisabled();
      expect(within(apartado('Cómo te llamamos')).getByText(NECESITAS)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('con un servidor que no responde bien (503) tambien: Render despertando no es un error', async () => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockRejectedValue(new ErrorDeLaApi(503, 'Servicio no disponible'));
      pintar();

      expect(await screen.findByText(HAY_COPIA)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('con la copia a la vista pero con conexion, lo que se guarda la reemplaza por lo del servidor', async () => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockRejectedValue(new ErrorDeLaApi(503, 'Servicio no disponible'));
      cambiarPreferencias.mockResolvedValue({ ...CUENTA, nombre: 'Mari' });
      pintar();
      await screen.findByText(HAY_COPIA);

      const seccion = apartado('Cómo te llamamos');

      await usuario.clear(within(seccion).getByRole('textbox', { name: 'Nombre' }));
      await usuario.type(within(seccion).getByRole('textbox', { name: 'Nombre' }), 'Mari');
      await usuario.click(within(seccion).getByRole('button', { name: 'Guardar nombre' }));

      expect(cambiarPreferencias).toHaveBeenCalledWith({ nombre: 'Mari' });
      expect(await within(seccion).findByRole('status')).toHaveTextContent('Listo');
      expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
    });

    it('sin copia, el error sale como siempre: nunca se inventa una cuenta', async () => {
      darDeAltaLaCuenta.mockImplementation(SIN_RED);
      pintar();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Cómo te llamamos' })).not.toBeInTheDocument();
    });

    it.each([
      [
        'una cuenta que no existe (403)',
        new ErrorDeLaApi(403, 'No tienes cuenta', undefined, 'SIN_CUENTA'),
      ],
      ['una peticion rechazada (400)', new ErrorDeLaApi(400, 'No se entiende')],
      ['una sesion que ya no vale (401)', new ErrorDeLaApi(401, 'Sesion vencida')],
    ])('%s no se tapa con la copia: es una respuesta, no una caida', async (_nombre, error) => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockRejectedValue(error);
      pintar();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Cómo te llamamos' })).not.toBeInTheDocument();
    });

    it('una copia que no se entiende no se usa', async () => {
      await cicloActual()?.almacen.guardarLectura(
        CLAVE_DEL_PANEL,
        { valor: { cuenta: { id: 'x' }, progreso: [] }, etag: null },
        new Date(),
      );
      darDeAltaLaCuenta.mockImplementation(SIN_RED);
      pintar();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
    });

    it('al volver la conexion pregunta de nuevo y deja de decir que son datos de antes', async () => {
      await guardarLaCopia({
        ...CUENTA,
        nombre: 'Marina de ayer',
        mascota: { forma: 'ori', nombre: 'Papelito' },
      });
      darDeAltaLaCuenta.mockImplementation(SIN_RED);

      const red = sinConexion();

      pintar();
      await verLaCopia();
      expect(within(apartado('Tu mascota')).getByRole('radio', { name: /Ori/ })).toBeChecked();

      darDeAltaLaCuenta.mockResolvedValue({
        ...CUENTA,
        nombre: 'Marina de hoy',
        mascota: { forma: 'sparky', nombre: 'Chispa' },
      });
      act(() => {
        red.mockReturnValue(true);
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
      });

      const nombre = within(apartado('Cómo te llamamos')).getByRole('textbox', { name: 'Nombre' });

      expect(nombre).toHaveValue('Marina de hoy');
      expect(nombre).toBeEnabled();
      expect(within(apartado('Tu mascota')).getByRole('radio', { name: /Sparky/ })).toBeChecked();
      expect(within(apartado('Tu mascota')).getByRole('textbox')).toHaveValue('Chispa');
      expect(screen.queryByText(NECESITAS)).not.toBeInTheDocument();
    });

    it('mientras llega lo nuevo, la copia sigue a la vista: no se pasa por "cargando"', async () => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockImplementation(SIN_RED);

      const red = sinConexion();

      pintar();
      await verLaCopia();

      let llega: (cuenta: Cuenta) => void = () => undefined;

      darDeAltaLaCuenta.mockReturnValue(
        new Promise<Cuenta>((resolver) => {
          llega = resolver;
        }),
      );
      act(() => {
        red.mockReturnValue(true);
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(darDeAltaLaCuenta).toHaveBeenCalledTimes(2);
      });
      expect(screen.getByText(HAY_COPIA)).toBeInTheDocument();
      expect(screen.queryByText('Cargando tu perfil…')).not.toBeInTheDocument();

      await act(async () => {
        llega({ ...CUENTA, nombre: 'Marina de hoy' });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
      });
    });

    it('si al volver la red sigue sin llegar, la copia sigue a la vista', async () => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockImplementation(SIN_RED);
      pintar();
      await verLaCopia();

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(darDeAltaLaCuenta).toHaveBeenCalledTimes(2);
      });
      expect(await screen.findByText(HAY_COPIA)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('si la copia cambio mientras tanto (otra pestana), al volver a leerla se ve la nueva', async () => {
      await guardarLaCopia();
      darDeAltaLaCuenta.mockImplementation(SIN_RED);
      pintar();
      await verLaCopia();

      await guardarLaCopia({ ...CUENTA, nombre: 'Marina desde otra pestaña' });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(
          within(apartado('Cómo te llamamos')).getByRole('textbox', { name: 'Nombre' }),
        ).toHaveValue('Marina desde otra pestaña');
      });
      expect(screen.getByText(HAY_COPIA)).toBeInTheDocument();
    });

    it('si lo que se ve es lo de la API, la conexion que vuelve no pregunta otra vez', async () => {
      pintar();
      await screen.findByRole('region', { name: 'Cómo te llamamos' });

      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      await Promise.resolve();

      expect(darDeAltaLaCuenta).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(HAY_COPIA)).not.toBeInTheDocument();
    });
  });
});
