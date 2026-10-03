import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rutaDeActividad, RUTAS } from '../../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../../sesion/SesionContexto.ts';
import { Actividad } from '../Actividad.tsx';
import { repartir, tiempoAlaVista } from './cognicion.ts';

/**
 * Los tres juegos de Cognicion, dentro del motor de verdad, con la API
 * simulada y el azar fijo.
 *
 * Con `Math.random` devolviendo siempre 0 el reparto es siempre el mismo: la
 * prueba sabe donde esta cada pareja, que digitos salen y que casilla cambia,
 * y puede jugar partidas perfectas y malas a proposito.
 */
const { buscarActividad, registrarResultado } = vi.hoisted(() => ({
  buscarActividad: vi.fn(),
  registrarResultado: vi.fn(),
}));

vi.mock('../../../infraestructura/api/catalogo.ts', () => ({ buscarActividad }));
vi.mock('../../../infraestructura/api/resultados.ts', () => ({ registrarResultado }));

const PAREJAS = '0acd0000-0000-4000-8000-000000000001';
const SECUENCIA = '0acd0000-0000-4000-8000-000000000002';
const DIFERENCIA = '0acd0000-0000-4000-8000-000000000003';

function ficha(id: string, nombre: string) {
  return {
    actividad: { id, nombre, tipo: 'juego', produceNivel: true },
    categoria: { id: 'cat-1', nombre: 'Cognición', actividades: [] },
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
  return render(
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

function adelantar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(Math, 'random').mockReturnValue(0);
  usuario = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
  registrarResultado.mockResolvedValue({
    id: 'r-1',
    activityId: PAREJAS,
    nivelOrientativo: 'favorable',
    sugiereAcompanamiento: false,
    metadata: {},
    completedAt: '2026-10-03T15:00:00.000Z',
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Parejas de cartas', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(PAREJAS, 'Parejas de cartas'));
  });

  /** Las cartas, en el orden de la mesa. */
  async function cartas(): Promise<HTMLElement[]> {
    return within(await screen.findByRole('group', { name: 'Cartas' })).getAllByRole('button');
  }

  /** Los indices de cada pareja, sabiendo el reparto. */
  function parejas(): [number, number][] {
    const reparto = repartir();
    const porSimbolo = new Map<number, number[]>();

    reparto.forEach((carta, indice) => {
      porSimbolo.set(carta.simbolo, [...(porSimbolo.get(carta.simbolo) ?? []), indice]);
    });

    return [...porSimbolo.values()].map(([a, b]) => [a ?? 0, b ?? 0]);
  }

  async function voltear(indice: number) {
    const carta = (await cartas())[indice];

    if (carta === undefined) {
      throw new Error(`No hay carta ${indice}`);
    }

    await usuario.click(carta);
  }

  it('una partida perfecta manda 20 sobre 20, con sus intentos', async () => {
    pintar(PAREJAS);

    for (const [a, b] of parejas()) {
      await voltear(a);
      await voltear(b);
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({
      activityId: PAREJAS,
      score: 20,
      metadata: { intentos: 6, parejas: 6 },
    });
  });

  it('cada fallo baja el puntaje', async () => {
    pintar(PAREJAS);

    const todas = parejas();
    const [primera, segunda] = todas;

    if (primera === undefined || segunda === undefined) {
      throw new Error('Faltan parejas');
    }

    // Dos que no coinciden: se ven un momento y vuelven boca abajo.
    await voltear(primera[0]);
    await voltear(segunda[0]);

    expect(await screen.findByText(/No coinciden/)).toBeInTheDocument();

    adelantar(900);

    for (const [a, b] of todas) {
      await voltear(a);
      await voltear(b);
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    // 7 intentos: 20 × 6 / 7 = 17.
    expect(enviado()).toMatchObject({ score: 17, metadata: { intentos: 7 } });
  });

  it('se juega con teclado', async () => {
    pintar(PAREJAS);

    const [primera] = await cartas();

    primera?.focus();
    await usuario.keyboard('{Enter}');

    expect((await cartas())[0]).toHaveAccessibleName(/^Carta 1: /);
  });

  it('salir a mitad no registra nada', async () => {
    const { unmount } = pintar(PAREJAS);
    const [primera] = parejas();

    if (primera === undefined) {
      throw new Error('Faltan parejas');
    }

    await voltear(primera[0]);
    await voltear(primera[1]);
    unmount();
    adelantar(5_000);

    expect(registrarResultado).not.toHaveBeenCalled();
  });
});

describe('Secuencia de números', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(SECUENCIA, 'Secuencia de números'));
  });

  /** Una ronda entera: mirar, esperar a que se oculte y responder. */
  async function jugarRonda(respuesta: (secuencia: string) => string) {
    const secuencia = (await screen.findByText(/^\d( \d)*$/)).textContent?.replace(/ /g, '') ?? '';

    adelantar(tiempoAlaVista(secuencia.length));

    const campo = await screen.findByLabelText('Escribe la secuencia');

    expect(campo).toHaveFocus();

    await usuario.type(campo, `${respuesta(secuencia)}{Enter}`);

    return secuencia;
  }

  it('acertar las doce rondas manda 12 sobre 12, y cada ronda alarga la siguiente', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    const largos: number[] = [];

    for (let ronda = 1; ronda <= 12; ronda++) {
      largos.push((await jugarRonda((secuencia) => secuencia)).length);
      expect(await screen.findByText('¡Bien! Era esa.')).toBeInTheDocument();
      await usuario.click(
        screen.getByRole('button', { name: ronda < 12 ? 'Siguiente ronda' : 'Terminar' }),
      );
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(largos).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(enviado()).toMatchObject({ score: 12, metadata: { aciertos: 12, largoMaximo: 14 } });
  });

  it('fallar todas manda 0, y la secuencia no baja de tres digitos', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    for (let ronda = 1; ronda <= 12; ronda++) {
      const secuencia = await jugarRonda(() => '9');

      expect(secuencia).toHaveLength(3);
      expect(await screen.findByText(/^Era /)).toBeInTheDocument();
      await usuario.click(
        screen.getByRole('button', { name: ronda < 12 ? 'Siguiente ronda' : 'Terminar' }),
      );
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({ score: 0, metadata: { aciertos: 0, largoMaximo: 0 } });
  });

  it('salir a mitad no registra nada', async () => {
    const { unmount } = pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));
    await jugarRonda((secuencia) => secuencia);
    unmount();
    adelantar(10_000);

    expect(registrarResultado).not.toHaveBeenCalled();
  });
});

