import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contestarYSeguir, esperarAOtroPaso, responderTodo } from '../../../pruebas/pasos.ts';
import { rutaDeActividad, RUTAS } from '../../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../../sesion/SesionContexto.ts';
import { Actividad } from '../Actividad.tsx';
import {
  abrirUnAlmacenDePrueba,
  cerrarElAlmacenDePrueba,
} from '../../../pruebas/almacenDePrueba.ts';

/**
 * Las dos actividades de Bienestar que llegan con SCRUM-93, dentro del motor
 * de verdad y con la API simulada.
 */
// Recorrer un cuestionario entero son cinco pasos, cada uno con su animacion de salida y de
// entrada. Con todo el conjunto corriendo a la vez el limite de cinco segundos se quedaba corto.
vi.setConfig({ testTimeout: 20_000 });

const { buscarActividad, registrarResultado, hayConexionConLaApi } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
  hayConexionConLaApi: vi.fn(),
}));

// El catalogo sale de la copia local cuando no hay conexion (SCRUM-138); aqui es un doble.
vi.mock('../../../sincronizacion/catalogoLocal.ts', () => ({
  buscarActividadConCopia: buscarActividad,
  nombreDeLaActividad: vi.fn(() => Promise.resolve(null)),
}));
// Lo que se termina entra a la cola y la envia el motor de verdad: solo se simula la red.
vi.mock('../../../infraestructura/api/conexion.ts', () => ({ hayConexionConLaApi }));
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

function seguir() {
  return usuario.click(screen.getByRole('button', { name: 'Continuar' }));
}

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
  vi.clearAllMocks();
});

describe('La carga de tu semana', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(CARGA, 'La carga de tu semana', true));
  });

  it('son cinco preguntas, de una en una, cada una de Nada a Mucho', async () => {
    pintar(CARGA);

    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('Pregunta 1 de 5')).toBeInTheDocument();

    // Cada paso muestra una sola pregunta, con sus cinco opciones.
    for (let n = 1; n <= 5; n += 1) {
      const grupo = await screen.findByRole('radiogroup');

      expect(
        within(grupo)
          .getAllByRole('radio')
          .map((radio) => radio.closest('label')?.textContent),
      ).toEqual(['Nada', 'Poco', 'Algo', 'Bastante', 'Mucho']);

      if (n < 5) {
        await contestarYSeguir(usuario, 'Algo', 'Continuar');
      }
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
    await responderTodo(usuario, 'Mucho', 5);

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
    await responderTodo(usuario, 'Nada', 5);

    await waitFor(() => expect(enviado()).toMatchObject({ score: 0 }));
  });

  it('no avanza sin contestar: el boton espera y un texto dice por que', async () => {
    pintar(CARGA);

    const boton = await screen.findByRole('button', { name: 'Continuar' });

    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription('Elige una opción para continuar.');

    await usuario.click(screen.getByRole('radio', { name: 'Algo' }));

    // Elegir no avanza solo: la persona decide cuando seguir.
    expect(screen.getByText('Pregunta 1 de 5')).toBeInTheDocument();
    expect(boton).toBeEnabled();
    expect(registrarResultado).not.toHaveBeenCalled();
  });

  it('se puede volver atras y la respuesta sigue ahi', async () => {
    pintar(CARGA);

    await contestarYSeguir(usuario, 'Bastante', 'Continuar');
    expect(screen.getByText('Pregunta 2 de 5')).toBeInTheDocument();

    const antes = screen.getByRole('radiogroup').getAttribute('aria-labelledby');

    await usuario.click(screen.getByRole('button', { name: 'Atrás' }));
    await esperarAOtroPaso(antes);

    expect(screen.getByText('Pregunta 1 de 5')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Bastante' })).toBeChecked();
  });

  it('la mascota agradece sin valorar lo contestado: dice lo mismo con cualquier opcion', async () => {
    pintar(CARGA);
    await usuario.click(await screen.findByRole('radio', { name: 'Mucho' }));
    const conMucho = screen.getByText(/Anotado|Gracias|Lo tengo|Perfecto|Listo/).textContent;

    await usuario.click(screen.getByRole('radio', { name: 'Nada' }));

    expect(screen.getByText(/Anotado|Gracias|Lo tengo|Perfecto|Listo/).textContent).toBe(conMucho);
  });

  it('se responde con teclado', async () => {
    pintar(CARGA);

    (await screen.findByRole('radio', { name: 'Nada' })).focus();
    await usuario.keyboard(' ');

    expect(screen.getByRole('radio', { name: 'Nada' })).toBeChecked();
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
    await seguir();

    // Se marcan en desorden: la metadata los guarda en el orden de la lista.
    await usuario.click(await screen.findByRole('checkbox', { name: 'Baile' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Caminar' }));
    await seguir();

    await usuario.click(await screen.findByRole('radio', { name: 'De 15 a 30 minutos' }));
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
    // Es una actividad de un solo paso: no hay nada mas que preguntar.
    expect(screen.getByText('Paso 1 de 1')).toBeInTheDocument();

    await terminar();

    await waitFor(() => expect(enviado().metadata).toEqual({ seMovio: false }));
    expect(enviado()).not.toHaveProperty('score');
  });

  it('pide lo que falta antes de enviar', async () => {
    pintar(MOVIMIENTO);

    // En cada paso el boton espera, y un texto dice que falta.
    await screen.findByRole('radio', { name: 'Sí' });
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.getByText('Cuéntanos si te moviste hoy.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Sí' }));
    await seguir();

    await screen.findByRole('checkbox', { name: 'Caminar' });
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.getByText(/al menos un tipo/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('checkbox', { name: 'Caminar' }));
    await seguir();

    await screen.findByRole('radio', { name: 'De 15 a 30 minutos' });
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeDisabled();
    expect(screen.getByText(/cuánto tiempo/)).toBeInTheDocument();
    expect(registrarResultado).not.toHaveBeenCalled();
  });

  it('las casillas se marcan con teclado', async () => {
    pintar(MOVIMIENTO);

    await usuario.click(await screen.findByRole('radio', { name: 'Sí' }));
    await seguir();
    (await screen.findByRole('checkbox', { name: 'Estiramientos o yoga' })).focus();
    await usuario.keyboard(' ');

    expect(screen.getByRole('checkbox', { name: 'Estiramientos o yoga' })).toBeChecked();
  });
});
