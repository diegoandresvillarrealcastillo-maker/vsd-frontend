import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReglasLocales } from '../../../infraestructura/api/reglasLocales.ts';
import contratoJson from '../../../asistente/contrato/reglas-locales.json';
import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { ANCLA, AUTOMATICA, ESTIRAMIENTO, RESPIRO } from '../../../pruebas/sesionesDeBienestar.ts';
import { sesionDeCognicion } from '../../../pruebas/sesionesDeCognicion.ts';
import { GuiaDePasos } from './GuiaDePasos.tsx';

/**
 * La guia de pasos (SCRUM-226): estiramiento, escaneo corporal, respiro del dia, ancla 5-4-3-2-1 y lugar tranquilo,
 * con la sesion que manda el servidor y sin tocar la red.
 *
 * Lo que se protege: la advertencia a la vista antes de empezar, el aviso que no se va en toda la guia, que nada
 * se imponga (se elige, se puede parar y volver), que con avance manual nada pase solo, que las lineas de
 * atencion esten a mano sin conexion, y que lo que se entrega no dependa de hacerlo «bien».
 */
vi.setConfig({ testTimeout: 20_000 });

const PAQUETE = (contratoJson as unknown as { paquete: ReglasLocales }).paquete;

const { useReglasLocales, zonaActual } = vi.hoisted(() => ({
  useReglasLocales: vi.fn<() => ReglasLocales | null>(),
  zonaActual: vi.fn<() => string>(),
}));

vi.mock('../../../asistente/useReglasLocales.ts', () => ({ useReglasLocales }));
vi.mock('../../../tiempo/zonaHoraria.ts', async (original) => ({
  ...(await original<typeof import('../../../tiempo/zonaHoraria.ts')>()),
  zonaActual,
}));

const alTerminar = vi.fn();
let usuario: UserEvent;

function pintar(parametros: Record<string, unknown>, enviando = false) {
  return render(
    <GuiaDePasos
      alTerminar={alTerminar}
      enviando={enviando}
      sesion={sesionDeCognicion(parametros)}
    />,
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

  return alTerminar.mock.calls[0]?.[0] as { score?: number; metadata: Record<string, unknown> };
}

beforeEach(() => {
  usuario = userEvent.setup();
  useReglasLocales.mockReturnValue(null);
  zonaActual.mockReturnValue('America/Bogota');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  alTerminar.mockClear();
  useReglasLocales.mockReset();
  zonaActual.mockReset();
});

/**
 * Para las pruebas que dependen del reloj. Las demas usan el reloj de verdad: los pasos entran y salen con
 * una animacion de `framer-motion`, y si una prueba termina con un cuadro de animacion pendiente en un reloj
 * falso, el bucle de animaciones se queda esperando un cuadro que ya no llegara y las siguientes no avanzan.
 * Por eso al terminar se desmonta y se vacian los temporizadores pendientes antes de volver al reloj real.
 */
function conRelojFalso() {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    usuario = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });
}

