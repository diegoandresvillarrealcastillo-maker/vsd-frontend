import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { olvidarElRegistro } from '../../sesion/useRegistroCompleto.ts';
import { ActualizamosNuestrosTextos } from './ActualizamosNuestrosTextos.tsx';

/**
 * «Actualizamos nuestros textos»: la pantalla que ve quien tiene que volver a aceptar el aviso de
 * privacidad o los terminos porque cambiaron (SCRUM-237).
 *
 * Lo que mas importa: que pida solo lo que cambio, que sin marcar todo no mande nada, que quien no
 * quiere aceptar pueda irse (cerrar la sesion o borrar la cuenta) sin que se le borre nada por
 * accidente, y que un cambio de textos a mitad de camino no la deje atascada.
 */
const {
  consultarElEstadoDelRegistro,
  aceptarLosTextos,
  consultarLosTextosVigentes,
  borrarMiCuenta,
  olvidarLosDatosDeLaSesionActual,
} = vi.hoisted(() => ({
  consultarElEstadoDelRegistro: vi.fn(),
  aceptarLosTextos: vi.fn(),
  consultarLosTextosVigentes: vi.fn(),
  borrarMiCuenta: vi.fn(),
  olvidarLosDatosDeLaSesionActual: vi.fn(),
}));

vi.mock('../../infraestructura/api/registro.ts', async (importarLoReal) => ({
  ...(await importarLoReal<typeof import('../../infraestructura/api/registro.ts')>()),
  consultarElEstadoDelRegistro,
  aceptarLosTextos,
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLosTextosVigentes }));
vi.mock('../../infraestructura/api/cuenta.ts', async (importarLoReal) => ({
  ...(await importarLoReal<typeof import('../../infraestructura/api/cuenta.ts')>()),
  borrarMiCuenta,
}));
vi.mock('../../sincronizacion/ciclo.ts', () => ({ olvidarLosDatosDeLaSesionActual }));

const SESION = { user: { id: 'persona-1', email: 'ana@ejemplo.test' } } as Session;
const LOS_DOS = ['aviso_de_privacidad', 'terminos'] as const;
const TEXTOS = { aviso: '2026-10-3', terminos: '2026-10-3' };

function estado(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: SESION,
    cargando: false,
    correo: 'ana@ejemplo.test',
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  };
}

/** Pinta a donde se llega despues, mostrando a donde iba quien lo pide. */
function PantallaDeDestino({ nombre }: { nombre: string }) {
  const ubicacion = useLocation();
  const volverA = (ubicacion.state as { volverA?: string } | null)?.volverA;

  return (
    <p>
      {nombre}. Venia de: {volverA ?? 'ningun sitio'}
    </p>
  );
}

function pintar(valor: EstadoDeSesion, volverA: string = RUTAS.PANEL) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[{ pathname: RUTAS.ACTUALIZAMOS_TEXTOS, state: { volverA } }]}>
        <Routes>
          <Route path={RUTAS.ACTUALIZAMOS_TEXTOS} element={<ActualizamosNuestrosTextos />} />
          <Route path={RUTAS.PANEL} element={<PantallaDeDestino nombre="Panel de prueba" />} />
          <Route path={RUTAS.PERFIL} element={<PantallaDeDestino nombre="Perfil de prueba" />} />
          <Route path={RUTAS.INICIO} element={<PantallaDeDestino nombre="Inicio de prueba" />} />
          <Route
            path={RUTAS.COMPLETAR_REGISTRO}
            element={<PantallaDeDestino nombre="Completa tu registro" />}
          />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  olvidarElRegistro();
  consultarElEstadoDelRegistro.mockResolvedValue({
    estado: 'textos-pendientes',
    cuenta: {},
    pendientes: LOS_DOS,
  });
  aceptarLosTextos.mockResolvedValue({});
  consultarLosTextosVigentes.mockResolvedValue(TEXTOS);
  borrarMiCuenta.mockResolvedValue(undefined);
  olvidarLosDatosDeLaSesionActual.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

async function pantallaLista() {
  await screen.findByRole('heading', { name: 'Actualizamos nuestros textos' });
}