describe('Encuentra la diferencia', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(DIFERENCIA, 'Encuentra la diferencia'));
  });

  /**
   * Con el azar en 0, el tablero "antes" es todo hojas y cambia la primera
   * casilla, que pasa a corazon.
   */
  function tableroAhora(): HTMLElement {
    return screen.getByRole('group', { name: 'Ahora' });
  }

  async function empezar() {
    const pantalla = pintar(DIFERENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    return pantalla;
  }

  it('encontrarlas todas manda 15 sobre 15, y el tablero crece', async () => {
    await empezar();

    const lados: number[] = [];

    for (let ronda = 1; ronda <= 15; ronda++) {
      const casillas = within(tableroAhora()).getAllByRole('button');

      lados.push(Math.sqrt(casillas.length));
      // La ronda empieza con el foco en el tablero, para jugar con teclado.
      expect(casillas[0]).toHaveFocus();

      await usuario.keyboard('{Enter}');
      expect(screen.getByText('¡Encontrada!')).toBeInTheDocument();
      adelantar(1_200);
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(lados).toEqual([3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5]);
    expect(enviado()).toMatchObject({
      score: 15,
      metadata: { aciertos: 15, fallos: 0, sinTiempo: 0, rondas: 15 },
    });
  });

  it('una casilla equivocada o el tiempo agotado no suman', async () => {
    await empezar();

    for (let ronda = 1; ronda <= 15; ronda++) {
      if (ronda % 2 === 0) {
        // Se deja pasar el tiempo.
        adelantar(15_000);
        expect(await screen.findByText(/Se acabó el tiempo/)).toBeInTheDocument();
      } else {
        await usuario.click(within(tableroAhora()).getByRole('button', { name: /^Casilla 2:/ }));
        expect(screen.getByText(/Esa no era/)).toBeInTheDocument();
      }

      adelantar(1_200);
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({
      score: 0,
      metadata: { aciertos: 0, fallos: 8, sinTiempo: 7 },
    });
  });

  it('salir a mitad no registra nada', async () => {
    const { unmount } = await empezar();

    await usuario.click(within(tableroAhora()).getByRole('button', { name: /^Casilla 1:/ }));
    unmount();
    adelantar(60_000);

    expect(registrarResultado).not.toHaveBeenCalled();
  });
});
