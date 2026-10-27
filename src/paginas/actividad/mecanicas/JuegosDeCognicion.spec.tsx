import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rutaDeActividad, RUTAS } from '../../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../../sesion/SesionContexto.ts';
import { Actividad } from '../Actividad.tsx';
import {
  abrirUnAlmacenDePrueba,
  cerrarElAlmacenDePrueba,
} from '../../../pruebas/almacenDePrueba.ts';
import { repartir, tiempoAlaVista } from './cognicion.ts';

/**
 * Los tres juegos de Cognicion, dentro del motor de verdad, con la API
 * simulada y el azar fijo.
 *
 * Con `Math.random` devolviendo siempre 0 el reparto es siempre el mismo: la
 * prueba sabe donde esta cada pareja, que digitos salen y que casilla cambia,
 * y puede jugar partidas perfectas y malas a proposito.
 */
// Cada partida entera pinta decenas de veces una pantalla con barra, mascota y fichas animadas.
// Sola tarda dos o tres segundos, y con todo el conjunto corriendo a la vez el limite de cinco se
// quedaba corto: es lo que cuesta jugar varias rondas, no un fallo.
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

beforeEach(async () => {
  hayConexionConLaApi.mockResolvedValue(true);
  await abrirUnAlmacenDePrueba();
});

