import type { Session } from '@supabase/supabase-js';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { avisarQueHayTextosPendientes } from '../infraestructura/api/clienteHttp.ts';
import { almacenamientoDeSesion } from '../infraestructura/supabase/almacenamiento.ts';
import {
  ESPERA_DEL_REGISTRO_EN_MS,
  olvidarElRegistro,
  olvidarElRegistroGuardado,
} from '../sesion/useRegistroCompleto.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { RutaProtegida } from './RutaProtegida.tsx';
import { RUTAS } from './rutas.ts';

/** La clave de `useRegistroCompleto.ts`: la prueba simula lo que dejo una visita anterior. */
const CLAVE_DEL_REGISTRO_RECORDADO = 'vsd.registro-completo';

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

/** Lo mismo con la de volver a aceptar los textos. */
function PantallaDeTextos() {
  const ubicacion = useLocation();
  const estadoDeRuta = ubicacion.state as { volverA?: string } | null;

  return <p>Actualizamos nuestros textos. Venia de: {estadoDeRuta?.volverA ?? 'ningun sitio'}</p>;
}

function pintar(valor: EstadoDeSesion, rutaInicial: string = RUTAS.PANEL) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[rutaInicial]}>
        <Routes>
          <Route path={RUTAS.ACCESO} element={<PantallaDeAcceso />} />
          <Route path={RUTAS.COMPLETAR_REGISTRO} element={<PantallaDeRegistro />} />
          <Route path={RUTAS.ACTUALIZAMOS_TEXTOS} element={<PantallaDeTextos />} />
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

afterEach(() => {
  vi.useRealTimers();
});

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

  it('mientras comprueba, el mensaje se ve: no es solo para lectores de pantalla', () => {
    consultarElEstadoDelRegistro.mockReturnValue(new Promise(() => undefined));

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    const mensaje = screen.getByText('Comprobando tu registro');

    // Tardia: llega despues de que la persona ya vio algo, y mostrarla de golpe parpadea.
    expect(mensaje.closest('.vsd-carga--tardio')).not.toBeNull();
    expect(mensaje.closest('.solo-lectores')).toBeNull();
  });

  it('mientras comprueba la sesion, tambien se ve, y desde el primer instante (SCRUM-283)', () => {
    pintar(estado({ sesion: null, cargando: true }));

    const pantalla = screen.getByText('Comprobando la sesión').closest('.vsd-carga');

    // Es la misma pantalla de carga que el `index.html` ya puso al abrir: no hay que esperar a que
    // aparezca ni parpadea al reemplazarla.
    expect(pantalla).not.toBeNull();
    expect(pantalla).not.toHaveClass('vsd-carga--tardio');
  });

  it('no bloquea si no se pudo preguntar: la aplicacion se usa sin conexion', async () => {
    // La API es la que de verdad manda: a una cuenta incompleta le responde 403
    // en todo lo demas. Aqui lo unico que se evita es dejar a alguien sin poder
    // abrir la aplicacion porque el servidor esta dormido.
    consultarElEstadoDelRegistro.mockRejectedValue(new TypeError('Failed to fetch'));

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();
  });

  // Un servidor que no contesta (dormido, o una conexion que no avanza) dejaba la pantalla en blanco el
  // tiempo que durara la espera: el unico texto era para lectores de pantalla (SCRUM-248).
  it('no deja la pantalla esperando para siempre: si el servidor no contesta, pasa tras unos segundos', async () => {
    vi.useFakeTimers();
    consultarElEstadoDelRegistro.mockReturnValue(new Promise(() => undefined));

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESPERA_DEL_REGISTRO_EN_MS - 1);
    });

    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.getByText('Contenido reservado')).toBeInTheDocument();
  });

  it('si la respuesta llega despues del plazo y dice que falta el registro, la lleva a completarlo', async () => {
    vi.useFakeTimers();
    let responder: (valor: unknown) => void = () => undefined;

    consultarElEstadoDelRegistro.mockReturnValue(
      new Promise((resolver) => {
        responder = resolver;
      }),
    );

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESPERA_DEL_REGISTRO_EN_MS);
    });

    expect(screen.getByText('Contenido reservado')).toBeInTheDocument();

    await act(async () => {
      responder({ estado: 'sin-cuenta' });
      await Promise.resolve();
    });

    expect(screen.getByText(/^Completa tu registro\./)).toBeInTheDocument();
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

