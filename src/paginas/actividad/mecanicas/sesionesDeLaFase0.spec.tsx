import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';
import { contestarYSeguir } from '../../../pruebas/pasos.ts';
import { ComoTeSientesHoy } from './ComoTeSientesHoy.tsx';
import { EncuentraLaDiferencia } from './EncuentraLaDiferencia.tsx';
import { LaCargaDeTuSemana } from './LaCargaDeTuSemana.tsx';
import { SecuenciaDeNumeros } from './SecuenciaDeNumeros.tsx';
import { UnMomentoBueno } from './UnMomentoBueno.tsx';

/**
 * Las cinco pantallas de la Fase 0 leen lo que dice la sesion del dia (SCRUM-208, ADR 0030).
 *
 * Tres cosas, para cada una:
 *
 * 1. **Con la sesion de la Fase 0 se ve exactamente igual que sin sesion.** Es la promesa de la fase:
 *    pasar al modelo sin cambiar lo que se ve. Los parametros de aqui son los de la migracion del
 *    backend, tal cual.
 * 2. **Con otra sesion se ve lo de esa sesion.** Es lo que demuestra que de verdad la lee, y no que
 *    el respaldo siga mandando.
 * 3. **Con una sesion que no entiende, cae a lo de siempre**, sin romperse.
 */

vi.setConfig({ testTimeout: 20_000 });

function sesionDe(parametros: Record<string, unknown>): SesionDeLaActividad {
  return { id: 's-1', titulo: 'Una sesión', nivel: 1, parametros };
}

// --- Los parametros de la migracion de la Fase 0 -------------------------------------------------

const SECUENCIA_FASE_0 = {
  casillas: Array.from({ length: 10 }, (_, i) => ({ clave: String(i), nombre: String(i) })),
  largoInicial: 3,
  rondas: 12,
  msPorElemento: 700,
  msDeMargen: 1000,
};

const DIFERENCIA_FASE_0 = { rondas: 15, segundosPorRonda: 15, lados: [3, 4, 5] };

const CARGA_FASE_0 = {
  indicacion: 'Piensa en los últimos siete días. No hay respuestas buenas ni malas.',
  preguntas: [
    { clave: 'pendientes', texto: '¿Cuánto trabajo o estudio pendiente sientes que tienes?' },
    { clave: 'horario', texto: '¿Qué tan apretado ha estado tu horario?' },
    {
      clave: 'tiempoPropio',
      texto:
        '¿Cuánto te ha faltado tiempo para ti: descansar, tus aficiones, la gente que quieres?',
    },
    { clave: 'desconectar', texto: '¿Cuánto te ha costado desconectarte al terminar el día?' },
    { clave: 'loQueViene', texto: '¿Cuánto te pesa lo que viene en los próximos días?' },
  ],
  opciones: [
    { valor: 0, texto: 'Nada' },
    { valor: 1, texto: 'Poco' },
    { valor: 2, texto: 'Algo' },
    { valor: 3, texto: 'Bastante' },
    { valor: 4, texto: 'Mucho' },
  ],
};

const SIENTES_FASE_0 = {
  indicacion: 'Piensa solo en hoy. No hay respuestas buenas ni malas.',
  preguntas: [
    { clave: 'arrancar', texto: '¿Cuánto te costó arrancar el día?' },
    { clave: 'tension', texto: '¿Cuánta tensión has cargado hoy?' },
    { clave: 'disfrutar', texto: '¿Cuánto te costó disfrutar de lo que normalmente te gusta?' },
    {
      clave: 'vueltas',
      texto: '¿Cuánto te han dado vueltas pensamientos que no te dejan en paz?',
    },
    { clave: 'compania', texto: '¿Cuánto has echado en falta a alguien con quien hablar?' },
  ],
  opciones: [
    { valor: 0, texto: 'Nada' },
    { valor: 1, texto: 'Algo' },
    { valor: 2, texto: 'Mucho' },
  ],
};

