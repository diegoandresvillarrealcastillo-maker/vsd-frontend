import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
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
