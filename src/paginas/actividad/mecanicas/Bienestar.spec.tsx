import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rutaDeActividad, RUTAS } from '../../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../../sesion/SesionContexto.ts';
import { Actividad } from '../Actividad.tsx';

/**
 * Las dos actividades de Bienestar que llegan con SCRUM-93, dentro del motor
 * de verdad y con la API simulada.
 */
const { buscarActividad, registrarResultado } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
}));

vi.mock('../../../infraestructura/api/catalogo.ts', () => ({ buscarActividad }));
vi.mock('../../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));

const CARGA = '0acd0000-0000-4000-8000-000000000005';
const MOVIMIENTO = '0acd0000-0000-4000-8000-000000000006';

const usuario = userEvent.setup({ delay: null });

function ficha(id: string, nombre: string, produceNivel: boolean) {
  return {
    actividad: { id, nombre, tipo: produceNivel ? 'preguntas' : 'bitacora', produceNivel },
    categoria: { id: 'cat-2', nombre: 'Bienestar', actividades: [] },
  };
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

/** Lo que la mecanica le entrego al motor en el envio numero `n`. */
function enviado(n = 0): Record<string, unknown> {
  return registrarResultado.mock.calls[n]?.[0] as Record<string, unknown>;
}

function terminar() {
  return usuario.click(screen.getByRole('button', { name: 'Terminar' }));
}

/**
 * Las preguntas del formulario de la actividad. Se buscan dentro del
 * formulario: el selector de tema de la barra tambien es un grupo.
 */
async function preguntas(): Promise<HTMLElement[]> {
  const formulario = (await screen.findByRole('button', { name: 'Terminar' })).closest('form');

  if (formulario === null) {
    throw new Error('La actividad no tiene formulario');
  }

  return within(formulario).getAllByRole('group');
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('La carga de tu semana', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(CARGA, 'La carga de tu semana', true));
  });

  /** Responde las cinco preguntas con la misma opcion. */
  async function responderTodo(opcion: string) {
    const grupos = await preguntas();

    for (const pregunta of grupos) {
      await usuario.click(within(pregunta).getByRole('radio', { name: opcion }));
    }
  }

  it('son cinco preguntas, cada una de Nada a Mucho', async () => {
    pintar(CARGA);

    const grupos = await preguntas();

    expect(grupos).toHaveLength(5);

    for (const pregunta of grupos) {
      expect(within(pregunta).getAllByRole('radio')).toHaveLength(5);
    }
  });

  it('una semana muy cargada manda el maximo, 20, con cada respuesta en la metadata', async () => {
    // El servidor la interpreta con mayor_requiere_atencion: lo que vuelve es
    // un nivel distinto de favorable.
    registrarResultado.mockResolvedValue({
      id: 'r-1',
      activityId: CARGA,
      nivelOrientativo: 'requiere_atencion',
      sugiereAcompanamiento: true,
      metadata: {},
      completedAt: '2026-10-03T15:00:00.000Z',
    });

    pintar(CARGA);
    await responderTodo('Mucho');
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({
      activityId: CARGA,
      score: 20,
      metadata: {
        respuestas: { pendientes: 4, horario: 4, tiempoPropio: 4, desconectar: 4, loQueViene: 4 },
      },
    });
    expect(await screen.findByText('Conviene prestarle atención estos días.')).toBeInTheDocument();
    expect(screen.getByText(/alguien de confianza/)).toBeInTheDocument();
  });

  it('una semana llevadera manda 0', async () => {
    registrarResultado.mockResolvedValue({
      id: 'r-2',
      activityId: CARGA,
      nivelOrientativo: 'favorable',
      sugiereAcompanamiento: false,
      metadata: {},
      completedAt: '2026-10-03T15:00:00.000Z',
    });

    pintar(CARGA);
    await responderTodo('Nada');
    await terminar();

    await waitFor(() => expect(enviado()).toMatchObject({ score: 0 }));
  });

  it('sin responder todo no envia, dice cuantas faltan y lleva a la primera', async () => {
    pintar(CARGA);

    const [primera, segunda] = await preguntas();

    if (primera === undefined || segunda === undefined) {
      throw new Error('Faltan las preguntas');
    }

    await usuario.click(within(primera).getByRole('radio', { name: 'Algo' }));
    await terminar();

    expect(registrarResultado).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Te faltan 4 preguntas');
    expect(within(segunda).getByRole('radio', { name: 'Nada' })).toHaveFocus();
  });

  it('se responde con teclado', async () => {
    pintar(CARGA);

    const [primera] = await preguntas();

    if (primera === undefined) {
      throw new Error('Faltan las preguntas');
    }

    within(primera).getByRole('radio', { name: 'Nada' }).focus();
    await usuario.keyboard(' ');

    expect(within(primera).getByRole('radio', { name: 'Nada' })).toBeChecked();
  });
});

describe('Movimiento del día', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(MOVIMIENTO, 'Movimiento del día', false));
    registrarResultado.mockResolvedValue({
      id: 'r-3',
      activityId: MOVIMIENTO,
      sugiereAcompanamiento: false,
      metadata: {},
      completedAt: '2026-10-03T15:00:00.000Z',
    });
  });

  it('registra el tipo y el tiempo, sin puntaje', async () => {
    pintar(MOVIMIENTO);

    await usuario.click(await screen.findByRole('radio', { name: 'Sí' }));
    // Se marcan en desorden: la metadata los guarda en el orden de la lista.
    await usuario.click(screen.getByRole('checkbox', { name: 'Baile' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Caminar' }));
    await usuario.click(screen.getByRole('radio', { name: 'De 15 a 30 minutos' }));
    await terminar();

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    // Mandar un puntaje en una actividad sin_puntaje seria un 400.
    expect(enviado()).not.toHaveProperty('score');
    expect(enviado().metadata).toEqual({
      seMovio: true,
      tipos: ['caminar', 'baile'],
      duracion: '15-a-30',
    });
    expect(await screen.findByText(/Quedó registrado/)).toBeInTheDocument();
  });

  it('"Hoy no" tambien se registra, sin pedir nada mas', async () => {
    pintar(MOVIMIENTO);

    await usuario.click(await screen.findByRole('radio', { name: 'Hoy no' }));

    expect(screen.getByText(/También cuenta/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await terminar();

    await waitFor(() => expect(enviado().metadata).toEqual({ seMovio: false }));
    expect(enviado()).not.toHaveProperty('score');
  });

  it('pide lo que falta antes de enviar', async () => {
    pintar(MOVIMIENTO);

    await screen.findByRole('radio', { name: 'Sí' });
    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent('Cuéntanos si te moviste hoy');

    await usuario.click(screen.getByRole('radio', { name: 'Sí' }));
    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent('al menos un tipo');

    await usuario.click(screen.getByRole('checkbox', { name: 'Caminar' }));
    await terminar();

    expect(screen.getByRole('alert')).toHaveTextContent('cuánto tiempo');
    expect(registrarResultado).not.toHaveBeenCalled();
  });

  it('las casillas se marcan con teclado', async () => {
    pintar(MOVIMIENTO);

    await usuario.click(await screen.findByRole('radio', { name: 'Sí' }));
    screen.getByRole('checkbox', { name: 'Estiramientos o yoga' }).focus();
    await usuario.keyboard(' ');

    expect(screen.getByRole('checkbox', { name: 'Estiramientos o yoga' })).toBeChecked();
  });
});