const MOMENTO_FASE_0 = {
  invitacion: '¿Qué estuvo bien hoy?',
  ideas: [
    'Un café a buena hora',
    'Una conversación bonita',
    'Algo salió mejor de lo esperado',
    'Un rato de descanso',
    'Algo rico para comer',
  ],
  campos: 1,
  minimo: 1,
  largoMaximo: 500,
  permiteNingunaHoy: true,
};

// --- Lo que se ve --------------------------------------------------------------------------------

/** Lo que una persona percibe de la pantalla: sus textos y sus botones, sin ids de React. */
function lasVistas(contenedor: HTMLElement) {
  return {
    texto: (contenedor.textContent ?? '').replace(/\s+/g, ' ').trim(),
    botones: screen.queryAllByRole('button').map((boton) => boton.textContent ?? ''),
    radios: screen
      .queryAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent ?? ''),
  };
}

/** Pinta la pantalla, anota lo que se ve y la quita: para comparar dos pantallas entre si. */
function vista(pantalla: ReactElement) {
  const { container } = render(pantalla);
  const visto = lasVistas(container);

  cleanup();

  return visto;
}

let usuario: UserEvent;
const alTerminar = vi.fn();

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  usuario = userEvent.setup({ delay: null });
});

/** Los juegos tienen reloj; los cuestionarios animan con requestAnimationFrame y piden el reloj de verdad. */
function conRelojFalso() {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    usuario = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  alTerminar.mockClear();
});

function adelantar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

// =================================================================================================
// Los dos cuestionarios
// =================================================================================================

describe.each([
  ['La carga de tu semana', LaCargaDeTuSemana, CARGA_FASE_0, 20],
  ['Cómo te sientes hoy', ComoTeSientesHoy, SIENTES_FASE_0, 10],
])('%s', (_nombre, Pantalla, faseCero, maximoDeSiempre) => {
  it('con la sesion de la Fase 0 se ve igual que sin sesion', () => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesion = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(faseCero)} />,
    );

    expect(conSesion).toEqual(sinSesion);
    // Y de verdad hay algo que comparar.
    expect(conSesion.texto).toContain(faseCero.indicacion);
    expect(conSesion.texto).toContain(faseCero.preguntas[0]?.texto);
    expect(conSesion.radios.length).toBe(faseCero.opciones.length);
  });

  it('con otra sesion pinta su indicacion, sus preguntas y sus opciones', async () => {
    const otra = {
      indicacion: 'Una frase distinta para empezar.',
      preguntas: [
        { clave: 'uno', texto: '¿Primera pregunta de la sesión?' },
        { clave: 'dos', texto: '¿Segunda pregunta de la sesión?' },
        { clave: 'tres', texto: '¿Tercera pregunta de la sesión?' },
      ],
      opciones: [
        { valor: 0, texto: 'Ninguna' },
        { valor: 1, texto: 'Una' },
        { valor: 2, texto: 'Varias' },
        { valor: 3, texto: 'Todas' },
      ],
    };

    render(<Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(otra)} />);

    expect(screen.getByText('Una frase distinta para empezar.')).toBeInTheDocument();
    expect(screen.getByText('¿Primera pregunta de la sesión?')).toBeInTheDocument();
    expect(screen.queryByText(faseCero.indicacion)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('radiogroup'))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Ninguna', 'Una', 'Varias', 'Todas']);

    // El puntaje se calcula con la sesion: tres preguntas, la opcion de 3 en todas = 9, y el maximo
    // sale de ella (3 x 3), no de los 20 o los 10 de siempre.
    await contestarYSeguir(usuario, 'Todas', 'Continuar');
    await contestarYSeguir(usuario, 'Todas', 'Continuar');
    await contestarYSeguir(usuario, 'Todas', 'Terminar');

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toMatchObject({
      score: 9,
      metadata: { respuestas: { uno: 3, dos: 3, tres: 3 } },
    });
  });

  it('el puntaje de una sesion llega a su propio maximo, aunque pase del de siempre', async () => {
    // Cinco preguntas con una opcion de 5: 25 puntos, mas que los 20 de La carga y los 10 de Como te
    // sientes. El maximo sale de las preguntas y las opciones de la sesion, no de un numero fijo.
    const larga = {
      indicacion: 'Cinco preguntas.',
      preguntas: ['a', 'b', 'c', 'd', 'e'].map((clave) => ({
        clave,
        texto: `¿Pregunta ${clave}?`,
      })),
      opciones: [
        { valor: 0, texto: 'No' },
        { valor: 5, texto: 'Si' },
      ],
    };

    render(<Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(larga)} />);

    for (let n = 1; n < 5; n += 1) {
      await contestarYSeguir(usuario, 'Si', 'Continuar');
    }

    await contestarYSeguir(usuario, 'Si', 'Terminar');

    expect(alTerminar.mock.calls[0]?.[0]).toMatchObject({ score: 25 });
  });

  it('sin sesion el maximo es el de siempre', async () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} />);

    const opciones = faseCero.opciones;
    const mas = opciones.at(-1)?.texto ?? '';

    for (let n = 1; n < faseCero.preguntas.length; n += 1) {
      await contestarYSeguir(usuario, mas, 'Continuar');
    }

    await contestarYSeguir(usuario, mas, 'Terminar');

    expect(alTerminar.mock.calls[0]?.[0]).toMatchObject({ score: maximoDeSiempre });
  });

  it.each([
    ['sin la indicacion', { ...faseCero, indicacion: '' }],
    ['sin preguntas', { ...faseCero, preguntas: [] }],
    ['con una sola opcion', { ...faseCero, opciones: [{ valor: 0, texto: 'Nada' }] }],
    ['con parametros de otro motor', MOMENTO_FASE_0],
    ['con parametros vacios', {}],
  ])('una sesion %s cae a lo de siempre', (_caso, parametros) => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesionRara = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(parametros)} />,
    );

    expect(conSesionRara).toEqual(sinSesion);
  });
});

