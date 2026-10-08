import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { olvidarElRegistro } from '../sesion/useRegistroCompleto.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { RutaProtegida } from './RutaProtegida.tsx';
import { RUTAS } from './rutas.ts';

const { consultarElEstadoDelRegistro } = vi.hoisted(() => ({
  consultarElEstadoDelRegistro: vi.fn(),
}));

vi.mock('../infraestructura/api/registro.ts', () => ({ consultarElEstadoDelRegistro }));

/**
 * Se construye el estado a mano en vez de levantar el proveedor. Asi la prueba
 * habla de lo unico que hace este componente —decidir si deja pasar— y no
 * depende de Supabase ni de la red.
 */
function estado(parcial: Partial<EstadoDeSesion>): EstadoDeSesion {
  const vacio = vi.fn();

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
    salir: vacio,
    ...parcial,
  };
}

const SESION_CUALQUIERA = {
  user: { id: 'persona-1', email: 'alguien@ucundinamarca.edu.co' },
} as Session;

/** Pinta la ruta de acceso mostrando a donde queria ir quien llego aqui. */
function PantallaDeAcceso() {
  const ubicacion = useLocation();
  const estadoDeRuta = ubicacion.state as { volverA?: string } | null;

  return <p>Acceso. Venia de: {estadoDeRuta?.volverA ?? 'ningun sitio'}</p>;
}

/** Lo mismo con la de completar el registro. */
function PantallaDeRegistro() {
  const ubicacion = useLocation();
  const estadoDeRuta = ubicacion.state as { volverA?: string } | null;

  return <p>Completa tu registro. Venia de: {estadoDeRuta?.volverA ?? 'ningun sitio'}</p>;
}

function pintar(valor: EstadoDeSesion, rutaInicial: string = RUTAS.PANEL) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[rutaInicial]}>
        <Routes>
          <Route path={RUTAS.ACCESO} element={<PantallaDeAcceso />} />
          <Route path={RUTAS.COMPLETAR_REGISTRO} element={<PantallaDeRegistro />} />
          <Route
            path={RUTAS.PANEL}
            element={
              <RutaProtegida>
                <p>Contenido reservado</p>
              </RutaProtegida>
            }
          />
          <Route
            path={RUTAS.PERFIL}
            element={
              <RutaProtegida sinRegistro>
                <p>Contenido sin registro</p>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

beforeEach(() => {
  olvidarElRegistro();
  consultarElEstadoDelRegistro.mockReset();
  consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'completo', cuenta: {} });
});

describe('RutaProtegida', () => {
  it('deja pasar a quien tiene sesion y su registro completo', async () => {
    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();
  });

  it('manda a la pantalla de acceso a quien no la tiene', () => {
    pintar(estado({ sesion: null }));

    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
    expect(screen.getByText(/^Acceso\./)).toBeInTheDocument();
  });

  it('recuerda a donde iba, para devolverla ahi despues de entrar', () => {
    pintar(estado({ sesion: null }));

    expect(screen.getByText(`Acceso. Venia de: ${RUTAS.PANEL}`)).toBeInTheDocument();
  });

  it('no expulsa a nadie mientras aun no sabe si hay sesion', () => {
    // Es el caso de recargar la pagina. Sin este estado, la aplicacion pinta
    // un instante como si no hubiera nadie y expulsa a quien si tenia sesion:
    // el parpadeo dura poco y la expulsion no se deshace sola.
    pintar(estado({ sesion: null, cargando: true }));

    expect(screen.queryByText(/^Acceso\./)).not.toBeInTheDocument();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
  });
});

describe('RutaProtegida y el registro (T-03 de la auditoria 360)', () => {
  it('no ensena nada de la cuenta mientras comprueba el registro', () => {
    consultarElEstadoDelRegistro.mockReturnValue(new Promise(() => undefined));

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.getByText('Comprobando tu registro')).toBeInTheDocument();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
  });

  it('lleva a «Completa tu registro» a quien tiene sesion y todavia no tiene cuenta', async () => {
    // Es el camino de Google, y el de quien confirma su correo.
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'sin-cuenta' });

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(
      await screen.findByText(`Completa tu registro. Venia de: ${RUTAS.PANEL}`),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
  });

  it('lleva tambien a quien tiene una cuenta de antes, con el registro incompleto', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'incompleto', cuenta: {} });

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText(/^Completa tu registro\./)).toBeInTheDocument();
  });

  it('no bloquea si no se pudo preguntar: la aplicacion se usa sin conexion', async () => {
    // La API es la que de verdad manda: a una cuenta incompleta le responde 403
    // en todo lo demas. Aqui lo unico que se evita es dejar a alguien sin poder
    // abrir la aplicacion porque el servidor esta dormido.
    consultarElEstadoDelRegistro.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();
  });

  it('en las rutas que no exigen el registro no pregunta nada', () => {
    pintar(estado({ sesion: SESION_CUALQUIERA }), RUTAS.PERFIL);

    expect(screen.getByText('Contenido sin registro')).toBeInTheDocument();
    expect(consultarElEstadoDelRegistro).not.toHaveBeenCalled();
  });

  it('pregunta una sola vez por persona: el registro solo avanza', async () => {
    const primera = pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();

    primera.unmount();
    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.getByText('Contenido reservado')).toBeInTheDocument();
    expect(consultarElEstadoDelRegistro).toHaveBeenCalledTimes(1);
  });

  it('otra persona en el mismo equipo se comprueba por su cuenta', async () => {
    const primera = pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();

    primera.unmount();
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'sin-cuenta' });
    pintar(
      estado({ sesion: { user: { id: 'persona-2', email: 'otra@ejemplo.test' } } as Session }),
    );

    expect(await screen.findByText(/^Completa tu registro\./)).toBeInTheDocument();
    expect(consultarElEstadoDelRegistro).toHaveBeenCalledTimes(2);
  });

  it('sin sesion no pregunta nada', () => {
    pintar(estado({ sesion: null }));

    expect(consultarElEstadoDelRegistro).not.toHaveBeenCalled();
  });
});