describe('lo que se le pide', () => {
  it('cuando cambiaron los dos, pide las dos casillas', async () => {
    pintar(estado());
    await pantallaLista();

    expect(screen.getByLabelText(/Acepto el aviso de privacidad/)).not.toBeChecked();
    expect(screen.getByLabelText(/Acepto los términos/)).not.toBeChecked();
  });

  it('cuando solo cambiaron los terminos, pide solo la de los terminos', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({
      estado: 'textos-pendientes',
      cuenta: {},
      pendientes: ['terminos'],
    });

    pintar(estado());
    await pantallaLista();

    expect(screen.getByLabelText(/Acepto los términos/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Acepto el aviso de privacidad/)).not.toBeInTheDocument();
  });

  it('cada casilla enlaza al documento, en otra pestana para no perder el sitio', async () => {
    pintar(estado());
    await pantallaLista();

    const aviso = screen.getByRole('link', { name: /Leer el aviso de privacidad/ });
    const terminos = screen.getByRole('link', { name: /Leer los términos/ });

    expect(aviso).toHaveAttribute('href', RUTAS.PRIVACIDAD);
    expect(aviso).toHaveAttribute('target', '_blank');
    expect(terminos).toHaveAttribute('href', RUTAS.TERMINOS);
    expect(terminos).toHaveAttribute('target', '_blank');
  });

  it('no se pierde los datos de nadie por el camino: explica que nada se borra al no aceptar', async () => {
    pintar(estado());
    await pantallaLista();

    expect(screen.getByText(/no se borra nada/i)).toBeInTheDocument();
  });
});

describe('aceptar', () => {
  async function marcarTodo() {
    await usuario.click(screen.getByLabelText(/Acepto el aviso de privacidad/));
    await usuario.click(screen.getByLabelText(/Acepto los términos/));
  }

  it('manda lo pendiente con las versiones que dice la API y vuelve a donde iba', async () => {
    pintar(estado(), RUTAS.PERFIL);
    await pantallaLista();

    await marcarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    await waitFor(() => {
      expect(aceptarLosTextos).toHaveBeenCalledTimes(1);
    });
    expect(aceptarLosTextos).toHaveBeenCalledWith({ pendientes: LOS_DOS, textos: TEXTOS });
    expect(await screen.findByText(/Perfil de prueba/)).toBeInTheDocument();
  });

  it('sin marcar todo lo que se muestra no manda nada, y dice que falta', async () => {
    pintar(estado());
    await pantallaLista();

    await usuario.click(screen.getByLabelText(/Acepto el aviso de privacidad/));
    await usuario.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    expect(aceptarLosTextos).not.toHaveBeenCalled();
    expect(consultarLosTextosVigentes).not.toHaveBeenCalled();
    expect(
      screen.getByText(/hace falta aceptar para seguir usando VSD Health/i),
    ).toBeInTheDocument();
  });

  it('si los textos cambiaron otra vez mientras tanto, lo dice y deja reintentar', async () => {
    aceptarLosTextos.mockRejectedValue(
      new ErrorDeLaApi(409, 'Ya no es la vigente.', undefined, 'VERSION_DEL_AVISO_NO_VIGENTE'),
    );

    pintar(estado());
    await pantallaLista();
    await marcarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/acaban de actualizarse/);
    // Sigue aqui, con las casillas, para volver a intentarlo.
    expect(screen.getByRole('button', { name: 'Aceptar y continuar' })).toBeInTheDocument();
  });

  it('si la sesion caduco, lo dice', async () => {
    aceptarLosTextos.mockRejectedValue(new ErrorDeLaApi(401, 'Caduco.'));

    pintar(estado());
    await pantallaLista();
    await marcarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión caducó/);
  });

  it('sin conexion no se pierde nada: lo dice y se puede reintentar', async () => {
    aceptarLosTextos.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar(estado());
    await pantallaLista();
    await marcarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo conectar/);
  });
});