describe('RutaProtegida y los textos que cambian (SCRUM-237)', () => {
  it('lleva a «Actualizamos nuestros textos» a quien tiene que volver a aceptar', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({
      estado: 'textos-pendientes',
      cuenta: {},
      pendientes: ['terminos'],
    });

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(
      await screen.findByText(`Actualizamos nuestros textos. Venia de: ${RUTAS.PANEL}`),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
  });

  it('si la API avisa de textos pendientes mientras se usa la aplicacion, la lleva alli aunque ya estuviera comprobada', async () => {
    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();

    // Pasa cuando se publica una version nueva con la sesion abierta: la pantalla que ya estaba
    // pintada recibe un 403 de la API, y no hay que esperar a recargar para enterarse.
    act(() => {
      avisarQueHayTextosPendientes();
    });

    expect(
      await screen.findByText(`Actualizamos nuestros textos. Venia de: ${RUTAS.PANEL}`),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
  });

  it('en las rutas que no exigen el registro no la lleva a ninguna parte', () => {
    // Es la propia pantalla de aceptar, o el perfil: llevarla de nuevo seria un bucle.
    pintar(estado({ sesion: SESION_CUALQUIERA }), RUTAS.PERFIL);

    act(() => {
      avisarQueHayTextosPendientes();
    });

    expect(screen.getByText('Contenido sin registro')).toBeInTheDocument();
  });
});

describe('RutaProtegida y el registro recordado entre visitas (SCRUM-283)', () => {
  /** Lo que queda en el equipo de una visita anterior: la memoria de la pagina se perdio, esto no. */
  function recordarDeUnaVisitaAnterior(persona: string): void {
    almacenamientoDeSesion.setItem(CLAVE_DEL_REGISTRO_RECORDADO, persona);
  }

  it('si ya se supo que esta completo, abre sin esperar a la API', () => {
    // Con el servidor dormido, preguntar antes de ensenar nada era la espera mas larga al abrir.
    consultarElEstadoDelRegistro.mockReturnValue(new Promise(() => undefined));
    recordarDeUnaVisitaAnterior('persona-1');

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.getByText('Contenido reservado')).toBeInTheDocument();
    expect(screen.queryByText('Comprobando tu registro')).not.toBeInTheDocument();
    expect(consultarElEstadoDelRegistro).not.toHaveBeenCalled();
  });

  it('lo recordado de otra persona no vale para esta: se comprueba por su cuenta', () => {
    consultarElEstadoDelRegistro.mockReturnValue(new Promise(() => undefined));
    recordarDeUnaVisitaAnterior('otra-persona');

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.getByText('Comprobando tu registro')).toBeInTheDocument();
    expect(consultarElEstadoDelRegistro).toHaveBeenCalledTimes(1);
  });

  it('la primera vez lo deja recordado para la proxima', async () => {
    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(await screen.findByText('Contenido reservado')).toBeInTheDocument();
    expect(almacenamientoDeSesion.getItem(CLAVE_DEL_REGISTRO_RECORDADO)).toBe('persona-1');
  });

  it('al cerrar la sesion se olvida, para quien use el mismo equipo despues', () => {
    recordarDeUnaVisitaAnterior('persona-1');

    olvidarElRegistroGuardado();

    expect(almacenamientoDeSesion.getItem(CLAVE_DEL_REGISTRO_RECORDADO)).toBeNull();
  });

  it('si la API avisa de textos nuevos, lo recordado deja de valer y se lleva a aceptarlos', async () => {
    recordarDeUnaVisitaAnterior('persona-1');

    pintar(estado({ sesion: SESION_CUALQUIERA }));

    expect(screen.getByText('Contenido reservado')).toBeInTheDocument();

    // La primera llamada de la pantalla recibe el 403 de «textos pendientes».
    act(() => {
      avisarQueHayTextosPendientes();
    });

    expect(
      await screen.findByText(`Actualizamos nuestros textos. Venia de: ${RUTAS.PANEL}`),
    ).toBeInTheDocument();
    expect(almacenamientoDeSesion.getItem(CLAVE_DEL_REGISTRO_RECORDADO)).toBeNull();
  });
});