describe('sin una sesion que entienda', () => {
  it.each([
    ['sin sesion', undefined],
    ['con parametros vacios', sesionDeCognicion({})],
    [
      'con una respiracion (otro modo del motor)',
      sesionDeCognicion({ patron: { inhalaSegundos: 4 } }),
    ],
    ['con pasos que no cumplen el contrato', sesionDeCognicion({ ...ESTIRAMIENTO, pasos: [] })],
  ])('%s: lo dice, y no hay nada que empezar', (_caso, sesion) => {
    render(<GuiaDePasos alTerminar={alTerminar} enviando={false} sesion={sesion} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

describe('antes de empezar', () => {
  it('la advertencia va a la vista, entera y en su tarjeta, antes de cualquier paso', () => {
    pintar(ESTIRAMIENTO);

    const tarjeta = screen.getByRole('note', { name: 'Antes de empezar' });

    expect(tarjeta).toHaveTextContent('Hazlo sin dolor: si algo duele, para.');
    expect(screen.queryByRole('heading', { name: /Cuello: la oreja/ })).not.toBeInTheDocument();
  });

  it('muestra la introduccion y el aviso de siempre, y espera a que se empiece', () => {
    pintar(ESTIRAMIENTO);

    expect(
      screen.getByText('Tres movimientos suaves, uno tras otro, desde una silla.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Si algo duele, para.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empezar/ })).toBeEnabled();
  });

  it('sin advertencia no inventa una tarjeta', () => {
    pintar(RESPIRO);

    expect(screen.queryByRole('note', { name: 'Antes de empezar' })).not.toBeInTheDocument();
  });

  it('con elecciones, no se puede empezar sin escoger: se explica y no se impone ninguna', async () => {
    pintar(RESPIRO);

    expect(screen.getByRole('button', { name: /Empezar/ })).toBeDisabled();
    expect(screen.getByText('Elige una opción para empezar.')).toBeInTheDocument();
    expect(
      screen.getAllByRole('radio').every((opcion) => !(opcion as HTMLInputElement).checked),
    ).toBe(true);

    await usuario.click(screen.getByRole('radio', { name: /Mirar lejos/ }));

    expect(screen.getByRole('button', { name: /Empezar/ })).toBeEnabled();
    expect(screen.queryByText('Elige una opción para empezar.')).not.toBeInTheDocument();
  });

  it('cada eleccion dice su nombre y su descripcion', () => {
    pintar(RESPIRO);

    expect(
      screen.getByRole('radio', {
        name: 'Mirar lejos. Descansar la vista mirando hacia lo lejano.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mirar por la ventana' })).toBeInTheDocument();
  });
});

describe('recorrer los pasos', () => {
  async function empezar(parametros: Record<string, unknown> = ESTIRAMIENTO) {
    pintar(parametros);
    await pulsar(/Empezar/);
  }

  it('muestra el primer paso con su titulo, su texto y su figura, y el avance', async () => {
    await empezar();

    expect(
      screen.getByRole('heading', { name: 'Cuello: la oreja al hombro derecho' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Deja caer la oreja derecha/)).toBeInTheDocument();
    expect(document.querySelector('[data-figura="cuello:inclinar-der"]')).not.toBeNull();
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
  });

  it('un paso sin titulo se llama «Paso N»', async () => {
    await empezar();
    await pulsar(/Siguiente/);
    await pulsar(/Siguiente/);

    // El paso nuevo entra cuando termina de salir el anterior.
    expect(await screen.findByRole('heading', { name: 'Paso 3' })).toBeInTheDocument();
  });

  it('el aviso de siempre queda a la vista durante toda la guia', async () => {
    await empezar();

    expect(screen.getByRole('note', { name: '' }).textContent).toContain('Si algo duele, para.');

    await pulsar(/Siguiente/);

    expect(screen.getByText('Si algo duele, para.')).toBeInTheDocument();
  });

  it('se puede volver atras, y en el primero no hay donde volver', async () => {
    await empezar();

    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument();

    await pulsar(/Siguiente/);
    await pulsar('Atrás');

    // El paso nuevo entra cuando termina de salir el anterior.
    expect(
      await screen.findByRole('heading', { name: 'Cuello: la oreja al hombro derecho' }),
    ).toBeInTheDocument();
  });

  it('en el ultimo, el boton dice «Listo» y lleva al cierre', async () => {
    await empezar();
    await pulsar(/Siguiente/);
    await pulsar(/Siguiente/);

    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument();

    await pulsar('Listo');

    expect(screen.getByText('Eso es todo. Tu cuerpo lo nota.')).toBeInTheDocument();
  });

  it('con elecciones recorre solo los pasos de la que se escogio', async () => {
    pintar(RESPIRO);
    await usuario.click(screen.getByRole('radio', { name: 'Mirar por la ventana' }));
    await pulsar(/Empezar/);

    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Sigue con la mirada algo que se mueva.')).toBeInTheDocument();
    expect(screen.queryByText(/Busca algo lejano/)).not.toBeInTheDocument();
  });

  it('un pictograma de la biblioteca (no una figura de estiramiento) tambien se dibuja', async () => {
    pintar({
      ...ESTIRAMIENTO,
      pasos: [
        { titulo: 'Una montaña', texto: 'Mírala.', pictograma: 'montana' },
        { titulo: 'Otra', texto: 'Respira.' },
      ],
    });
    await pulsar(/Empezar/);

    expect(document.querySelector('[data-forma="montana"]')).not.toBeNull();
    expect(document.querySelector('[data-figura]')).toBeNull();
  });

  it('una figura que no existe se pinta como ficha neutra y el paso se sigue por su texto', async () => {
    pintar({
      ...ESTIRAMIENTO,
      pasos: [
        { titulo: 'Un gesto nuevo', texto: 'Hazlo con calma.', pictograma: 'cuello:volar' },
        { titulo: 'Otro', texto: 'Respira.' },
      ],
    });
    await pulsar(/Empezar/);

    expect(document.querySelector('[data-forma="ficha"]')).not.toBeNull();
    expect(screen.getByText('Hazlo con calma.')).toBeInTheDocument();
  });
});

describe('con avance manual', () => {
  conRelojFalso();

  it('nada pasa solo, por mucho que se espere', async () => {
    pintar(ESTIRAMIENTO);
    await pulsar(/Empezar/);
    adelantar(10 * 60 * 1000);

    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
    expect(screen.queryByText(/Pasa solo/)).not.toBeInTheDocument();
  });
});

describe('parar y terminar', () => {
  it('«Parar» esta siempre, y lo que se hizo cuenta: agradece sin reprochar', async () => {
    pintar(ESTIRAMIENTO);
    await pulsar(/Empezar/);
    await pulsar(/Siguiente/);
    await pulsar('Parar');

    expect(screen.getByText('Gracias por intentarlo. Lo que hiciste cuenta.')).toBeInTheDocument();
    expect(
      screen.queryByText(/te equivocaste|incorrecto|error|lograste|fallaste/i),
    ).not.toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().score).toBeUndefined();
    expect(entregado().metadata).toMatchObject({ completa: false, pasos: 2, total: 3 });
  });

  it('completar la guia entrega «completa» con todos los pasos, y nunca un puntaje', async () => {
    pintar(ESTIRAMIENTO);
    await pulsar(/Empezar/);
    await pulsar(/Siguiente/);
    await pulsar(/Siguiente/);
    await pulsar('Listo');
    await pulsar('Terminar');

    expect(entregado().score).toBeUndefined();
    expect(entregado().metadata).toMatchObject({ completa: true, pasos: 3, total: 3 });
    expect(entregado().metadata.segundos).toEqual(expect.any(Number));
    expect(entregado().metadata).not.toHaveProperty('eleccion');
  });

  it('con elecciones entrega cual se escogio', async () => {
    pintar(RESPIRO);
    await usuario.click(screen.getByRole('radio', { name: /Mirar lejos/ }));
    await pulsar(/Empezar/);
    await pulsar(/Siguiente/);
    await pulsar('Listo');
    await pulsar('Terminar');

    expect(entregado().metadata).toMatchObject({
      eleccion: 'lejos',
      completa: true,
      pasos: 2,
      total: 2,
    });
  });

  it('entrega una sola vez, aunque se pulse dos veces', async () => {
    pintar(ESTIRAMIENTO);
    await pulsar(/Empezar/);
    await pulsar('Parar');

    const boton = screen.getByRole('button', { name: 'Terminar' });

    await usuario.click(boton);
    await usuario.click(boton);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('mientras se envia, el boton de terminar espera', async () => {
    const { rerender } = pintar(ESTIRAMIENTO);

    await pulsar(/Empezar/);
    await pulsar('Parar');

    rerender(
      <GuiaDePasos alTerminar={alTerminar} enviando sesion={sesionDeCognicion(ESTIRAMIENTO)} />,
    );

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('sin cierre propio, agradece con la frase de siempre', async () => {
    const { cierre: _quitado, ...sinCierre } = ESTIRAMIENTO;

    pintar(sinCierre);
    await pulsar(/Empezar/);
    await pulsar(/Siguiente/);
    await pulsar(/Siguiente/);
    await pulsar('Listo');

    expect(screen.getByText('Gracias por darte este rato.')).toBeInTheDocument();
  });
});

describe('con avance automatico', () => {
  conRelojFalso();

  async function empezar() {
    pintar(AUTOMATICA);
    await pulsar(/Empezar/);
  }

  it('dice cuanto dura el paso, con una barra suave y sin cuenta atras', async () => {
    await empezar();

    expect(screen.getByText(/Pasa solo en unos 10 segundos/)).toBeInTheDocument();
    expect(document.querySelector('.guia-pasos__tiempo-barra')).toHaveStyle({
      animationDuration: '10s',
    });
    expect(screen.queryByText(/restan|quedan/i)).not.toBeInTheDocument();
  });

  it('cada paso pasa solo a los segundos que dice la sesion', async () => {
    await empezar();

    // El reloj de la prueba tambien avanza con el tiempo real: se deja holgura a cada lado.
    adelantar(8_000);

    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();

    adelantar(3_000);

    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
    expect(await screen.findByText(/Pasa solo en unos 20 segundos/)).toBeInTheDocument();
  });

  it('se puede seguir antes sin esperar, y el temporizador no se acumula', async () => {
    await empezar();
    await pulsar(/Siguiente/);

    adelantar(5_000);

    // Si el temporizador del primero siguiera vivo, ya habria avanzado otro paso.
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
  });

  it('al acabar el ultimo paso termina la guia sola, completa', async () => {
    await empezar();
    adelantar(11_000);
    adelantar(21_000);
    adelantar(6_000);

    expect(screen.getByText('Gracias por darte este rato.')).toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().metadata).toMatchObject({ completa: true, pasos: 3, total: 3 });
  });

  it('al parar a la mitad no avanza mas', async () => {
    await empezar();
    await pulsar('Parar');
    adelantar(60_000);

    expect(screen.queryByText('Paso 2 de 3')).not.toBeInTheDocument();
    expect(screen.getByText('Gracias por intentarlo. Lo que hiciste cuenta.')).toBeInTheDocument();
  });
});

describe('las lineas de atencion', () => {
  it('sin que la sesion las pida, no hay acceso', () => {
    pintar(ESTIRAMIENTO);

    expect(screen.queryByRole('button', { name: /Líneas de atención/ })).not.toBeInTheDocument();
  });

  it('el ancla las ofrece junto al aviso, y estan ocultas hasta que se piden', () => {
    pintar(ANCLA);

    expect(
      screen.getByText('Si lo necesitas, hay personas que pueden acompañarte.'),
    ).toBeInTheDocument();

    const boton = screen.getByRole('button', { name: 'Líneas de atención' });

    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: /Si te sirve hablarlo/ })).not.toBeInTheDocument();
  });

  it('siguen a la mano durante los pasos, no solo al principio', async () => {
    pintar(ANCLA);
    await pulsar(/Empezar/);
    await pulsar(/Siguiente/);

    expect(screen.getByRole('button', { name: 'Líneas de atención' })).toBeInTheDocument();
  });

  it('sin reglas todavia, abren el respaldo: nunca se queda sin un telefono', async () => {
    pintar(ANCLA);
    await pulsar('Líneas de atención');

    expect(
      screen.getByRole('heading', { name: 'Si te sirve hablarlo con alguien' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar las líneas de atención' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/Línea 192, opción 4/)).toBeInTheDocument();
  });

  it('con las reglas locales (tambien sin conexion) abren las del pais de la persona, y no las de otro', async () => {
    useReglasLocales.mockReturnValue(PAQUETE);
    zonaActual.mockReturnValue('Europe/Madrid');

    pintar(ANCLA);
    await pulsar('Líneas de atención');

    const lineas = screen.getByRole('region', { name: 'Si te sirve hablarlo con alguien' });

    expect(within(lineas).getByText(/Línea 024/)).toBeInTheDocument();
    expect(within(lineas).queryByText(/Línea 192/)).not.toBeInTheDocument();
  });

  it('se pueden volver a ocultar', async () => {
    pintar(ANCLA);
    await pulsar('Líneas de atención');
    await pulsar('Ocultar las líneas de atención');

    expect(
      screen.queryByRole('heading', { name: 'Si te sirve hablarlo con alguien' }),
    ).not.toBeInTheDocument();
  });
});

describe('accesibilidad con axe', () => {
  it('estiramiento: antes de empezar, un paso y el cierre', async () => {
    pintar(ESTIRAMIENTO);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Parar');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('respiro con elecciones y ancla con sus lineas abiertas', async () => {
    pintar(RESPIRO);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    cleanup();
    pintar(ANCLA);
    await pulsar('Líneas de atención');
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar(/Empezar/);
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('avance automatico en un paso', async () => {
    pintar(AUTOMATICA);
    await pulsar(/Empezar/);

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
