import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';
import { SecuenciaDeCasillas } from './SecuenciaDeCasillas.tsx';

/**
 * «Recuerda los colores» (SCRUM-209, ficha COG-01): casillas que se iluminan una a una y hay que
 * tocar en el mismo orden.
 *
 * La pantalla es de una sesion: sin una que entienda, no hay con que pintar (a diferencia de las
 * actividades de siempre, no tiene un respaldo). Cada casilla lleva forma, nombre y color: el
 * color nunca es la unica pista (R10), y la que se ilumina se anuncia por escrito.
 *
 * Con el azar en un orden conocido, la prueba sabe cual es la secuencia de cada ronda.
 */
vi.setConfig({ testTimeout: 20_000 });

const COLORES = [
  { clave: 'circulo', nombre: 'círculo verde', forma: 'círculo', color: 'verde' },
  { clave: 'cuadrado', nombre: 'cuadrado azul', forma: 'cuadrado', color: 'azul' },
  { clave: 'triangulo', nombre: 'triángulo ámbar', forma: 'triángulo', color: 'ámbar' },
  { clave: 'rombo', nombre: 'rombo violeta', forma: 'rombo', color: 'violeta' },
];

const NORMAL = {
  casillas: COLORES,
  largoInicial: 3,
  rondas: 3,
  msPorElemento: 1000,
  msDeMargen: 1000,
  msDestello: 700,
};

function sesionDe(parametros: Record<string, unknown>): SesionDeLaActividad {
  return { id: 's-1', titulo: 'Cuatro colores', nivel: 1, parametros };
}

const alTerminar = vi.fn();
let usuario: UserEvent;

/** Cada llamada al azar elige la casilla que corresponda: 0 es la primera, 0,3 la segunda, 0,6 la tercera... */
function secuencias(...rondas: number[][]) {
  const azar = vi.spyOn(Math, 'random');
  const valores = rondas.flat().map((casilla) => (casilla + 0.1) / COLORES.length);

  for (const valor of valores) {
    azar.mockReturnValueOnce(valor);
  }

  azar.mockReturnValue(0.01);
}

function pintar(parametros: Record<string, unknown> = NORMAL, enviando = false) {
  return render(
    <SecuenciaDeCasillas
      alTerminar={alTerminar}
      enviando={enviando}
      sesion={sesionDe(parametros)}
    />,
  );
}

function adelantar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** La casilla que esta iluminada ahora, o `null`. */
function iluminada(): string | null {
  const luz = document.querySelector('[data-activa="true"]');

  return luz?.getAttribute('data-clave') ?? null;
}

function casilla(nombre: string) {
  return within(screen.getByRole('group', { name: 'Casillas' })).getByRole('button', {
    name: nombre,
  });
}

async function empezar() {
  await usuario.click(screen.getByRole('button', { name: /Empezar/ }));
}