// =================================================================================================
// Secuencia de numeros
// =================================================================================================

describe('Secuencia de números', () => {
  const Pantalla = SecuenciaDeNumeros;

  conRelojFalso();

  it('con la sesion de la Fase 0 se ve igual que sin sesion', () => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesion = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(SECUENCIA_FASE_0)} />,
    );

    expect(conSesion).toEqual(sinSesion);
    // El catalogo dice doce, y se juegan siete (SCRUM-288).
    expect(conSesion.texto).toContain('Son 7 rondas');
  });

  it('con otra sesion dice sus rondas', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...SECUENCIA_FASE_0, rondas: 5 })}
      />,
    );

    expect(screen.getByText(/Son 5 rondas/)).toBeInTheDocument();
    expect(screen.queryByText(/Son 7 rondas/)).not.toBeInTheDocument();
  });

  it('con una sesion de mas de siete rondas, solo se juegan siete', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...SECUENCIA_FASE_0, rondas: 30 })}
      />,
    );

    expect(screen.getByText(/Son 7 rondas/)).toBeInTheDocument();
    expect(screen.queryByText(/Son 30 rondas/)).not.toBeInTheDocument();
  });

  it('empieza con el largo inicial de la sesion', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...SECUENCIA_FASE_0, largoInicial: 5 })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    // Con el azar fijo en cero, todos los digitos son 0.
    expect(screen.getByText('0 0 0 0 0')).toBeInTheDocument();
  });

  it('sin sesion empieza con tres digitos', async () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} />);

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    expect(screen.getByText('0 0 0')).toBeInTheDocument();
    expect(screen.queryByText('0 0 0 0')).not.toBeInTheDocument();
  });

  it('deja ver la secuencia el tiempo que dice la sesion: por digito, mas el margen', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...SECUENCIA_FASE_0, msPorElemento: 500, msDeMargen: 0 })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    // La barra que se vacia dura lo mismo que la secuencia a la vista: tres digitos a 500 ms, sin margen.
    expect(document.querySelector('.juego__tiempo span')).toHaveStyle({ '--duracion': '1500ms' });

    // Tres digitos a 500 ms, sin margen: 1.500 ms.
    adelantar(1200);
    expect(screen.queryByLabelText('Escribe la secuencia')).not.toBeInTheDocument();

    adelantar(600);
    expect(await screen.findByLabelText('Escribe la secuencia')).toBeInTheDocument();
  });

  it('sin sesion la deja ver tres digitos a 700 ms mas un segundo: 3.100 ms', async () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} />);

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    adelantar(1800);
    expect(screen.queryByLabelText('Escribe la secuencia')).not.toBeInTheDocument();

    adelantar(1500);
    expect(await screen.findByLabelText('Escribe la secuencia')).toBeInTheDocument();
  });

  /** Juega una ronda: espera a que se oculte y escribe `respuesta`. */
  async function jugarUnaRonda(respuesta: string, tiempoAlaVista: number) {
    adelantar(tiempoAlaVista + 100);
    await usuario.type(await screen.findByLabelText('Escribe la secuencia'), respuesta);
    await usuario.click(screen.getByRole('button', { name: /Comprobar/ }));
  }

  it('termina al llegar a las rondas de la sesion, con el puntaje de las acertadas', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...SECUENCIA_FASE_0, rondas: 2, msPorElemento: 200, msDeMargen: 0 })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    // Primera ronda: tres digitos (600 ms), acierta. Segunda: cuatro (800 ms), acierta.
    await jugarUnaRonda('000', 600);
    await usuario.click(screen.getByRole('button', { name: /Siguiente ronda/ }));
    await jugarUnaRonda('0000', 800);
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toMatchObject({
      score: 2,
      metadata: { aciertos: 2, largoMaximo: 4 },
    });
    expect(
      (alTerminar.mock.calls[0]?.[0] as { metadata: { rondas: unknown[] } }).metadata.rondas,
    ).toHaveLength(2);
  });

  it('al fallar no baja del largo inicial de la sesion', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({
          ...SECUENCIA_FASE_0,
          largoInicial: 5,
          msPorElemento: 200,
          msDeMargen: 0,
        })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));
    await jugarUnaRonda('9', 1000);
    await usuario.click(screen.getByRole('button', { name: /Siguiente ronda/ }));

    // Fallo con cinco digitos: la siguiente sigue en cinco, no baja a tres ni a cuatro.
    expect(screen.getByText('0 0 0 0 0')).toBeInTheDocument();
    expect(screen.queryByText('0 0 0 0 0 0')).not.toBeInTheDocument();
  });

  it.each([
    ['sin casillas', { ...SECUENCIA_FASE_0, casillas: [] }],
    ['con otro motor', DIFERENCIA_FASE_0],
    ['con parametros vacios', {}],
    ['con un tiempo que no es un numero', { ...SECUENCIA_FASE_0, msPorElemento: 'rapido' }],
  ])('una sesion %s cae a lo de siempre', (_caso, parametros) => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesionRara = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(parametros)} />,
    );

    expect(conSesionRara).toEqual(sinSesion);
    expect(conSesionRara.texto).toContain('Son 7 rondas');
  });
});