describe('a quien no le hace falta estar aqui', () => {
  it('si ya no hay nada pendiente, sigue de largo', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'completo', cuenta: {} });

    pintar(estado(), RUTAS.PERFIL);

    expect(await screen.findByText(/Perfil de prueba/)).toBeInTheDocument();
  });

  it('si antes hay que completar el registro, la lleva a completarlo', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'incompleto', cuenta: {} });

    pintar(estado(), RUTAS.PERFIL);

    expect(
      await screen.findByText(`Completa tu registro. Venia de: ${RUTAS.PERFIL}`),
    ).toBeInTheDocument();
  });

  it('si no se puede comprobar, la pantalla sirve igual y pide los dos: la API manda', async () => {
    consultarElEstadoDelRegistro.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar(estado());
    await pantallaLista();

    expect(screen.getByLabelText(/Acepto el aviso de privacidad/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Acepto los términos/)).toBeInTheDocument();
  });
});

describe('quien no quiere aceptar', () => {
  it('puede cerrar la sesion sin que se borre nada', async () => {
    const salir = vi.fn().mockResolvedValue(undefined);

    pintar(estado({ salir }));
    await pantallaLista();

    await usuario.click(
      screen.getByRole('button', { name: /Prefiero no aceptar y cerrar la sesión/ }),
    );

    expect(salir).toHaveBeenCalledTimes(1);
    expect(borrarMiCuenta).not.toHaveBeenCalled();
    expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
  });

  describe('y prefiere borrar su cuenta', () => {
    async function abrirElBorrado() {
      await usuario.click(screen.getByText('Quiero borrar mi cuenta'));
    }

    it('tiene que escribir la frase exacta: sin ella el boton no hace nada', async () => {
      pintar(estado());
      await pantallaLista();
      await abrirElBorrado();

      const boton = screen.getByRole('button', { name: 'Borrar mi cuenta para siempre' });

      expect(boton).toBeDisabled();

      await usuario.type(screen.getByLabelText(/escribe BORRAR MI CUENTA/), 'borrar');

      expect(boton).toBeDisabled();
      expect(borrarMiCuenta).not.toHaveBeenCalled();
    });

    it('con la frase, borra, olvida lo de este equipo antes de cerrar la sesion y sale', async () => {
      const orden: string[] = [];
      const salir = vi.fn().mockImplementation(() => {
        orden.push('salir');

        return Promise.resolve();
      });

      borrarMiCuenta.mockImplementation(() => {
        orden.push('borrar');

        return Promise.resolve();
      });
      olvidarLosDatosDeLaSesionActual.mockImplementation(() => {
        orden.push('olvidar');

        return Promise.resolve();
      });

      pintar(estado({ salir }));
      await pantallaLista();
      await abrirElBorrado();
      await usuario.type(screen.getByLabelText(/escribe BORRAR MI CUENTA/), 'BORRAR MI CUENTA');
      await usuario.click(screen.getByRole('button', { name: 'Borrar mi cuenta para siempre' }));

      expect(await screen.findByText(/Inicio de prueba/)).toBeInTheDocument();
      expect(borrarMiCuenta).toHaveBeenCalledWith('BORRAR MI CUENTA');
      // Lo de este equipo se olvida antes de cerrar la sesion, para que no dependa de que cerrarla salga bien.
      expect(orden).toEqual(['borrar', 'olvidar', 'salir']);
    });

    it('si no se pudo borrar, no se borro nada y lo dice', async () => {
      const salir = vi.fn().mockResolvedValue(undefined);

      borrarMiCuenta.mockRejectedValue(
        new ErrorDeLaApi(503, 'No.', undefined, 'BORRADO_NO_COMPLETADO'),
      );

      pintar(estado({ salir }));
      await pantallaLista();
      await abrirElBorrado();
      await usuario.type(screen.getByLabelText(/escribe BORRAR MI CUENTA/), 'BORRAR MI CUENTA');
      await usuario.click(screen.getByRole('button', { name: 'Borrar mi cuenta para siempre' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/no se borró nada/);
      expect(salir).not.toHaveBeenCalled();
      expect(olvidarLosDatosDeLaSesionActual).not.toHaveBeenCalled();
    });
  });
});