/** Deja pasar toda la secuencia de la ronda: el margen y cada casilla. */
function verLaSecuencia(largo: number, parametros = NORMAL) {
  adelantar(
    parametros.msDeMargen + (largo - 1) * parametros.msPorElemento + parametros.msDestello + 400,
  );
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

describe('sin una sesion que entienda', () => {
  it.each([
    ['sin sesion', undefined],
    ['con parametros de otro motor', sesionDe({ invitacion: '¿Qué estuvo bien hoy?', campos: 1 })],
    ['con parametros vacios', sesionDe({})],
    ['sin destello (es la secuencia de numeros)', sesionDe({ ...NORMAL, msDestello: undefined })],
  ])('%s: lo dice, y no hay nada que empezar', (_caso, sesion) => {
    render(<SecuenciaDeCasillas alTerminar={alTerminar} enviando={false} sesion={sesion} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

describe('la presentacion', () => {
  it('explica la tarea y las rondas de la sesion, y espera a que se empiece', () => {
    pintar({ ...NORMAL, rondas: 8 });

    expect(screen.getByText(/Son 8 rondas/)).toBeInTheDocument();
    expect(screen.getByText(/una casilla más/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empezar/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Casillas' })).not.toBeInTheDocument();
  });
});

describe('las casillas', () => {
  it('cada una dice su nombre por escrito, tiene su forma y su color: no se distingue solo por el color', async () => {
    secuencias([0, 1, 2]);
    pintar();

    await empezar();

    const botones = within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole('button');

    expect(botones.map((boton) => boton.textContent)).toEqual(COLORES.map((c) => c.nombre));

    botones.forEach((boton, indice) => {
      expect(boton.querySelector('svg')).toHaveAttribute(
        'data-forma',
        ['circulo', 'cuadrado', 'triangulo', 'rombo'][indice],
      );
      expect(boton.getAttribute('style')).toMatch(/--simbolo/);
    });
  });

  it.each([
    [4, 4],
    [6, 6],
    [9, 9],
  ])('con %i casillas en la sesion, se pintan las %i', async (cuantas, esperadas) => {
    const formas = [
      'círculo',
      'cuadrado',
      'triángulo',
      'rombo',
      'estrella',
      'hoja',
      'gota',
      'luna',
      'nube',
    ];
    const casillas = formas.slice(0, cuantas).map((forma) => ({
      clave: forma,
      nombre: `${forma} de prueba`,
      forma,
      color: 'verde',
    }));

    pintar({ ...NORMAL, casillas });
    await empezar();

    expect(
      within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole('button'),
    ).toHaveLength(esperadas);
  });
});

describe('el tablero', () => {
  const formas = [
    'círculo',
    'cuadrado',
    'triángulo',
    'rombo',
    'estrella',
    'hoja',
    'gota',
    'luna',
    'nube',
  ];
  const con = (cuantas: number) =>
    formas
      .slice(0, cuantas)
      .map((forma) => ({ clave: forma, nombre: `${forma} de prueba`, forma }));

  it.each([
    [2, '2'],
    [4, '2'],
    [5, '3'],
    [6, '3'],
    [9, '3'],
  ])('con %i casillas, se acomodan en %s columnas', async (cuantas, columnas) => {
    pintar({ ...NORMAL, casillas: con(cuantas) });
    await empezar();

    expect(
      screen.getByRole('group', { name: 'Casillas' }).style.getPropertyValue('--columnas'),
    ).toBe(columnas);
  });
});

describe('mirar la secuencia', () => {
  it('se ilumina una casilla a la vez, en orden, el tiempo que dice la sesion', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();

    // La linea de tiempo, desde que se empieza: espera de 1.000 ms; la primera de 1.000 a 1.700; la
    // segunda de 2.000 a 2.700; la tercera de 3.000 a 3.700.
    adelantar(900); // 900
    expect(iluminada()).toBeNull();

    adelantar(200); // 1.100
    expect(iluminada()).toBe('circulo');

    adelantar(500); // 1.600: todavia se ve, la iluminacion dura 700 ms
    expect(iluminada()).toBe('circulo');

    adelantar(200); // 1.800: ya se apago
    expect(iluminada()).toBeNull();

    adelantar(300); // 2.100: la segunda empezo 1.000 ms despues de la primera
    expect(iluminada()).toBe('cuadrado');

    adelantar(1000); // 3.100: la tercera
    expect(iluminada()).toBe('triangulo');

    adelantar(800); // 3.900: se apago
    expect(iluminada()).toBeNull();
  });

  it('con la sesion lenta, cada casilla se queda 1.100 ms y hay 600 ms de pausa', async () => {
    secuencias([0, 1, 2]);
    pintar({ ...NORMAL, msPorElemento: 1700, msDestello: 1100 });
    await empezar();

    // La primera va de 1.000 a 2.100 ms; la segunda empieza a los 2.700.
    adelantar(2000); // con 700 ms ya estaria apagada: esta es la sesion lenta
    expect(iluminada()).toBe('circulo');

    adelantar(200); // 2.200: apagada, en la pausa
    expect(iluminada()).toBeNull();

    adelantar(600); // 2.800: la segunda
    expect(iluminada()).toBe('cuadrado');
  });

  it('anuncia por escrito la casilla que se ilumina, y deja de hacerlo al apagarse', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();

    const anuncio = document.querySelector('[aria-live="polite"][data-anuncio]');

    expect(anuncio).not.toBeNull();
    expect(anuncio?.textContent).toBe('');

    adelantar(1100);
    expect(anuncio?.textContent).toBe('círculo verde');

    adelantar(700);
    expect(anuncio?.textContent).toBe('');
  });

  it('muestra el nombre de la que se ilumina, a la vista', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();

    adelantar(1100);

    expect(document.querySelector('.juego__nombre-activa')).toHaveTextContent('círculo verde');
  });

  it('mientras se ilumina no se puede tocar nada', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();

    adelantar(1500);

    for (const boton of within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole(
      'button',
    )) {
      expect(boton).toBeDisabled();
    }
  });

  it('un instante despues de apagarse la ultima todavia no se puede tocar: no se pisa con el primer toque', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();

    // La tercera termina a los 3.700 ms; 100 ms despues sigue sin poderse tocar.
    adelantar(3700 + 100);

    for (const boton of within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole(
      'button',
    )) {
      expect(boton).toBeDisabled();
    }

    adelantar(300);

    for (const boton of within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole(
      'button',
    )) {
      expect(boton).toBeEnabled();
    }
  });

  it('al terminar la secuencia, toca responder: se pueden tocar', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();

    verLaSecuencia(3);

    for (const boton of within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole(
      'button',
    )) {
      expect(boton).toBeEnabled();
    }

    expect(screen.getByText(/Tócalas en el mismo orden./)).toBeInTheDocument();
  });
});

describe('responder', () => {
  it('tocar en el orden correcto acierta la ronda', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();
    verLaSecuencia(3);

    await usuario.click(casilla('círculo verde'));
    await usuario.click(casilla('cuadrado azul'));
    await usuario.click(casilla('triángulo ámbar'));

    expect(screen.getByText(/¡Bien! Era esa\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente ronda/ })).toBeInTheDocument();
  });

  it('cuenta cuantas lleva, sin decir nada de si van bien o mal', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();
    verLaSecuencia(3);

    await usuario.click(casilla('círculo verde'));

    expect(screen.getByText('Llevas 1 de 3.')).toBeInTheDocument();
  });

  it('una casilla equivocada cierra la ronda como un «casi» y dice cual era la secuencia', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();
    verLaSecuencia(3);

    await usuario.click(casilla('círculo verde'));
    await usuario.click(casilla('rombo violeta'));

    expect(
      screen.getByText(
        '¡Casi! Era círculo verde, cuadrado azul, triángulo ámbar. Probemos otra, sin prisa.',
      ),
    ).toBeInTheDocument();

    // Ya no se puede seguir tocando en esta ronda.
    for (const boton of within(screen.getByRole('group', { name: 'Casillas' })).getAllByRole(
      'button',
    )) {
      expect(boton).toBeDisabled();
    }
  });
});