// =================================================================================================
// Encuentra la diferencia
// =================================================================================================

describe('Encuentra la diferencia', () => {
  const Pantalla = EncuentraLaDiferencia;

  conRelojFalso();

  it('con la sesion de la Fase 0 se ve igual que sin sesion', () => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesion = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(DIFERENCIA_FASE_0)} />,
    );

    expect(conSesion).toEqual(sinSesion);
    // El catalogo dice quince, y se juegan siete (SCRUM-288): ya no se reparten parejo entre los tres tamanos.
    expect(conSesion.texto).toContain(
      'Son 7 rondas de 15 segundos, y el tablero crece poco a poco.',
    );
  });

  it('con otra sesion dice sus rondas, sus segundos y cada cuantas crece el tablero', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ rondas: 6, segundosPorRonda: 10, lados: [3, 5] })}
      />,
    );

    expect(
      screen.getByText(/Son 6 rondas de 10 segundos, y el tablero crece cada tres\./),
    ).toBeInTheDocument();
  });

  it('con un solo lado no dice que el tablero crezca', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ rondas: 6, segundosPorRonda: 10, lados: [4] })}
      />,
    );

    expect(screen.getByText(/Son 6 rondas de 10 segundos\./)).toBeInTheDocument();
    expect(screen.queryByText(/crece/)).not.toBeInTheDocument();
  });

  it('con un tamano por ronda, dice que crece en cada ronda', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ rondas: 3, segundosPorRonda: 10, lados: [3, 4, 5] })}
      />,
    );

    expect(screen.getByText(/y el tablero crece en cada ronda./)).toBeInTheDocument();
  });

  it('si no se reparte parejo, dice que crece poco a poco', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ rondas: 7, segundosPorRonda: 10, lados: [3, 4, 5] })}
      />,
    );

    expect(screen.getByText(/y el tablero crece poco a poco\./)).toBeInTheDocument();
  });

  it('juega con los lados, los segundos y las rondas de la sesion, y termina al llegar a ellas', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ rondas: 4, segundosPorRonda: 10, lados: [4, 5] })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));
    expect(screen.getByText('Quedan 10 s')).toBeInTheDocument();
    expect(document.querySelector('.juego__tiempo span')).toHaveStyle({ '--duracion': '10s' });
    // La barra de arriba cuenta las rondas de la sesion, no las quince de siempre.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByText('Ronda 1 de 4')).toBeInTheDocument();

    for (let ronda = 1; ronda <= 4; ronda += 1) {
      const lado = ronda <= 2 ? 4 : 5;
      const ahora = await screen.findByRole('group', { name: 'Ahora' });
      const casillas = within(ahora).getAllByRole('button');

      expect(casillas, `ronda ${String(ronda)}`).toHaveLength(lado * lado);

      // Con el azar en cero, la que cambio es siempre la primera.
      await usuario.click(casillas[0]!);
      adelantar(1300);
    }

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toMatchObject({
      score: 4,
      metadata: { aciertos: 4, rondas: 4 },
    });
  });

  it('la ronda se acaba a los segundos de la sesion, y no a los quince de siempre', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ rondas: 3, segundosPorRonda: 4, lados: [3, 4, 5] })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    // A los tres segundos sigue la ronda; a los cinco ya se acabo el tiempo.
    adelantar(3000);
    expect(screen.queryByText(/Se acabó el tiempo/)).not.toBeInTheDocument();

    adelantar(2000);
    expect(await screen.findByText(/Se acabó el tiempo/)).toBeInTheDocument();
  });

  it('sin sesion la ronda dura quince segundos', async () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} />);

    await usuario.click(screen.getByRole('button', { name: /Empezar/ }));

    adelantar(10_000);
    expect(screen.queryByText(/Se acabó el tiempo/)).not.toBeInTheDocument();

    adelantar(6000);
    expect(await screen.findByText(/Se acabó el tiempo/)).toBeInTheDocument();
  });

  it.each([
    ['sin tiempo', { rondas: 15, segundosPorRonda: null, lados: [3, 4, 5] }],
    ['con otro motor', SECUENCIA_FASE_0],
    ['con parametros vacios', {}],
    ['con menos rondas que lados', { rondas: 2, segundosPorRonda: 15, lados: [3, 4, 5] }],
  ])('una sesion %s cae a lo de siempre', (_caso, parametros) => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesionRara = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(parametros)} />,
    );

    expect(conSesionRara).toEqual(sinSesion);
  });
});