afterEach(() => {
  cerrarElAlmacenDePrueba();
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

  it('acertar las siete rondas manda 12 sobre 12, y cada ronda alarga la siguiente', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    const largos: number[] = [];

    for (let ronda = 1; ronda <= 7; ronda++) {
      largos.push((await jugarRonda((secuencia) => secuencia)).length);
      expect(await screen.findByText('¡Bien! Era esa.')).toBeInTheDocument();
      await usuario.click(
        screen.getByRole('button', { name: ronda < 7 ? 'Siguiente ronda' : 'Terminar' }),
      );
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    // Se juegan siete (SCRUM-288) y el maximo sigue siendo el del catalogo: siete de siete vale doce.
    expect(largos).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(enviado()).toMatchObject({ score: 12, metadata: { aciertos: 7, largoMaximo: 9 } });
  });

  it('tres aciertos de siete valen tres septimos del maximo, no tres puntos', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    for (let ronda = 1; ronda <= 7; ronda++) {
      await jugarRonda((secuencia) => (ronda <= 3 ? secuencia : '9'));
      await screen.findByText(/^¡(Bien|Casi)! Era /);
      await usuario.click(
        screen.getByRole('button', { name: ronda < 7 ? 'Siguiente ronda' : 'Terminar' }),
      );
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(enviado()).toMatchObject({ score: 5.14, metadata: { aciertos: 3 } });
  });

  it('fallar todas manda 0, y la secuencia no baja de tres digitos', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    for (let ronda = 1; ronda <= 7; ronda++) {
      const secuencia = await jugarRonda(() => '9');

      expect(secuencia).toHaveLength(3);
      expect(await screen.findByText(/^¡Casi! Era /)).toBeInTheDocument();
      await usuario.click(
        screen.getByRole('button', { name: ronda < 7 ? 'Siguiente ronda' : 'Terminar' }),
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

    // Se juegan siete (SCRUM-288), y el maximo sigue siendo el del catalogo: siete de siete vale quince.
    for (let ronda = 1; ronda <= 7; ronda++) {
      const casillas = within(tableroAhora()).getAllByRole('button');

      lados.push(Math.sqrt(casillas.length));
      // La ronda empieza con el foco en el tablero, para jugar con teclado.
      expect(casillas[0]).toHaveFocus();

      await usuario.keyboard('{Enter}');
      expect(screen.getByText('¡Encontrada!')).toBeInTheDocument();
      adelantar(1_200);
    }

    await waitFor(() => expect(registrarResultado).toHaveBeenCalledTimes(1));

    expect(lados).toEqual([3, 3, 3, 4, 4, 5, 5]);
    expect(enviado()).toMatchObject({
      score: 15,
      metadata: { aciertos: 7, fallos: 0, sinTiempo: 0, rondas: 7 },
    });
  });

  it('una casilla equivocada o el tiempo agotado no suman', async () => {
    await empezar();

    for (let ronda = 1; ronda <= 7; ronda++) {
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
      metadata: { aciertos: 0, fallos: 4, sinTiempo: 3 },
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

/**
 * Lo nuevo de SCRUM-173: los juegos con barra de avance, mascota que acompana y fichas de
 * colores. Se prueba lo que le promete a quien juega, no como esta pintado.
 */
describe('Parejas de cartas, lo que se ve', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(PAREJAS, 'Parejas de cartas'));
  });

  async function cartas(): Promise<HTMLElement[]> {
    return within(await screen.findByRole('group', { name: 'Cartas' })).getAllByRole('button');
  }

  const globo = () => document.querySelector('.viva-voz__globo');

  it('empieza diciendo que hacer, con la barra en cero de seis', async () => {
    pintar(PAREJAS);

    expect(await screen.findByText('Toca una carta para empezar. Sin prisa.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '6');
    expect(screen.getByText('Parejas 0 de 6')).toBeInTheDocument();
  });

  it('con una carta a la vista dice que busque su pareja', async () => {
    pintar(PAREJAS);

    await usuario.click((await cartas())[0]!);

    expect(screen.getByText('Ahora busca su pareja.')).toBeInTheDocument();
  });

  it('un fallo se acompana con un «casi» y nunca se pinta de error', async () => {
    pintar(PAREJAS);

    const todas = await cartas();
    const reparto = repartir();
    const distinta = reparto.findIndex((carta) => carta.simbolo !== reparto[0]?.simbolo);

    await usuario.click(todas[0]!);
    await usuario.click(todas[distinta]!);

    expect(globo()).toHaveAttribute('data-resultado', 'casi');
    expect(globo()?.textContent).not.toMatch(/mal|error|fallaste|equivoc/i);
  });

  it('una pareja se celebra, sube la barra y queda marcada', async () => {
    pintar(PAREJAS);

    const todas = await cartas();
    const reparto = repartir();
    const gemela = reparto.findIndex(
      (carta, indice) => indice > 0 && carta.simbolo === reparto[0]?.simbolo,
    );

    await usuario.click(todas[0]!);
    await usuario.click(todas[gemela]!);

    expect(globo()).toHaveAttribute('data-resultado', 'acierto');
    expect(screen.getByText(/^Pareja de /)).toBeInTheDocument();
    expect(screen.getByText('Parejas 1 de 6')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect((await cartas())[0]).toHaveAccessibleName(/pareja encontrada/);
  });

  it('lo que dice la mascota no se anuncia: ya llega por el aviso de los lectores', async () => {
    pintar(PAREJAS);
    await cartas();

    expect(globo()).not.toHaveAttribute('aria-live');
    expect(document.querySelector('.solo-lectores[aria-live="polite"]')).not.toBeNull();
  });

  it('las caras de las cartas son adorno: cada boton dice su estado con su nombre', async () => {
    pintar(PAREJAS);

    const todas = await cartas();

    expect(todas).toHaveLength(12);
    expect(todas[0]).toHaveAccessibleName('Carta 1, boca abajo');
    expect(document.querySelector('.juego__carta-giro')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Secuencia de números, lo que se ve', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(SECUENCIA, 'Secuencia de números'));
  });

  it('antes de empezar explica en tres pasos y el boton es el de siempre', async () => {
    pintar(SECUENCIA);

    expect(await screen.findByText('Mira los números.')).toBeInTheDocument();
    expect(screen.getByText('Se ocultan en unos segundos.')).toBeInTheDocument();
    expect(screen.getByText('Escríbelos en orden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
  });

  it('al jugar, la barra lleva las rondas y las fichas son adorno con el texto aparte', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '7');
    expect(screen.getByText('Ronda 1 de 7')).toBeInTheDocument();
    expect(screen.getByText('Memoriza con calma.')).toBeInTheDocument();

    // Las fichas son adorno; lo que leen los lectores es el texto de la secuencia.
    const fichas = document.querySelector('.juego__digitos');

    expect(fichas).toHaveAttribute('aria-hidden', 'true');
    expect(fichas?.querySelectorAll('.juego__digito')).toHaveLength(3);
    expect(await screen.findByText(/^\d( \d)*$/)).toHaveClass('solo-lectores');
  });

  it('al escribir, los huecos se van llenando', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    const secuencia = (await screen.findByText(/^\d( \d)*$/)).textContent ?? '';

    adelantar(tiempoAlaVista(secuencia.replace(/ /g, '').length));

    const campo = await screen.findByLabelText('Escribe la secuencia');

    expect(document.querySelectorAll('.juego__digito--hueco')).toHaveLength(3);

    await usuario.type(campo, '12');

    expect(document.querySelectorAll('.juego__digito--lleno')).toHaveLength(2);
    expect(document.querySelectorAll('.juego__digito--hueco')).toHaveLength(1);
  });

  it('tras la ronda, la mascota dice lo suyo en el globo, que es la zona que se anuncia', async () => {
    pintar(SECUENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));

    const secuencia = (await screen.findByText(/^\d( \d)*$/)).textContent?.replace(/ /g, '') ?? '';

    adelantar(tiempoAlaVista(secuencia.length));
    await usuario.type(await screen.findByLabelText('Escribe la secuencia'), `${secuencia}{Enter}`);

    const globo = document.querySelector('.viva-voz__globo');

    expect(await screen.findByText('¡Bien! Era esa.')).toBeInTheDocument();
    expect(globo).toHaveAttribute('aria-live', 'polite');
    expect(globo).toHaveAttribute('data-resultado', 'acierto');
    expect(screen.getByText('Ronda 1 de 7')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
});

describe('Encuentra la diferencia, lo que se ve', () => {
  beforeEach(() => {
    buscarActividad.mockResolvedValue(ficha(DIFERENCIA, 'Encuentra la diferencia'));
  });

  async function empezar() {
    pintar(DIFERENCIA);

    await usuario.click(await screen.findByRole('button', { name: 'Empezar' }));
  }

  it('antes de empezar explica en tres pasos', async () => {
    pintar(DIFERENCIA);

    expect(await screen.findByText('Mira el tablero «Antes».')).toBeInTheDocument();
    expect(screen.getByText('En «Ahora» cambió una casilla.')).toBeInTheDocument();
    expect(screen.getByText('Tócala antes de que se acabe el tiempo.')).toBeInTheDocument();
  });

  it('muestra las rondas, el tiempo que queda y una barra que se vacia', async () => {
    await empezar();

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '7');
    expect(screen.getByText('Ronda 1 de 7')).toBeInTheDocument();
    expect(screen.getByText('Quedan 15 s')).toBeInTheDocument();
    expect(document.querySelector('.juego__tiempo')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Busca la casilla que cambió.')).toBeInTheDocument();
  });

  it('cada simbolo tiene su color, y el tablero dice su nombre casilla a casilla', async () => {
    await empezar();

    const casilla = within(screen.getByRole('group', { name: 'Ahora' })).getAllByRole('button')[0];

    expect(casilla).toHaveAccessibleName(/^Casilla 1: /);
    expect(casilla?.getAttribute('style')).toMatch(/--simbolo/);
  });

  it('el «casi» marca la tocada en ambar, no en rojo, y muestra la que cambio', async () => {
    await empezar();

    const botones = within(screen.getByRole('group', { name: 'Ahora' })).getAllByRole('button');

    // Con el azar fijo, la que cambio es la primera.
    await usuario.click(botones[1]!);

    const globo = document.querySelector('.viva-voz__globo');

    expect(screen.getByText(/Esa no era/)).toBeInTheDocument();
    expect(globo).toHaveAttribute('data-resultado', 'casi');
    expect(document.querySelector('.juego__casilla--cambio')).not.toBeNull();
    expect(document.querySelector('.juego__casilla--equivocada')).not.toBeNull();
  });
});
