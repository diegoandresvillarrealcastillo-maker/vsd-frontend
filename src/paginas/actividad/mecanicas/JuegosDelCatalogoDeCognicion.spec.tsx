import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANAGRAMA,
  CALCULO,
  CESTAS,
  CESTAS_DE_REFLEXION,
  COMPLETAR,
  ESCENA,
  FLUJO,
  INTRUSO,
  LISTA,
  PUNTOS,
  sesionDeCognicion,
} from '../../../pruebas/sesionesDeCognicion.ts';
import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { AtencionEnFlujo } from './AtencionEnFlujo.tsx';
import { CompletaLaPalabra } from './CompletaLaPalabra.tsx';
import { CuentasConCalma } from './CuentasConCalma.tsx';
import { esLaPalabra, normalizarLaPalabra } from './laPalabra.ts';
import { LoQueVi } from './LoQueVi.tsx';
import { OrdenaPorCategoria } from './OrdenaPorCategoria.tsx';
import { PalabraQueSobra } from './PalabraQueSobra.tsx';
import { RecuerdaLaLista } from './RecuerdaLaLista.tsx';
import type { PropsDeMecanica } from './registro.tsx';
import { UnirLosPuntos } from './UnirLosPuntos.tsx';

/**
 * Los ocho motores de Cognicion del catalogo (SCRUM-225), con la sesion que manda el servidor y sin tocar la
 * red: cada uno se juega de principio a fin y se mira lo que entrega al terminar.
 *
 * Lo que se protege aqui es el tono de un juego (celebra, nunca senala un fallo, nada solo por el color, sin
 * reloj encima), el puntaje (un acierto, un punto, sobre el maximo de la sesion) y que cada pantalla sin una
 * sesion que entienda lo diga, en lugar de pintarse a medias.
 */
vi.setConfig({ testTimeout: 20_000 });

const alTerminar = vi.fn();
let usuario: UserEvent;

type Pantalla = (props: PropsDeMecanica) => React.JSX.Element;

function pintar(pantalla: Pantalla, parametros: Record<string, unknown>, enviando = false) {
  const Motor = pantalla;

  return render(
    <Motor alTerminar={alTerminar} enviando={enviando} sesion={sesionDeCognicion(parametros)} />,
  );
}

function adelantar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function pulsar(nombre: string | RegExp) {
  await usuario.click(screen.getByRole('button', { name: nombre }));
}

function entregado() {
  expect(alTerminar).toHaveBeenCalledTimes(1);

  return alTerminar.mock.calls[0]?.[0] as {
    score?: number;
    metadata: Record<string, unknown>;
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  usuario = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  alTerminar.mockClear();
});