// =================================================================================================
// Un momento bueno del dia
// =================================================================================================

describe('Un momento bueno del día', () => {
  const Pantalla = UnMomentoBueno;

  it('con la sesion de la Fase 0 se ve igual que sin sesion', () => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesion = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(MOMENTO_FASE_0)} />,
    );

    expect(conSesion).toEqual(sinSesion);
    expect(conSesion.texto).toContain('¿Qué estuvo bien hoy?');
    expect(conSesion.botones).toContain('Un café a buena hora');
    expect(conSesion.botones).toContain('Hoy no me sale ninguno');
  });

  it('el ejemplo gris del campo es el de siempre, con la pregunta de siempre', () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(MOMENTO_FASE_0)} />);

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Un café a buena hora, una conversación, algo que salió mejor de lo que esperabas…',
    );
  });

  it('con otra pregunta no hay ejemplo gris: contradiria lo que se pide', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...MOMENTO_FASE_0, invitacion: '¿Qué probaste hoy?' })}
      />,
    );

    expect(screen.getByRole('textbox')).not.toHaveAttribute('placeholder');
  });

  it('el largo maximo de siempre es 500', () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} />);

    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '500');
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
  });

  it('con otra sesion pinta su invitacion, sus ideas y su largo maximo', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({
          ...MOMENTO_FASE_0,
          invitacion: '¿Qué probaste hoy?',
          ideas: ['Una receta nueva', 'Un camino distinto'],
          largoMaximo: 200,
        })}
      />,
    );

    expect(screen.getByText('¿Qué probaste hoy?')).toBeInTheDocument();
    expect(screen.queryByText('¿Qué estuvo bien hoy?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Una receta nueva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Un camino distinto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Un café a buena hora' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '200');
    expect(screen.getByText('0 / 200')).toBeInTheDocument();
  });

  it('una idea que no cabe en el largo de la sesion se recorta', async () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({
          ...MOMENTO_FASE_0,
          ideas: ['a'.repeat(80)],
          largoMaximo: 50,
        })}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: 'a'.repeat(80) }));

    expect(screen.getByRole('textbox')).toHaveValue('a'.repeat(50));
  });

  it('sin permiso para «hoy no me sale ninguno», el boton no sale', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...MOMENTO_FASE_0, permiteNingunaHoy: false })}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Hoy no me sale ninguno' }),
    ).not.toBeInTheDocument();
  });

  it('sin ideas, no hay atajos', () => {
    render(
      <Pantalla
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDe({ ...MOMENTO_FASE_0, ideas: [] })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Un café a buena hora' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeInTheDocument();
    // Ni siquiera queda el contenedor vacio de los atajos, que dejaria un hueco en la pantalla.
    expect(document.querySelector('.viva-atajos')).toBeNull();
  });

  it('lo escrito se entrega igual que siempre: el texto y que encontro uno', async () => {
    render(<Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(MOMENTO_FASE_0)} />);

    await usuario.type(screen.getByRole('textbox'), 'Un buen café');
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledWith({
      metadata: { encontroUno: true, texto: 'Un buen café' },
    });
  });

  it.each([
    ['con varios campos', { ...MOMENTO_FASE_0, campos: 3 }],
    ['sin invitacion', { ...MOMENTO_FASE_0, invitacion: '' }],
    ['con otro motor', SECUENCIA_FASE_0],
    ['con parametros vacios', {}],
  ])('una sesion %s cae a lo de siempre', (_caso, parametros) => {
    const sinSesion = vista(<Pantalla alTerminar={alTerminar} enviando={false} />);
    const conSesionRara = vista(
      <Pantalla alTerminar={alTerminar} enviando={false} sesion={sesionDe(parametros)} />,
    );

    expect(conSesionRara).toEqual(sinSesion);
  });
});
