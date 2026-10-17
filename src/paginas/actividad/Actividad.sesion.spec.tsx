import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { abrirUnAlmacenDePrueba, cerrarElAlmacenDePrueba } from '../../pruebas/almacenDePrueba.ts';
import { rutaDeActividad, RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { cicloActual } from '../../sincronizacion/ciclo.ts';
import { guardarElPanel } from '../../sincronizacion/panelLocal.ts';
import { Actividad } from './Actividad.tsx';

/**
 * La sesion del dia, de punta a punta (SCRUM-208, ADR 0030): del panel guardado en este equipo a la
 * pantalla de la actividad y de ahi al resultado, con la cola de verdad.
 *
 * Solo se simula la red y el catalogo. Lo que el panel dejo guardado (el progreso, con la sesion de
 * cada actividad) es lo que lee la actividad al abrirse, tambien sin conexion.
 */
const { buscarActividad, registrarResultado, hayConexionConLaApi } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
  hayConexionConLaApi: vi.fn(),
}));

vi.mock('../../sincronizacion/catalogoLocal.ts', () => ({
  buscarActividadConCopia: buscarActividad,
  nombreDeLaActividad: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
vi.mock('../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));

const MOMENTO = '0acd0000-0000-4000-8000-000000000009';
const PESANDO = '0acd0000-0000-4000-8000-000000000008';

const usuario = userEvent.setup({ delay: null });

const CUENTA: Cuenta = {
  id: 'c-1',
  correo: 'ana@ejemplo.test',
  rol: 'usuario',
  nombre: 'Ana',
  consentimiento: { versionPolitica: '1.0', aceptadoEn: '2026-09-26T15:00:00.000Z' },
  registradoEn: '2026-09-26T15:00:00.000Z',
  modulosActivos: ['emociones'],
  mascota: null,
  diarioConRecomendaciones: false,
  zonaHoraria: 'America/Bogota',
};

const SESION_DE_HOY = {
  id: 's-1',
  titulo: 'Un momento bueno, otra vez',
  nivel: 1,
  parametros: {
    invitacion: '¿Qué probaste hoy?',
    ideas: ['Una receta nueva'],
    campos: 1,
    minimo: 1,
    largoMaximo: 300,
    permiteNingunaHoy: true,
  },
};

/** El progreso que dejo el panel: una actividad con motor y sesion, en lo de hoy o en lo sugerido. */
function panelConSesion(
  idDeLaActividad: string,
  donde: 'hoy' | 'sugeridas' = 'hoy',
): readonly ProgresoDelModulo[] {
  const actividad = {
    id: idDeLaActividad,
    nombre: 'Un momento bueno del día',
    hecha: false,
    motor: 'escritura_breve',
    sesion: SESION_DE_HOY,
  };

  return [
    {
      modulo: 'emociones',
      sesiones: 3,
      etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
      hoy: donde === 'hoy' ? [actividad] : [],
      ...(donde === 'sugeridas' ? { sugeridas: [actividad] } : {}),
    },
  ];
}

function sesion(): EstadoDeSesion {
  const vacio = vi.fn();

  return {
    sesion: { user: { email: 'alguien@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'alguien@ejemplo.test',
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vacio,
  };
}

function pintar(id: string) {
  render(
    <SesionContexto.Provider value={sesion()}>
      <MemoryRouter initialEntries={[rutaDeActividad(id)]}>
        <Routes>
          <Route path={RUTAS.ACTIVIDAD} element={<Actividad />} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

function enviado(): Record<string, unknown> {
  return registrarResultado.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(async () => {
  buscarActividad.mockImplementation((id: string) =>
    Promise.resolve({
      actividad: { id, nombre: 'Un momento bueno del día', tipo: 'bitacora', produceNivel: false },
      categoria: { id: 'cat-3', nombre: 'Emociones', actividades: [] },
    }),
  );
  registrarResultado.mockResolvedValue({
    id: 'r-1',
    activityId: MOMENTO,
    sugiereAcompanamiento: false,
    lineasDeAtencion: [],
    metadata: {},
    completedAt: '2026-10-16T15:00:00.000Z',
  });
  hayConexionConLaApi.mockResolvedValue(true);
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('la actividad con la sesion del panel', () => {
  it('pinta lo que dice la sesion y manda su idSesion al terminar', async () => {
    await guardarElPanel({ cuenta: CUENTA, progreso: panelConSesion(MOMENTO) });

    pintar(MOMENTO);

    expect(await screen.findByText('¿Qué probaste hoy?')).toBeInTheDocument();
    expect(screen.queryByText('¿Qué estuvo bien hoy?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Una receta nueva' })).toBeInTheDocument();

    await usuario.type(screen.getByRole('textbox'), 'Una sopa de lentejas');
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    await waitFor(() => {
      expect(registrarResultado).toHaveBeenCalledTimes(1);
    });
    expect(enviado()).toMatchObject({
      activityId: MOMENTO,
      idSesion: 's-1',
      metadata: { encontroUno: true, texto: 'Una sopa de lentejas' },
    });
  });

  it('tambien la encuentra si la actividad estaba entre las sugeridas', async () => {
    await guardarElPanel({ cuenta: CUENTA, progreso: panelConSesion(MOMENTO, 'sugeridas') });

    pintar(MOMENTO);

    expect(await screen.findByText('¿Qué probaste hoy?')).toBeInTheDocument();
  });

  it('sin nada guardado de la actividad, es la de siempre y no manda idSesion', async () => {
    pintar(MOMENTO);

    expect(await screen.findByText('¿Qué estuvo bien hoy?')).toBeInTheDocument();

    await usuario.type(screen.getByRole('textbox'), 'Un café');
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    await waitFor(() => {
      expect(registrarResultado).toHaveBeenCalledTimes(1);
    });
    expect(enviado()).not.toHaveProperty('idSesion');
  });

  it('la sesion de otra actividad no se le pone a esta', async () => {
    await guardarElPanel({ cuenta: CUENTA, progreso: panelConSesion(PESANDO) });

    pintar(MOMENTO);

    expect(await screen.findByText('¿Qué estuvo bien hoy?')).toBeInTheDocument();
    expect(screen.queryByText('¿Qué probaste hoy?')).not.toBeInTheDocument();
  });

  it('sin conexion, lo que queda en la cola lleva el idSesion y sale al volver la red', async () => {
    hayConexionConLaApi.mockResolvedValue(false);
    await guardarElPanel({ cuenta: CUENTA, progreso: panelConSesion(MOMENTO) });

    pintar(MOMENTO);

    await usuario.type(await screen.findByRole('textbox'), 'Una sopa');
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(await screen.findByText(/Guardado en este equipo/)).toBeInTheDocument();
    expect(registrarResultado).not.toHaveBeenCalled();

    const [operacion] = (await cicloActual()?.almacen.operaciones()) ?? [];

    expect(operacion?.payload).toMatchObject({ activityId: MOMENTO, idSesion: 's-1' });
  });
});

describe('una mecanica nueva, elegida por su motor (SCRUM-209)', () => {
  const NUEVA = '0acd0000-0000-4000-8000-0000000000a1';

  const SESION_DE_CASILLAS = {
    id: 's-9',
    titulo: 'Cuatro colores',
    nivel: 1,
    parametros: {
      casillas: [
        { clave: 'circulo', nombre: 'círculo verde', forma: 'círculo', color: 'verde' },
        { clave: 'cuadrado', nombre: 'cuadrado azul', forma: 'cuadrado', color: 'azul' },
        { clave: 'triangulo', nombre: 'triángulo ámbar', forma: 'triángulo', color: 'ámbar' },
        { clave: 'rombo', nombre: 'rombo violeta', forma: 'rombo', color: 'violeta' },
      ],
      largoInicial: 3,
      rondas: 1,
      msPorElemento: 1000,
      msDeMargen: 1000,
      msDestello: 700,
    },
  };

  function panelDeLaNueva(): readonly ProgresoDelModulo[] {
    return [
      {
        modulo: 'cognicion',
        sesiones: 3,
        etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
        hoy: [
          {
            id: NUEVA,
            nombre: 'Recuerda los colores',
            hecha: false,
            frecuencia: { tipo: 'rotativa' },
            motor: 'secuencia',
            sesion: SESION_DE_CASILLAS,
          },
        ],
      },
    ];
  }

  beforeEach(() => {
    // Una actividad que el mapa por identificador no conoce, con su motor, como la trae el catalogo.
    buscarActividad.mockImplementation((id: string) =>
      Promise.resolve({
        actividad: {
          id,
          nombre: 'Recuerda los colores',
          tipo: 'juego',
          produceNivel: true,
          motor: 'secuencia',
        },
        categoria: { id: 'cat-1', nombre: 'Cognición', actividades: [] },
      }),
    );
  });

  it('se juega con la sesion del panel y el resultado dice cual fue', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // La secuencia de la ronda: la primera, la segunda y la tercera casilla.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.35)
      .mockReturnValueOnce(0.6)
      .mockReturnValue(0.01);

    const jugador = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

    await guardarElPanel({ cuenta: CUENTA, progreso: panelDeLaNueva() });
    pintar(NUEVA);

    expect(await screen.findByText(/Son 1 rondas/)).toBeInTheDocument();

    await jugador.click(screen.getByRole('button', { name: /Empezar/ }));

    // El margen, tres casillas a un segundo cada una, y un instante para responder.
    act(() => {
      vi.advanceTimersByTime(1000 + 2 * 1000 + 700 + 400);
    });

    const casillas = within(screen.getByRole('group', { name: 'Casillas' }));

    await jugador.click(casillas.getByRole('button', { name: 'círculo verde' }));
    await jugador.click(casillas.getByRole('button', { name: 'cuadrado azul' }));
    await jugador.click(casillas.getByRole('button', { name: 'triángulo ámbar' }));
    await jugador.click(screen.getByRole('button', { name: 'Terminar' }));

    await waitFor(() => {
      expect(registrarResultado).toHaveBeenCalledTimes(1);
    });
    expect(enviado()).toMatchObject({
      activityId: NUEVA,
      idSesion: 's-9',
      score: 1,
      metadata: { aciertos: 1, largoMaximo: 3 },
    });
  });

  it('sin la sesion del panel, dice que hay que abrirla desde el panel y no ofrece empezar', async () => {
    pintar(NUEVA);

    expect(await screen.findByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument();
  });
});

describe('una mecanica de varios campos, elegida por su motor (SCRUM-211)', () => {
  const NUEVA = '0acd0000-0000-4000-8000-0000000000b1';

  const SESION_DE_TRES_COSAS = {
    id: 's-10',
    titulo: 'Algo que probaste',
    nivel: 1,
    parametros: {
      invitacion: 'Algo que probaste hoy, aunque sea pequeño.',
      campos: 3,
      minimo: 1,
      largoMaximo: 200,
      permiteNingunaHoy: true,
    },
  };

  function panelDeLaNueva(): readonly ProgresoDelModulo[] {
    return [
      {
        modulo: 'emociones',
        sesiones: 3,
        etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
        hoy: [
          {
            id: NUEVA,
            nombre: 'Tres cosas buenas',
            hecha: false,
            frecuencia: { tipo: 'rotativa' },
            motor: 'escritura_breve',
            sesion: SESION_DE_TRES_COSAS,
          },
        ],
      },
    ];
  }

  function campo(n: number) {
    return screen.getByRole('textbox', { name: `Respuesta ${String(n)} de 3` });
  }

  beforeEach(() => {
    // Una actividad que el mapa por identificador no conoce, con su motor, como la trae el catalogo.
    buscarActividad.mockImplementation((id: string) =>
      Promise.resolve({
        actividad: {
          id,
          nombre: 'Tres cosas buenas',
          tipo: 'bitacora',
          produceNivel: false,
          motor: 'escritura_breve',
        },
        categoria: { id: 'cat-3', nombre: 'Emociones', actividades: [] },
      }),
    );
  });

  it('se escribe con la sesion del panel y el resultado dice cual fue, sin puntaje', async () => {
    await guardarElPanel({ cuenta: CUENTA, progreso: panelDeLaNueva() });
    pintar(NUEVA);

    expect(
      await screen.findByRole('group', { name: 'Algo que probaste hoy, aunque sea pequeño.' }),
    ).toBeInTheDocument();

    await usuario.type(campo(1), 'Una sopa de lentejas');
    await usuario.type(campo(3), '  Llamar a mi hermana ');
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    await waitFor(() => {
      expect(registrarResultado).toHaveBeenCalledTimes(1);
    });
    expect(enviado()).toMatchObject({
      activityId: NUEVA,
      idSesion: 's-10',
      metadata: { encontroUno: true, textos: ['Una sopa de lentejas', 'Llamar a mi hermana'] },
    });
    expect(enviado()).not.toHaveProperty('score');
    expect(await screen.findByText(/Quedó registrado/)).toBeInTheDocument();
  });

  it('«Hoy no me sale ninguna» tambien se registra, con su sesion', async () => {
    await guardarElPanel({ cuenta: CUENTA, progreso: panelDeLaNueva() });
    pintar(NUEVA);

    await usuario.click(await screen.findByRole('button', { name: 'Hoy no me sale ninguna' }));

    await waitFor(() => {
      expect(registrarResultado).toHaveBeenCalledTimes(1);
    });
    expect(enviado()).toMatchObject({
      activityId: NUEVA,
      idSesion: 's-10',
      metadata: { encontroUno: false },
    });
    expect(enviado()).not.toHaveProperty('score');
  });

  it('sin la sesion del panel, dice que hace falta y no ofrece escribir', async () => {
    pintar(NUEVA);

    expect(await screen.findByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('una senal de riesgo en lo escrito siempre ensena las lineas de atencion', async () => {
    // La deteccion es del servidor, que mira todo el texto: la pantalla ensena lo que el dice.
    registrarResultado.mockResolvedValue({
      id: 'r-2',
      activityId: NUEVA,
      sugiereAcompanamiento: true,
      lineasDeAtencion: [
        { id: 'l-192', titulo: 'Línea 192, opción 4', tipo: 'contacto', cobertura: 'nacional' },
      ],
      metadata: {},
      completedAt: '2026-10-17T15:00:00.000Z',
    });
    await guardarElPanel({ cuenta: CUENTA, progreso: panelDeLaNueva() });
    pintar(NUEVA);

    await usuario.type(await screen.findByRole('textbox', { name: 'Respuesta 2 de 3' }), 'nada');
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    const seccion = await screen.findByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    expect(within(seccion).getByText('Línea 192, opción 4')).toBeInTheDocument();
  });

  it('sin conexion, lo escrito queda en la cola con su sesion y sale al volver la red', async () => {
    hayConexionConLaApi.mockResolvedValue(false);
    await guardarElPanel({ cuenta: CUENTA, progreso: panelDeLaNueva() });
    pintar(NUEVA);

    await usuario.type(
      await screen.findByRole('textbox', { name: 'Respuesta 1 de 3' }),
      'Una sopa',
    );
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(await screen.findByText(/Guardado en este equipo/)).toBeInTheDocument();
    expect(registrarResultado).not.toHaveBeenCalled();

    const [operacion] = (await cicloActual()?.almacen.operaciones()) ?? [];

    expect(operacion?.payload).toMatchObject({
      activityId: NUEVA,
      idSesion: 's-10',
      metadata: { encontroUno: true, textos: ['Una sopa'] },
    });
  });

  it('lo escrito no sale por la consola, ni cuando falla el envio', async () => {
    const TEXTO = 'algo muy personal que nadie mas deberia leer';
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) =>
      vi.spyOn(console, metodo).mockImplementation(() => undefined),
    );

    registrarResultado.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await guardarElPanel({ cuenta: CUENTA, progreso: panelDeLaNueva() });
    pintar(NUEVA);

    await usuario.type(await screen.findByRole('textbox', { name: 'Respuesta 3 de 3' }), TEXTO);
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    // Falla el envio: queda guardado en este equipo (SCRUM-138) y, al volver la conexion, sale. Lo
    // escrito no puede salir por la consola en ninguno de los dos.
    await screen.findByText(/Guardado en este equipo/);
    await cicloActual()?.motor.sincronizar('conexion');
    await screen.findByText(/Quedó registrado/);

    // Sanity: el texto si llego a la peticion. Lo que no puede es salir por ningun otro lado.
    expect(registrarResultado.mock.calls[1]?.[0]).toMatchObject({
      metadata: { textos: [TEXTO] },
    });

    for (const espia of espias) {
      for (const argumentos of espia.mock.calls) {
        expect(argumentos.map((uno) => String(uno)).join(' ')).not.toContain('muy personal');
      }
    }
  });
});