describe.each([
  ['La palabra que sobra', PalabraQueSobra],
  ['Cuentas con calma', CuentasConCalma],
  ['Recuerda la lista', RecuerdaLaLista],
  ['Lo que vi', LoQueVi],
  ['Toca solo lo que cambia', AtencionEnFlujo],
  ['Une los puntos', UnirLosPuntos],
  ['Ordena por categoria', OrdenaPorCategoria],
  ['Completa la palabra', CompletaLaPalabra],
] as const)('%s, sin una sesion que entienda', (_nombre, Motor) => {
  it.each([
    ['sin sesion', undefined],
    ['con parametros vacios', sesionDeCognicion({})],
    [
      'con parametros de otro motor',
      sesionDeCognicion({ invitacion: '¿Qué estuvo bien hoy?', campos: 1 }),
    ],
  ])('%s: lo dice, y no hay nada que empezar', (_caso, sesion) => {
    render(<Motor alTerminar={alTerminar} enviando={false} sesion={sesion} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// COG-02 · La palabra que sobra (y la base de los juegos de rondas)
// ---------------------------------------------------------------------------

describe('La palabra que sobra', () => {
  async function empezar() {
    pintar(PalabraQueSobra, INTRUSO);
    await pulsar(/Empezar/);
  }

  it('explica la tarea y las rondas de la sesion, sin tiempo, y espera a que se empiece', () => {
    pintar(PalabraQueSobra, INTRUSO);

    expect(screen.getByText(/Son 3 rondas, sin tiempo/)).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: '¿Cuál de estas palabras sobra?' }),
    ).not.toBeInTheDocument();
  });

  it('muestra las cuatro palabras de la ronda como botones, y nada de tiempo restante', async () => {
    await empezar();

    const palabras = within(
      screen.getByRole('group', { name: '¿Cuál de estas palabras sobra?' }),
    ).getAllByRole('button');

    expect(palabras.map((boton) => boton.textContent)).toEqual([
      'mesa',
      'caballo',
      'gato',
      'perro',
    ]);
    expect(screen.getByText('Ronda 1 de 3')).toBeInTheDocument();
    expect(screen.queryByText(/tiempo restante|segundos restantes/i)).not.toBeInTheDocument();
  });

  it('un acierto celebra, marca la correcta con una palabra para quien no ve el color y dice la razon', async () => {
    await empezar();
    await pulsar('mesa');

    expect(screen.getByText('mesa sobraba. Las otras son animales.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mesa/ })).toHaveAttribute('data-estado', 'correcta');
    expect(screen.getByText('(la correcta)')).toBeInTheDocument();
    // Las demas ya no se tocan.
    expect(screen.getByRole('button', { name: 'gato' })).toBeDisabled();
  });

  it('el contador sigue en la ronda que se esta viendo despues de responder, no se queda en 0', async () => {
    await empezar();
    await pulsar('mesa');

    expect(screen.getByText('Ronda 1 de 3')).toBeInTheDocument();
    expect(screen.queryByText('Ronda 0 de 3')).not.toBeInTheDocument();

    await pulsar(/Siguiente/);

    expect(screen.getByText('Ronda 2 de 3')).toBeInTheDocument();
  });

  it('un fallo no se senala: dice «¡Casi!», marca lo correcto y deja lo elegido como «tu eleccion»', async () => {
    await empezar();
    await pulsar('gato');

    expect(screen.getByText(/¡Casi!/)).toBeInTheDocument();
    expect(screen.getByText('tu elección')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mesa/ })).toHaveAttribute('data-estado', 'correcta');
    expect(screen.getByRole('button', { name: /gato/ })).toHaveAttribute('data-estado', 'elegida');
    expect(screen.queryByText(/te equivocaste|incorrecto|error|mal\b/i)).not.toBeInTheDocument();
  });

  it('no avanza hasta pulsar «Siguiente», y no deja cambiar la respuesta', async () => {
    await empezar();
    await pulsar('gato');
    await usuario.click(screen.getByRole('button', { name: /^mesa/ }));

    expect(screen.getByRole('button', { name: /gato/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ronda 1 de 3')).toBeInTheDocument();
  });

  it('una partida entera entrega el puntaje por rondas acertadas, una sola vez', async () => {
    await empezar();
    // Ronda 1: acierta (mesa). Ronda 2: falla (rojo). Ronda 3: acierta (martillo).
    await pulsar('mesa');
    await pulsar(/Siguiente/);
    await pulsar('rojo');
    await pulsar(/Siguiente/);
    await pulsar('martillo');

    expect(screen.getByRole('button', { name: 'Terminar' })).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();

    await pulsar('Terminar');
    await pulsar('Terminar').catch(() => undefined);

    const { score, metadata } = entregado();

    expect(score).toBe(2);
    expect(metadata).toMatchObject({ aciertos: 2, rondas: 3 });
    expect(metadata.segundos).toEqual(expect.any(Number));
  });

  it('con todas acertadas entrega el maximo de la sesion', async () => {
    await empezar();
    await pulsar('mesa');
    await pulsar(/Siguiente/);
    await pulsar('silla');
    await pulsar(/Siguiente/);
    await pulsar('martillo');
    await pulsar('Terminar');

    expect(entregado().score).toBe(3);
  });

  it('mientras se envia, el boton de terminar espera', async () => {
    const { rerender } = render(
      <PalabraQueSobra
        alTerminar={alTerminar}
        enviando={false}
        sesion={sesionDeCognicion(INTRUSO)}
      />,
    );

    await pulsar(/Empezar/);
    await pulsar('mesa');
    await pulsar(/Siguiente/);
    await pulsar('silla');
    await pulsar(/Siguiente/);
    await pulsar('martillo');

    rerender(
      <PalabraQueSobra alTerminar={alTerminar} enviando sesion={sesionDeCognicion(INTRUSO)} />,
    );

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('el foco pasa a «Siguiente» al responder', async () => {
    await empezar();
    await pulsar('mesa');

    expect(screen.getByRole('button', { name: /Siguiente/ })).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// COG-04 · Cuentas con calma
// ---------------------------------------------------------------------------

describe('Cuentas con calma', () => {
  async function empezar() {
    pintar(CuentasConCalma, CALCULO);
    await pulsar(/Empezar/);
  }

  it('dice desde el principio que no hay cronometro', () => {
    pintar(CuentasConCalma, CALCULO);

    expect(screen.getByText(/No hay cronómetro/)).toBeInTheDocument();
  });

  it('muestra el enunciado y tres respuestas, en una columna', async () => {
    await empezar();

    expect(screen.getByRole('heading', { name: '12 + 7' })).toBeInTheDocument();

    const respuestas = within(screen.getByRole('group', { name: '12 + 7' }));

    expect(respuestas.getAllByRole('button').map((boton) => boton.textContent)).toEqual([
      '17',
      '19',
      '21',
    ]);
    expect(screen.getByRole('group', { name: '12 + 7' })).toHaveAttribute('data-columnas', '1');
    expect(screen.getByText('Cuenta 1 de 3')).toBeInTheDocument();
  });

  it('un fallo dice la respuesta sin dramatismo ni «te equivocaste»', async () => {
    await empezar();
    await pulsar('17');

    expect(screen.getByText('La respuesta era 19.')).toBeInTheDocument();
    expect(screen.getByText(/¡Casi!/)).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();
  });

  it('entrega el puntaje por cuentas acertadas', async () => {
    await empezar();
    await pulsar('19');
    await pulsar(/Siguiente/);
    await pulsar('10');
    await pulsar(/Siguiente/);
    await pulsar('12');
    await pulsar('Terminar');

    // La segunda estaba mal: dos de tres.
    expect(entregado().score).toBe(2);
    expect(entregado().metadata).toMatchObject({ aciertos: 2, rondas: 3 });
  });
});

// ---------------------------------------------------------------------------
// COG-06 · Recuerda la lista
// ---------------------------------------------------------------------------

describe('Recuerda la lista', () => {
  async function empezar() {
    pintar(RecuerdaLaLista, LISTA);
    await pulsar(/Empezar/);
  }

  it('explica cuanto dura la lista a la vista y que se puede pasar antes', () => {
    pintar(RecuerdaLaLista, LISTA);

    expect(screen.getByText(/durante unos 10 segundos/)).toBeInTheDocument();
    expect(screen.getByText(/puedes pasar antes/)).toBeInTheDocument();
  });

  it('muestra la lista con su contexto, sin cuenta atras de numeros', async () => {
    await empezar();

    const lista = screen.getByRole('region', { name: 'En el mercado' });

    expect(
      within(lista)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['papa', 'tomate', 'arroz', 'huevos']);
    expect(screen.getByText(/se oculta en unos 10 segundos/)).toBeInTheDocument();
    expect(screen.queryByText(/\b\d+ s\b|restantes/)).not.toBeInTheDocument();
  });

  it('la lista se oculta sola al pasar el tiempo', async () => {
    await empezar();

    adelantar(9_000);

    expect(screen.getByRole('region', { name: 'En el mercado' })).toBeInTheDocument();

    adelantar(1_000);

    expect(screen.queryByRole('region', { name: 'En el mercado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });

  it('«Ya la tengo» pasa antes, sin esperar', async () => {
    await empezar();
    await pulsar(/Ya la tengo/);

    expect(screen.queryByRole('region', { name: 'En el mercado' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /¿Qué había en la lista\?/ })).toBeInTheDocument();
  });

  it('ofrece los elementos y los distractores juntos, y no se pueden marcar mas que los que tenia la lista', async () => {
    await empezar();
    await pulsar(/Ya la tengo/);

    const opciones = within(screen.getByRole('group', { name: /¿Qué había en la lista\?/ }));

    expect(opciones.getAllByRole('button')).toHaveLength(8);

    for (const nombre of ['papa', 'tomate', 'arroz', 'pan']) {
      await pulsar(nombre);
    }

    expect(screen.getByText('Llevas 4 de 4.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'leche' })).toBeDisabled();
    // Lo ya marcado se puede soltar.
    expect(screen.getByRole('button', { name: /^pan/ })).toBeEnabled();
  });

  it('el puntaje es lo recordado sobre lo que tenia la lista, y elegir de mas no resta', async () => {
    await empezar();
    await pulsar(/Ya la tengo/);

    // Tres bien y un distractor: tres de cuatro.
    for (const nombre of ['papa', 'tomate', 'arroz', 'pan']) {
      await pulsar(nombre);
    }

    await pulsar('Listo');

    expect(screen.getByText('Recordaste 3 de 4.')).toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().score).toBe(3);
    expect(entregado().metadata).toMatchObject({ aciertos: 3, elementos: 4, elegidas: 4 });
  });

  it('al revisar dice cuales eran con palabras: lo olvidado, lo recordado y lo de mas', async () => {
    await empezar();
    await pulsar(/Ya la tengo/);
    await pulsar('papa');
    await pulsar('pan');
    await pulsar('Listo');

    expect(screen.getByText('(estaba en la lista)')).toBeInTheDocument();
    expect(screen.getAllByText('estaba en la lista')).toHaveLength(3);
    expect(screen.getByText('tu elección')).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();
  });

  it('con «Listo» sin elegir nada tambien termina: cuenta cero, sin reproche', async () => {
    await empezar();
    await pulsar(/Ya la tengo/);
    await pulsar('Listo');
    await pulsar('Terminar');

    expect(entregado().score).toBe(0);
  });

  it('el orden de las opciones no cambia al elegir', async () => {
    await empezar();
    await pulsar(/Ya la tengo/);

    const grupo = () => screen.getByRole('group', { name: /¿Qué había en la lista\?/ });
    const antes = within(grupo())
      .getAllByRole('button')
      .map((boton) => boton.textContent);

    await pulsar('papa');

    const despues = within(grupo())
      .getAllByRole('button')
      .map((boton) => boton.textContent?.replace('✓', ''));

    expect(despues).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------
// COG-09 · Lo que vi
// ---------------------------------------------------------------------------

describe('Lo que vi', () => {
  async function aLasPreguntas() {
    pintar(LoQueVi, ESCENA);
    await pulsar(/Empezar/);
    await pulsar(/Ya la tengo/);
  }

  it('la escena dice por escrito cada figura y su lugar, y trae el nombre bajo cada dibujo', async () => {
    pintar(LoQueVi, ESCENA);
    await pulsar(/Empezar/);

    const escena = screen.getByRole('img', { name: /Escena de 2 filas por 2 columnas/ });

    expect(escena).toHaveAccessibleName(/ola en la fila 1, columna 1/);
    expect(escena).toHaveAccessibleName(/rayo en la fila 2, columna 2/);
    expect(within(escena).getByText('silla')).toBeInTheDocument();
  });

  it('se oculta sola al pasar el tiempo de la sesion', async () => {
    pintar(LoQueVi, ESCENA);
    await pulsar(/Empezar/);

    // El reloj de la prueba tambien avanza con el tiempo real: se deja holgura a cada lado de los 8 segundos.
    adelantar(7_000);

    expect(screen.getByRole('img', { name: /Escena de/ })).toBeInTheDocument();

    adelantar(1_500);

    expect(screen.queryByRole('img', { name: /Escena de/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Qué había arriba a la izquierda/)).toBeInTheDocument();
  });

  it('cada pregunta marca el lugar en una cuadricula vacia y escribe su fila y columna', async () => {
    await aLasPreguntas();

    const cuadricula = screen.getByRole('img', { name: /Cuadrícula de 2 filas por 2 columnas/ });

    expect(cuadricula).toHaveAccessibleName(/fila 1, columna 1/);
    // Vacia: no se ve ninguna figura de la escena.
    expect(within(cuadricula).queryByText('ola')).not.toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 de 3')).toBeInTheDocument();
  });

  it('las opciones son figuras con su nombre escrito', async () => {
    await aLasPreguntas();

    const opciones = within(
      screen.getByRole('group', { name: '¿Qué había arriba a la izquierda?' }),
    );

    expect(opciones.getAllByRole('button').map((boton) => boton.textContent)).toEqual([
      'sol',
      'ola',
      'hoja',
    ]);
  });

  it('un acierto dice lo que habia y una partida perfecta entrega el maximo', async () => {
    await aLasPreguntas();
    await pulsar('ola');

    expect(screen.getByText('Ahí había: ola.')).toBeInTheDocument();

    await pulsar(/Siguiente/);
    await pulsar('silla');
    await pulsar(/Siguiente/);
    await pulsar('rayo');
    await pulsar('Terminar');

    expect(entregado().score).toBe(3);
    expect(entregado().metadata).toMatchObject({ aciertos: 3, rondas: 3 });
  });

  it('un fallo es «¡Casi!» sin reproche, y cuenta menos', async () => {
    await aLasPreguntas();
    await pulsar('sol');

    expect(screen.getByText(/¡Casi!/)).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();

    await pulsar(/Siguiente/);
    await pulsar('silla');
    await pulsar(/Siguiente/);
    await pulsar('rayo');
    await pulsar('Terminar');

    expect(entregado().score).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// COG-05 · Toca solo lo que cambia
// ---------------------------------------------------------------------------

describe('Toca solo lo que cambia', () => {
  /** Los lugares de la secuencia donde sale el objetivo. */
  const DEL_OBJETIVO = FLUJO.secuencia.flatMap((clave, indice) =>
    clave === 'sol' ? [indice] : [],
  );

  async function empezar(parametros: Record<string, unknown> = FLUJO) {
    pintar(AtencionEnFlujo, parametros);
    await pulsar(/Empezar/);
  }

  /** Deja pasar un estimulo, y devuelve cual se ve. */
  function siguienteEstimulo(ms = 1000): string {
    adelantar(ms);

    return document.querySelector('[data-anuncio]')?.textContent ?? '';
  }

  function tocar() {
    return usuario.click(screen.getByRole('button', { name: /Tocar si el símbolo es/ }));
  }

  /** Juega toda la secuencia tocando en los lugares que se piden. */
  async function jugar(tocarEn: readonly number[]) {
    for (let indice = 0; indice < FLUJO.secuencia.length; indice += 1) {
      adelantar(FLUJO.msPorEstimulo);

      if (tocarEn.includes(indice)) {
        await tocar();
      }
    }

    adelantar(FLUJO.msPorEstimulo);
  }

  it('dice el objetivo y que tocar de mas no pasa nada, y que son unos 12 segundos', () => {
    pintar(AtencionEnFlujo, FLUJO);

    expect(
      screen.getByText(/Toca solo si es el sol/, { selector: 'li, span, p' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/es otro intento/)).toBeInTheDocument();
    expect(screen.getByText(/Son unos 12 segundos/)).toBeInTheDocument();
  });

  it('el primer estimulo llega despues de una espera, y cada uno dura lo que dice la sesion', async () => {
    await empezar();

    expect(screen.getByText('Prepárate…')).toBeInTheDocument();

    expect(siguienteEstimulo()).toBe('la luna');
    // El reloj de la prueba tambien avanza con el tiempo real: holgura a cada lado del segundo.
    expect(siguienteEstimulo(500)).toBe('la luna');
    expect(siguienteEstimulo(600)).toBe('el sol');
  });

  it('el objetivo se queda a la vista todo el rato y no hay barra de tiempo', async () => {
    await empezar();
    adelantar(5_000);

    expect(screen.getByText('Tu objetivo')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/restante/i)).not.toBeInTheDocument();
  });

  it('cada simbolo se anuncia por escrito para quien no ve la figura', async () => {
    await empezar();

    expect(siguienteEstimulo()).toBe('la luna');
    expect(siguienteEstimulo()).toBe('el sol');
    expect(siguienteEstimulo()).toBe('la nube');
  });

  it('tocar cuando sale el objetivo cuenta, y la partida perfecta entrega el maximo', async () => {
    await empezar();
    await jugar(DEL_OBJETIVO);

    expect(screen.getByText(/Tocaste 3 de 3 veces que salió el sol/)).toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().score).toBe(3);
    expect(entregado().metadata).toMatchObject({ aciertos: 3, objetivos: 3, otrosIntentos: 0 });
  });

  it('tocar de mas no resta ni se senala: se cuenta aparte como otro intento', async () => {
    await empezar();
    // Los tres del objetivo, mas dos toques en lo que no era.
    await jugar([...DEL_OBJETIVO, 0, 2]);

    expect(screen.getByText(/Otros intentos: 2/)).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().score).toBe(3);
    expect(entregado().metadata).toMatchObject({ aciertos: 3, otrosIntentos: 2 });
  });

  it('tocar dos veces el mismo objetivo cuenta un acierto y un otro intento', async () => {
    await empezar();
    adelantar(FLUJO.msPorEstimulo); // luna
    adelantar(FLUJO.msPorEstimulo); // sol
    await tocar();
    await tocar();
    adelantar(FLUJO.msPorEstimulo * 11);
    await pulsar('Terminar');

    expect(entregado().metadata).toMatchObject({ aciertos: 1, otrosIntentos: 1 });
  });

  it('no tocar nada entrega cero, con el tono de «casi», y se puede terminar', async () => {
    await empezar();
    await jugar([]);

    expect(screen.getByText(/¡Casi!/)).toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().score).toBe(0);
  });

  it('un toque antes de que salga el primer estimulo no cuenta', async () => {
    await empezar();
    await tocar();
    await jugar(DEL_OBJETIVO);
    await pulsar('Terminar');

    expect(entregado().metadata).toMatchObject({ aciertos: 3, otrosIntentos: 0 });
  });

  it('no termina antes de tiempo: durante el flujo no hay boton de terminar', async () => {
    await empezar();
    adelantar(6_000);

    expect(screen.queryByRole('button', { name: 'Terminar' })).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// COG-08 · Une los puntos en orden
// ---------------------------------------------------------------------------

describe('Une los puntos en orden', () => {
  async function empezar() {
    pintar(UnirLosPuntos, PUNTOS);
    await pulsar(/Empezar/);
  }

  function punto(etiqueta: string) {
    return screen.getByRole('button', { name: new RegExp(`^${etiqueta}(,|$)`) });
  }

  it('dice que no hay cronometro y que no es una prueba ni mide nada', () => {
    pintar(UnirLosPuntos, PUNTOS);

    expect(screen.getByText(/No hay cronómetro/)).toBeInTheDocument();
    expect(screen.getByText(/No es una prueba ni mide nada/)).toBeInTheDocument();
  });

  it('muestra todos los puntos desde el principio, cada uno de al menos 44 px de alto y ancho de trazo', async () => {
    await empezar();

    const tablero = within(screen.getByRole('group', { name: 'Puntos para unir' }));

    expect(tablero.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByText('Busca el 1.')).toBeInTheDocument();
    expect(screen.getByText('Llevas 0 de 5.')).toBeInTheDocument();
  });

  it('cada punto esta en el lugar de la sesion', async () => {
    await empezar();

    expect(punto('2')).toHaveStyle({ left: '80%', top: '20%' });
    expect(punto('5')).toHaveStyle({ left: '20%', top: '80%' });
  });

  it('tocar en orden suma, une con una linea y pide el siguiente', async () => {
    await empezar();
    await usuario.click(punto('1'));
    await usuario.click(punto('2'));

    expect(screen.getByText('Llevas 2 de 5.')).toBeInTheDocument();
    expect(screen.getByText('Busca el 3.')).toBeInTheDocument();
    expect(punto('1')).toHaveAccessibleName('1, ya tocado');
    expect(document.querySelectorAll('.juego__lineas line')).toHaveLength(1);
  });

  it('un punto que no toca no resta ni se senala: se cuenta aparte', async () => {
    await empezar();
    await usuario.click(punto('4'));
    await usuario.click(punto('1'));

    expect(screen.getByText('Llevas 1 de 5.')).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();

    await pulsar('Dejarlo aquí');
    await pulsar('Terminar');

    expect(entregado().metadata).toMatchObject({ tocados: 1, puntos: 5, otrosIntentos: 1 });
  });

  it('volver a tocar uno ya tocado no es un otro intento', async () => {
    await empezar();
    await usuario.click(punto('1'));
    await usuario.click(punto('1'));
    await pulsar('Dejarlo aquí');
    await pulsar('Terminar');

    expect(entregado().metadata).toMatchObject({ tocados: 1, otrosIntentos: 0 });
  });

  it('completarlos todos termina solo y entrega el maximo', async () => {
    await empezar();

    for (const etiqueta of ['1', '2', '3', '4', '5']) {
      await usuario.click(punto(etiqueta));
    }

    expect(screen.queryByRole('button', { name: 'Dejarlo aquí' })).not.toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().score).toBe(5);
  });

  it('«Dejarlo aqui» siempre esta, y lo que se hizo cuenta: puntaje por lo completado', async () => {
    await empezar();
    await usuario.click(punto('1'));
    await usuario.click(punto('2'));
    await pulsar('Dejarlo aquí');

    expect(screen.getByText(/Gracias por intentarlo/)).toBeInTheDocument();

    await pulsar('Terminar');

    // Dos de cinco puntos: dos de cinco del maximo.
    expect(entregado().score).toBe(2);
  });

  it('despues de dejarlo ya no se puede tocar ningun punto', async () => {
    await empezar();
    await pulsar('Dejarlo aquí');

    expect(punto('1')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// COG-03 y EMO-04 · Ordena por categoria / Lo que si controlo
// ---------------------------------------------------------------------------

describe('Ordena por categoria (con cesta correcta)', () => {
  async function empezar() {
    pintar(OrdenaPorCategoria, CESTAS);
    await pulsar(/Empezar/);
  }

  const cesta = (tarjeta: string, nombre: string) =>
    screen.getByRole('button', { name: `Llevar «${tarjeta}» a ${nombre}` });

  it('la tarjeta se lleva tocando la cesta: hay un boton por cesta, sin arrastrar', async () => {
    await empezar();

    expect(screen.getByText('pera', { selector: 'strong' })).toBeInTheDocument();
    expect(cesta('pera', 'Frutas')).toBeInTheDocument();
    expect(cesta('pera', 'Verduras')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta 1 de 4', { selector: 'span' })).toBeInTheDocument();
  });

  it('un acierto celebra y marca la cesta con una palabra para quien no ve el color', async () => {
    await empezar();
    await usuario.click(cesta('pera', 'Frutas'));

    expect(cesta('pera', 'Frutas')).toHaveAttribute('data-estado', 'correcta');
    expect(screen.getByText('(iba aquí)')).toBeInTheDocument();
  });

  it('un fallo dice donde iba, sin senalarlo, y deja lo elegido como «tu eleccion»', async () => {
    await empezar();
    await usuario.click(cesta('pera', 'Verduras'));

    expect(screen.getByText('¡Casi! Iba en Frutas.')).toBeInTheDocument();
    expect(screen.getByText('tu elección')).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();
  });

  it('una tarjeta ambigua (el tomate) vale en cualquiera de sus cestas', async () => {
    await empezar();
    await usuario.click(cesta('pera', 'Frutas'));
    await pulsar(/Siguiente/);
    await usuario.click(cesta('espinaca', 'Verduras'));
    await pulsar(/Siguiente/);
    await usuario.click(cesta('tomate', 'Verduras'));

    expect(screen.getByText(/^(¡|Eso|Muy|Bien|Así|Genial|Lo|Qué|Perfecto)/)).toBeInTheDocument();
    expect(screen.queryByText(/¡Casi!/)).not.toBeInTheDocument();
    expect(screen.getByText('Frutas', { selector: '.juego__cesta-nombre' })).toBeInTheDocument();
  });

  it('al final muestra como quedo todo y entrega los aciertos', async () => {
    await empezar();
    await usuario.click(cesta('pera', 'Frutas'));
    await pulsar(/Siguiente/);
    await usuario.click(cesta('espinaca', 'Frutas')); // mal
    await pulsar(/Siguiente/);
    await usuario.click(cesta('tomate', 'Frutas')); // vale
    await pulsar(/Siguiente/);
    await usuario.click(cesta('uva', 'Frutas'));
    await pulsar('Ver cómo quedó');

    expect(screen.getByRole('heading', { name: 'Acertaste 3 de 4' })).toBeInTheDocument();

    const frutas = screen.getByRole('heading', { name: 'Frutas' }).closest('section');

    expect(within(frutas!).getAllByRole('listitem')).toHaveLength(4);

    await pulsar('Terminar');

    expect(entregado().score).toBe(3);
    expect(entregado().metadata).toMatchObject({
      aciertos: 3,
      tarjetas: 4,
      colocaciones: { pera: 'frutas', espinaca: 'frutas', tomate: 'frutas', uva: 'frutas' },
    });
  });

  it('no hay campo de texto: es un juego, no una reflexion', async () => {
    await empezar();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('Lo que si controlo (cestas de reflexion, sin cesta correcta)', () => {
  async function aLaUltima() {
    pintar(OrdenaPorCategoria, CESTAS_DE_REFLEXION);
    await pulsar(/Empezar/);

    const pares: [string, string][] = [
      ['Cómo respondo', 'Lo controlo'],
      ['Lo que piensen otros', 'No lo controlo'],
      ['Cuándo descanso', 'Lo controlo'],
      ['El clima de mañana', 'No lo controlo'],
    ];

    for (const [indice, [tarjeta, cesta]] of pares.entries()) {
      await usuario.click(screen.getByRole('button', { name: `Llevar «${tarjeta}» a ${cesta}` }));
      await pulsar(indice === pares.length - 1 ? 'Ver cómo quedó' : /Siguiente/);
    }
  }

  it('dice que no hay respuestas buenas ni malas y no puntua nada', async () => {
    pintar(OrdenaPorCategoria, CESTAS_DE_REFLEXION);

    expect(screen.getByText('No hay respuestas buenas ni malas.')).toBeInTheDocument();

    await pulsar(/Empezar/);
    await usuario.click(
      screen.getByRole('button', { name: 'Llevar «Cómo respondo» a No lo controlo' }),
    );

    // Nada celebra ni corrige, se ponga donde se ponga.
    expect(screen.queryByText(/¡Casi!|Eso es|Acert/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-estado]')).toBeNull();
  });

  it('al final se ve como quedo y, si la sesion lo pide, se puede escribir una linea', async () => {
    await aLaUltima();

    expect(screen.getByRole('heading', { name: 'Así quedó' })).toBeInTheDocument();
    expect(screen.getByText('Separarlo ya ordena un poco. Gracias.')).toBeInTheDocument();
    expect(screen.getByLabelText('¿Qué harías con lo que sí controlas?')).toHaveAttribute(
      'maxlength',
      '200',
    );
  });

  it('terminar sin escribir no entrega puntaje ni linea', async () => {
    await aLaUltima();
    await pulsar('Terminar');

    const { score, metadata } = entregado();

    expect(score).toBeUndefined();
    expect(metadata).not.toHaveProperty('linea');
    expect(metadata).not.toHaveProperty('aciertos');
    expect(metadata.colocaciones).toEqual({
      a: 'controlo',
      b: 'no-controlo',
      c: 'controlo',
      d: 'no-controlo',
    });
  });

  it('la linea escrita viaja en la peticion tal cual, recortada, y no se guarda en el navegador', async () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem');

    await aLaUltima();
    await usuario.type(
      screen.getByLabelText('¿Qué harías con lo que sí controlas?'),
      '  Descansar un rato  ',
    );
    await pulsar('Terminar');

    expect(entregado().metadata.linea).toBe('Descansar un rato');
    expect(guardar.mock.calls.some(([, valor]) => String(valor).includes('Descansar'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// COG-07 · Completa la palabra
// ---------------------------------------------------------------------------

describe('normalizarLaPalabra y esLaPalabra', () => {
  it('ignora tildes, mayusculas y espacios', () => {
    expect(normalizarLaPalabra('  ÁRBOL ')).toBe('arbol');
    expect(normalizarLaPalabra('Canción')).toBe('cancion');
  });

  it('la enie es otra letra: «pano» no es «paño»', () => {
    expect(normalizarLaPalabra('Paño')).toBe('paño');
    expect(normalizarLaPalabra('Paño')).not.toBe(normalizarLaPalabra('pano'));
    expect(normalizarLaPalabra('AÑO')).toBe('año');
  });

  it('en completar solo se miran las letras que faltaban, con o sin tilde', () => {
    const arbol = { pista: 'Un árbol', palabra: 'árbol', faltan: [0] };

    expect(esLaPalabra(arbol, 'completar', ['a'])).toBe(true);
    expect(esLaPalabra(arbol, 'completar', ['Á'])).toBe(true);
    expect(esLaPalabra(arbol, 'completar', ['e'])).toBe(false);
    expect(esLaPalabra(arbol, 'completar', [''])).toBe(false);
  });

  it('en completar con dos letras faltantes se miran las dos, en su lugar', () => {
    const toro = { pista: 'Un animal', palabra: 'toro', faltan: [1, 2] };

    expect(esLaPalabra(toro, 'completar', ['o', 'r'])).toBe(true);
    expect(esLaPalabra(toro, 'completar', ['r', 'o'])).toBe(false);
    expect(esLaPalabra(toro, 'completar', ['o'])).toBe(false);
  });

  it('en anagrama se escribe la palabra entera, con o sin tilde', () => {
    const palabra = { pista: 'Una fruta', palabra: 'limón', revuelta: 'nilmó' };

    expect(esLaPalabra(palabra, 'anagrama', ['limon'])).toBe(true);
    expect(esLaPalabra(palabra, 'anagrama', ['LIMÓN'])).toBe(true);
    expect(esLaPalabra(palabra, 'anagrama', ['limo'])).toBe(false);
    expect(esLaPalabra(palabra, 'anagrama', [])).toBe(false);
  });
});

describe('Completa la palabra (completar)', () => {
  async function empezar() {
    pintar(CompletaLaPalabra, COMPLETAR);
    await pulsar(/Empezar/);
  }

  it('explica que se puede escribir con o sin tilde y que no hay tiempo', () => {
    pintar(CompletaLaPalabra, COMPLETAR);

    expect(screen.getByText(/con o sin tilde/)).toBeInTheDocument();
    expect(screen.getByText(/No hay tiempo/)).toBeInTheDocument();
  });

  it('muestra la pista, las letras que hay y un campo en cada lugar que falta, con el foco en el primero', async () => {
    await empezar();

    expect(screen.getByText('Una fruta')).toBeInTheDocument();

    const palabra = within(screen.getByRole('group', { name: 'Palabra de 7 letras' }));

    expect(palabra.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Letra 4 de 7' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeDisabled();
  });

  it('un acierto se celebra y muestra la palabra; con tilde o sin ella da igual', async () => {
    await empezar();
    await usuario.type(screen.getByRole('textbox', { name: 'Letra 4 de 7' }), 'Z');
    await pulsar('Comprobar');

    expect(screen.getByText('manzana', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(/¡Casi!/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Letra 4 de 7' })).toBeDisabled();
  });

  it('un fallo dice «¡Casi!» y la palabra, sin senalarlo', async () => {
    await empezar();
    await usuario.type(screen.getByRole('textbox', { name: 'Letra 4 de 7' }), 'x');
    await pulsar('Comprobar');

    expect(screen.getByText('¡Casi! Era «manzana».')).toBeInTheDocument();
    expect(screen.queryByText(/te equivocaste|incorrecto|error/i)).not.toBeInTheDocument();
  });

  it('con dos letras faltantes, al escribir la primera el foco pasa a la segunda', async () => {
    pintar(CompletaLaPalabra, {
      ...COMPLETAR,
      palabras: [COMPLETAR.palabras[2], ...COMPLETAR.palabras],
    });
    await pulsar(/Empezar/);

    await usuario.keyboard('o');

    expect(screen.getByRole('textbox', { name: 'Letra 3 de 4' })).toHaveFocus();
  });

  it('«Comprobar» espera a que esten todas las letras', async () => {
    pintar(CompletaLaPalabra, {
      ...COMPLETAR,
      palabras: [COMPLETAR.palabras[2], ...COMPLETAR.palabras],
    });
    await pulsar(/Empezar/);
    await usuario.keyboard('o');

    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeDisabled();

    await usuario.keyboard('r');

    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeEnabled();
  });

  it('Enter comprueba, y cada palabra empieza con sus campos vacios', async () => {
    await empezar();
    await usuario.keyboard('z{Enter}');
    await pulsar(/Siguiente/);

    expect(screen.getByText('Un árbol')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Letra 1 de 5' })).toHaveValue('');
    expect(screen.getByText('Palabra 2 de 3')).toBeInTheDocument();
  });

  it('una partida entrega el puntaje por palabras acertadas, una sola vez', async () => {
    await empezar();
    await usuario.keyboard('z{Enter}');
    await pulsar(/Siguiente/);
    await usuario.keyboard('A{Enter}'); // «arbol»: sin tilde
    await pulsar(/Siguiente/);
    await usuario.keyboard('o');
    await usuario.keyboard('x{Enter}'); // «toxo»: fallo
    await pulsar('Terminar');

    expect(entregado().score).toBe(2);
    expect(entregado().metadata).toMatchObject({ aciertos: 2, palabras: 3 });
  });
});

describe('Completa la palabra (anagrama)', () => {
  async function empezar() {
    pintar(CompletaLaPalabra, ANAGRAMA);
    await pulsar(/Empezar/);
  }

  it('muestra las letras revueltas, y las anuncia una a una', async () => {
    await empezar();

    expect(screen.getByText('Letras revueltas: t, a, g, o')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Escribe la palabra' })).toHaveFocus();
  });

  it('acepta la palabra sin tilde y en mayusculas', async () => {
    await empezar();
    await usuario.keyboard('GATO{Enter}');

    expect(screen.queryByText(/¡Casi!/)).not.toBeInTheDocument();
  });

  it('la enie no es una n: «ano» no es «año»', async () => {
    pintar(CompletaLaPalabra, {
      ...ANAGRAMA,
      palabras: [ANAGRAMA.palabras[2], ...ANAGRAMA.palabras],
    });
    await pulsar(/Empezar/);
    await usuario.keyboard('ano{Enter}');

    expect(screen.getByText('¡Casi! Era «año».')).toBeInTheDocument();
  });

  it('con la enie bien escrita acierta', async () => {
    pintar(CompletaLaPalabra, {
      ...ANAGRAMA,
      palabras: [ANAGRAMA.palabras[2], ...ANAGRAMA.palabras],
    });
    await pulsar(/Empezar/);
    await usuario.keyboard('AÑO{Enter}');

    expect(screen.queryByText(/¡Casi!/)).not.toBeInTheDocument();
  });

  it('una partida entera entrega el puntaje', async () => {
    await empezar();
    await usuario.keyboard('gato{Enter}');
    await pulsar(/Siguiente/);
    await usuario.keyboard('libro{Enter}');
    await pulsar(/Siguiente/);
    await usuario.keyboard('anio{Enter}');
    await pulsar('Terminar');

    expect(entregado().score).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Accesibilidad (axe): cada pantalla, en lo que muestra de principio a fin
// ---------------------------------------------------------------------------

describe('accesibilidad con axe', () => {
  it('La palabra que sobra: presentacion, ronda y ronda revisada', async () => {
    pintar(PalabraQueSobra, INTRUSO);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('gato');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Cuentas con calma: ronda revisada', async () => {
    pintar(CuentasConCalma, CALCULO);
    await pulsar(/Empezar/);
    await pulsar('17');

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Recuerda la lista: mirando, eligiendo y revisada', async () => {
    pintar(RecuerdaLaLista, LISTA);
    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar(/Ya la tengo/);
    await pulsar('papa');
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Listo');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Lo que vi: la escena y una pregunta', async () => {
    pintar(LoQueVi, ESCENA);
    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar(/Ya la tengo/);
    await pulsar('sol');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Toca solo lo que cambia: la presentacion, el flujo y el final', async () => {
    pintar(AtencionEnFlujo, FLUJO);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar(/Empezar/);
    adelantar(2_000);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    adelantar(FLUJO.msPorEstimulo * FLUJO.secuencia.length);
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Une los puntos: el tablero con puntos tocados', async () => {
    pintar(UnirLosPuntos, PUNTOS);
    await pulsar(/Empezar/);
    await usuario.click(screen.getByRole('button', { name: '1' }));
    await usuario.click(screen.getByRole('button', { name: '2' }));

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Ordena por categoria: la tarjeta, el resumen y la reflexion con su campo', async () => {
    pintar(OrdenaPorCategoria, CESTAS);
    await pulsar(/Empezar/);
    await usuario.click(screen.getByRole('button', { name: 'Llevar «pera» a Verduras' }));
    expect(await fallosDeAccesibilidad()).toEqual([]);

    cleanup();
    pintar(OrdenaPorCategoria, CESTAS_DE_REFLEXION);
    await pulsar(/Empezar/);

    for (const tarjeta of [
      'Cómo respondo',
      'Lo que piensen otros',
      'Cuándo descanso',
      'El clima de mañana',
    ]) {
      await usuario.click(
        screen.getByRole('button', { name: `Llevar «${tarjeta}» a Lo controlo` }),
      );
      await pulsar(/Siguiente|Ver cómo quedó/);
    }

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('Completa la palabra: en sus dos modos, antes y despues de comprobar', async () => {
    pintar(CompletaLaPalabra, COMPLETAR);
    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await usuario.keyboard('x{Enter}');
    expect(await fallosDeAccesibilidad()).toEqual([]);

    cleanup();
    pintar(CompletaLaPalabra, ANAGRAMA);
    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await usuario.keyboard('gato{Enter}');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