describe('las rondas', () => {
  /** Juega una ronda tocando `toques` en orden y pulsa el boton de abajo. */
  async function jugar(largo: number, secuencia: string[], toques: string[]) {
    verLaSecuencia(largo);

    for (const toque of toques) {
      await usuario.click(casilla(toque));
    }

    expect(secuencia.length).toBe(largo);
  }

  it('acertar alarga la siguiente una casilla', async () => {
    secuencias([0, 1, 2], [3, 3, 3, 3]);
    pintar({ ...NORMAL, rondas: 3 });
    await empezar();

    await jugar(3, ['a', 'b', 'c'], ['círculo verde', 'cuadrado azul', 'triángulo ámbar']);
    await usuario.click(screen.getByRole('button', { name: /Siguiente ronda/ }));

    // El progreso avanza: una ronda hecha, y ahora la segunda.
    expect(screen.getByText('Ronda 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

    // La segunda ronda tiene cuatro casillas: la ultima se ilumina a los 1.000 + 3 x 1.000 ms.
    adelantar(1000 + 3 * 1000 + 100);
    expect(iluminada()).toBe('rombo');
  });

  it('fallar la acorta una, sin bajar del largo inicial', async () => {
    secuencias([0, 1, 2], [3, 3, 3, 3]);
    pintar({ ...NORMAL, rondas: 3, largoInicial: 3 });
    await empezar();

    verLaSecuencia(3);
    await usuario.click(casilla('rombo violeta'));
    await usuario.click(screen.getByRole('button', { name: /Siguiente ronda/ }));

    // Siguen siendo tres: la tercera casilla se ilumina a los 1.000 + 2 x 1.000 ms, y no hay cuarta.
    adelantar(1000 + 2 * 1000 + 100);
    expect(iluminada()).not.toBeNull();
    adelantar(700 + 100);
    expect(iluminada()).toBeNull();
    adelantar(1000);
    // Si fueran cuatro, ahora se estaria iluminando la cuarta.
    expect(iluminada()).toBeNull();
  });

  it('al fallar no baja del largo inicial de la sesion, aunque sea mas que tres', async () => {
    secuencias([0, 1, 2, 3, 0], [0, 0, 0, 0, 0]);
    pintar({ ...NORMAL, rondas: 3, largoInicial: 5 });
    await empezar();

    verLaSecuencia(5);
    await usuario.click(casilla('rombo violeta'));
    await usuario.click(screen.getByRole('button', { name: /Siguiente ronda/ }));

    // Siguen siendo cinco: la quinta se ilumina a los 1.000 + 4 x 1.000 ms.
    adelantar(1000 + 4 * 1000 + 100);
    expect(iluminada()).toBe('circulo');
  });

  it('empieza con el largo inicial que dice la sesion', async () => {
    secuencias([0, 1, 2, 3, 0]);
    pintar({ ...NORMAL, largoInicial: 5 });
    await empezar();

    // La quinta casilla se ilumina a los 1.000 + 4 x 1.000 ms.
    adelantar(1000 + 4 * 1000 + 100);
    expect(iluminada()).toBe('circulo');
  });

  it('termina al llegar a las rondas de la sesion, con el puntaje de las acertadas', async () => {
    secuencias([0, 1, 2], [0, 0, 0, 0]);
    pintar({ ...NORMAL, rondas: 2 });
    await empezar();

    // Primera ronda: acierta.
    verLaSecuencia(3);
    await usuario.click(casilla('círculo verde'));
    await usuario.click(casilla('cuadrado azul'));
    await usuario.click(casilla('triángulo ámbar'));
    await usuario.click(screen.getByRole('button', { name: /Siguiente ronda/ }));

    // Segunda ronda, de cuatro: falla a la primera.
    verLaSecuencia(4);
    await usuario.click(casilla('rombo violeta'));
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledTimes(1);

    const entregado = alTerminar.mock.calls[0]?.[0] as {
      score: number;
      metadata: {
        aciertos: number;
        largoMaximo: number;
        rondas: { largo: number; acerto: boolean }[];
      };
    };

    expect(entregado.score).toBe(1);
    expect(entregado.metadata).toMatchObject({ aciertos: 1, largoMaximo: 3 });
    expect(entregado.metadata.rondas).toEqual([
      { largo: 3, acerto: true },
      { largo: 4, acerto: false },
    ]);
  });

  it('al cerrarse la ronda, el foco va al boton de seguir', async () => {
    secuencias([0, 1, 2]);
    pintar();
    await empezar();
    verLaSecuencia(3);

    await usuario.click(casilla('rombo violeta'));

    expect(screen.getByRole('button', { name: /Siguiente ronda/ })).toHaveFocus();
  });

  it('pulsar «Terminar» dos veces entrega el resultado una sola vez', async () => {
    secuencias([0, 1, 2]);
    pintar({ ...NORMAL, rondas: 1 });
    await empezar();
    verLaSecuencia(3);

    await usuario.click(casilla('rombo violeta'));

    const terminar = screen.getByRole('button', { name: 'Terminar' });

    await usuario.click(terminar);
    await usuario.click(terminar);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('el resultado dice cuantos segundos duro', async () => {
    secuencias([0, 1, 2]);
    pintar({ ...NORMAL, rondas: 1 });
    await empezar();
    verLaSecuencia(3);

    await usuario.click(casilla('rombo violeta'));
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    const { metadata } = alTerminar.mock.calls[0]?.[0] as { metadata: { segundos: number } };

    expect(Number.isInteger(metadata.segundos)).toBe(true);
    expect(metadata.segundos).toBeGreaterThanOrEqual(4);
  });

  it('el progreso cuenta las rondas de la sesion', async () => {
    secuencias([0, 1, 2]);
    pintar({ ...NORMAL, rondas: 5 });
    await empezar();

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('Ronda 1 de 5')).toBeInTheDocument();
  });

  it('mientras se guarda, el boton lo dice y no se puede pulsar otra vez', async () => {
    secuencias([0, 1, 2]);
    pintar({ ...NORMAL, rondas: 1 }, true);
    await empezar();

    verLaSecuencia(3);
    await usuario.click(casilla('círculo verde'));
    await usuario.click(casilla('cuadrado azul'));
    await usuario.click(casilla('triángulo ámbar'));

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
