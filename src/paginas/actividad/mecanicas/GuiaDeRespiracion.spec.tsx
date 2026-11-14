import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';
import { GuiaDeRespiracion } from './GuiaDeRespiracion.tsx';

/**
 * «Respiracion guiada» (SCRUM-210, ficha BIE-01): un circulo que se abre y se cierra al ritmo del
 * patron de la sesion, con la palabra y la cuenta en texto.
 *
 * Es una actividad **sin puntaje** y de bienestar: lo que mas importa es lo que **no** hace. La
 * advertencia esta a la vista antes de empezar; se puede parar siempre; no dice si se respira bien
 * o mal; con movimiento reducido no se anima; y lo que se anuncia a un lector de pantalla es el
 * cambio de etapa, no cada segundo.
 */
vi.setConfig({ testTimeout: 20_000 });

const ADVERTENCIA =
  'Si te mareas o te incomoda, suelta el patrón y respira como siempre. Puedes parar cuando quieras.';

const CUATRO_SEIS = {
  advertenciaInicial: ADVERTENCIA,
  patron: { inhalaSegundos: 4, exhalaSegundos: 6, pausaSegundos: 0 },
  duracionSegundos: 60,
  ambientacion: 'bosque',
  frases: ['Sin prisa.', 'Deja que el aire entre y salga a tu ritmo.', 'Un poco más suave.'],
  haptico: false,
};

function sesionDe(parametros: Record<string, unknown>): SesionDeLaActividad {
  return { id: 's-1', titulo: 'Inhalar 4, exhalar 6', nivel: 1, parametros };
}

const alTerminar = vi.fn();
let usuario: UserEvent;

function pintar(parametros: Record<string, unknown> = CUATRO_SEIS, enviando = false) {
  return render(
    <GuiaDeRespiracion alTerminar={alTerminar} enviando={enviando} sesion={sesionDe(parametros)} />,
  );
}

function adelantar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function empezar() {
  await usuario.click(screen.getByRole('button', { name: /Empezar/ }));
}

/** La palabra grande del circulo: «Inhala», «Pausa» o «Exhala». */
function laPalabra(): string {
  return document.querySelector('.respiracion__palabra')?.textContent ?? '';
}

/** La cuenta en texto: los segundos que le quedan a la etapa. */
function laCuenta(): string {
  return document.querySelector('.respiracion__cuenta')?.textContent ?? '';
}

function elAnuncio(): string {
  return document.querySelector('[aria-live="polite"][data-anuncio]')?.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  usuario = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
  // jsdom no trae `matchMedia`: se dice que no se pidio menos movimiento.
  vi.stubGlobal(
    'matchMedia',
    vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  alTerminar.mockClear();
});

describe('sin una sesion que entienda', () => {
  it.each([
    ['sin sesion', undefined],
    ['con parametros de otro motor', sesionDe({ invitacion: '¿Qué estuvo bien hoy?', campos: 1 })],
    ['con parametros vacios', sesionDe({})],
    [
      'con una pausa de 5 s: ninguna retencion de mas de 4 s',
      sesionDe({
        ...CUATRO_SEIS,
        patron: { inhalaSegundos: 4, exhalaSegundos: 6, pausaSegundos: 5 },
      }),
    ],
    [
      'sin advertencia: no se empieza sin ella',
      sesionDe({ ...CUATRO_SEIS, advertenciaInicial: '' }),
    ],
  ])('%s: lo dice, y no hay nada que empezar', (_caso, sesion) => {
    render(<GuiaDeRespiracion alTerminar={alTerminar} enviando={false} sesion={sesion} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

describe('antes de empezar', () => {
  it('la advertencia esta a la vista, completa, y no en letra pequena', () => {
    pintar();

    expect(screen.getByRole('heading', { name: 'Antes de empezar' })).toBeInTheDocument();
    expect(screen.getByText(ADVERTENCIA)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(ADVERTENCIA);
  });

  it('la advertencia se llama como su titulo: un lector de pantalla la anuncia con el', () => {
    pintar();

    expect(screen.getByRole('note', { name: 'Antes de empezar' })).toBeInTheDocument();
  });

  it('esta antes del boton de empezar: no se llega a el sin pasar por ella', () => {
    pintar();

    const advertencia = screen.getByRole('note');
    const empezar = screen.getByRole('button', { name: /Empezar/ });

    expect(
      advertencia.compareDocumentPosition(empezar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('dice el patron y cuanto dura, y que se puede parar', () => {
    pintar();

    expect(screen.getByText(/Inhalas 4 segundos y exhalas 6/)).toBeInTheDocument();
    expect(screen.getByText(/1 minuto/)).toBeInTheDocument();
    expect(
      screen.getByText(/parar cuando quieras/i, { selector: '.respiracion__intro' }),
    ).toBeInTheDocument();
  });

  it('sin pausa no la menciona: ni «pausa» ni «0 segundos»', () => {
    pintar();

    const intro = document.querySelector('.respiracion__intro')?.textContent ?? '';

    expect(intro).toMatch(/Inhalas 4 segundos/);
    expect(intro).not.toMatch(/pausa|0 segundos/i);
  });

  it('con pausa, la dice tambien: una pausa de 2 segundos', () => {
    pintar({ ...CUATRO_SEIS, patron: { inhalaSegundos: 4, exhalaSegundos: 4, pausaSegundos: 2 } });

    expect(screen.getByText(/una pausa de 2 segundos/)).toBeInTheDocument();
  });

  it.each([
    [60, '1 minuto'],
    // 74 s hacen 7 ciclos de 10 s: 70 s, un minuto.
    [74, '1 minuto'],
    [120, '2 minutos'],
    // 95 s hacen 10 ciclos de 10 s: 100 s, que se dicen redondeados y no a la baja.
    [95, '2 minutos'],
    [180, '3 minutos'],
  ])('una sesion de %i segundos dura %s', (duracionSegundos, texto) => {
    pintar({ ...CUATRO_SEIS, duracionSegundos });

    expect(screen.getByText(new RegExp(texto))).toBeInTheDocument();
  });

  it('no se presenta como un tratamiento ni promete nada', () => {
    pintar();

    expect(document.body.textContent).not.toMatch(
      /tratamiento|terapia|cura|ansiedad|estr[eé]s|curar|medic/i,
    );
  });

  it('el circulo ya esta, en reposo, y todavia no dice nada', () => {
    pintar();

    const circulo = document.querySelector<HTMLElement>('.respiracion__circulo');

    expect(circulo).not.toBeNull();
    expect(laPalabra()).toBe('');
    expect(laCuenta()).toBe('');
    // En reposo esta recogido y no se mueve: no hay nada que seguir todavia.
    expect(circulo?.dataset.etapa).toBe('reposo');
    expect(circulo?.style.getPropertyValue('--escala')).toBe('0.55');
    expect(circulo?.style.getPropertyValue('--dur')).toBe('0s');
  });

  it('la mascota sonrie al recibir, esta tranquila mientras se respira y sonrie al agradecer', async () => {
    pintar();

    const dibujo = () => document.querySelector('.viva-voz img')?.getAttribute('src');
    const alRecibir = dibujo();

    await empezar();
    const respirando = dibujo();

    expect(respirando).not.toBe(alRecibir);

    adelantar(60_200);

    expect(dibujo()).toBe(alRecibir);
  });
});

describe('respirando', () => {
  it('empieza inhalando: la palabra y la cuenta de 4 a 1', async () => {
    pintar();
    await empezar();

    expect(laPalabra()).toBe('Inhala');
    expect(laCuenta()).toBe('4');

    adelantar(1000);
    expect(laCuenta()).toBe('3');

    adelantar(1000);
    expect(laCuenta()).toBe('2');

    adelantar(1000);
    expect(laCuenta()).toBe('1');
  });

  it('a los 4 s pasa a exhalar, y la cuenta empieza en 6', async () => {
    pintar();
    await empezar();

    adelantar(4200);

    expect(laPalabra()).toBe('Exhala');
    expect(laCuenta()).toBe('6');

    adelantar(5000);
    expect(laCuenta()).toBe('1');
  });

  it('a los 10 s empieza otro ciclo, inhalando', async () => {
    pintar();
    await empezar();

    adelantar(10_200);

    expect(laPalabra()).toBe('Inhala');
    expect(laCuenta()).toBe('4');
  });

  it('con pausa: inhala 4, pausa 2 y exhala 4', async () => {
    pintar({ ...CUATRO_SEIS, patron: { inhalaSegundos: 4, exhalaSegundos: 4, pausaSegundos: 2 } });
    await empezar();

    expect(laPalabra()).toBe('Inhala');

    adelantar(4200);
    expect(laPalabra()).toBe('Pausa');
    expect(laCuenta()).toBe('2');

    adelantar(2000);
    expect(laPalabra()).toBe('Exhala');
    expect(laCuenta()).toBe('4');
  });

  it('sin pausa nunca dice «Pausa»', async () => {
    pintar();
    await empezar();

    for (let t = 0; t < 30; t += 1) {
      adelantar(1000);
      expect(laPalabra()).not.toBe('Pausa');
    }
  });

  it('el circulo se abre al inhalar, se queda abierto en la pausa y se cierra al exhalar, tardando lo que dura cada etapa', async () => {
    pintar({ ...CUATRO_SEIS, patron: { inhalaSegundos: 4, exhalaSegundos: 5, pausaSegundos: 2 } });
    await empezar();

    const circulo = document.querySelector<HTMLElement>('.respiracion__circulo');

    expect(circulo?.dataset.etapa).toBe('inhala');
    expect(circulo?.style.getPropertyValue('--escala')).toBe('1');
    expect(circulo?.style.getPropertyValue('--dur')).toBe('4s');

    adelantar(4200);
    expect(circulo?.dataset.etapa).toBe('pausa');
    expect(circulo?.style.getPropertyValue('--escala')).toBe('1');

    adelantar(2000);
    expect(circulo?.dataset.etapa).toBe('exhala');
    expect(circulo?.style.getPropertyValue('--escala')).toBe('0.55');
    expect(circulo?.style.getPropertyValue('--dur')).toBe('5s');
  });

  it('a un lector de pantalla se le dice el cambio de etapa, no cada segundo', async () => {
    pintar();
    await empezar();

    expect(elAnuncio()).toBe('Inhala');

    adelantar(1000);
    adelantar(1000);
    expect(elAnuncio()).toBe('Inhala');
    // Nada de numeros en lo que se anuncia.
    expect(elAnuncio()).not.toMatch(/\d/);

    adelantar(2200);
    expect(elAnuncio()).toBe('Exhala');
  });

  it('la cuenta en texto es adorno para quien ve: no se anuncia', async () => {
    pintar();
    await empezar();

    expect(document.querySelector('.respiracion__cuenta')).toHaveAttribute('aria-hidden', 'true');
  });

  it('dice cuanto falta y lo va bajando', async () => {
    pintar();
    await empezar();

    expect(screen.getByText('Quedan 1:00')).toBeInTheDocument();

    adelantar(10_200);
    expect(screen.getByText('Quedan 0:50')).toBeInTheDocument();
  });

  it('la barra de lo que falta avanza con el tiempo', async () => {
    pintar();
    await empezar();

    const barra = screen.getByRole('progressbar');

    expect(barra).toHaveAttribute('aria-valuemin', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '6');
    expect(barra).toHaveAttribute('aria-valuenow', '0');

    adelantar(30_200);
    expect(barra).toHaveAttribute('aria-valuenow', '3');
  });

  it('el reloj mira cada cuarto de segundo: la barra se mueve sin esperar a que pase uno entero', async () => {
    pintar();
    await empezar();

    adelantar(300);

    const relleno = document.querySelector<HTMLElement>('.respiracion__barra-relleno');

    expect(parseFloat(relleno?.style.width ?? '0')).toBeGreaterThan(0);
  });

  it('si la duracion no es un multiplo del ciclo, dura hasta cerrar el ciclo mas cercano', async () => {
    // 65 s son 6,5 ciclos de 10 s: se redondea a 7, que son 70 s. Nunca termina a mitad de una exhalacion.
    pintar({ ...CUATRO_SEIS, duracionSegundos: 65 });
    await empezar();

    expect(screen.getByText('Quedan 1:10')).toBeInTheDocument();

    adelantar(69_700);
    expect(screen.queryByText('Gracias por darte este rato.')).not.toBeInTheDocument();

    adelantar(500);
    expect(screen.getByText('Gracias por darte este rato.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar.mock.calls[0]?.[0]).toEqual({
      metadata: { segundos: 70, ciclos: 7, completa: true },
    });
  });

  it('las frases de la sesion acompanan, una por ciclo, y vuelven a empezar al acabarse', async () => {
    pintar();
    await empezar();

    expect(screen.getByText('Sin prisa.')).toBeInTheDocument();

    adelantar(10_200);
    expect(screen.getByText('Deja que el aire entre y salga a tu ritmo.')).toBeInTheDocument();

    adelantar(10_000);
    expect(screen.getByText('Un poco más suave.')).toBeInTheDocument();

    adelantar(10_000);
    expect(screen.getByText('Sin prisa.')).toBeInTheDocument();
  });

  it('sin frases en la sesion, hay una de siempre: la mascota nunca se queda callada', async () => {
    pintar({ ...CUATRO_SEIS, frases: [] });
    await empezar();

    expect(screen.getByText('Sin prisa.')).toBeInTheDocument();
  });

  it('lleva la ambientacion de la sesion, para que cada una se vea a su manera', () => {
    pintar();

    expect(document.querySelector('.respiracion')).toHaveAttribute('data-ambientacion', 'bosque');
  });

  it('sin ambientacion, no inventa una', () => {
    const { ambientacion: _quitada, ...sin } = CUATRO_SEIS;

    pintar(sin);

    expect(document.querySelector('.respiracion')).not.toHaveAttribute('data-ambientacion');
  });
});

describe('la vibracion suave', () => {
  const vibrar = vi.fn();

  beforeEach(() => {
    vibrar.mockClear();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrar });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('con la sesion que la pide, vibra al empezar y al cambiar de etapa', async () => {
    pintar({ ...CUATRO_SEIS, haptico: true });
    await empezar();

    expect(vibrar).toHaveBeenCalledTimes(1);

    adelantar(4200);
    expect(vibrar).toHaveBeenCalledTimes(2);

    adelantar(6000);
    expect(vibrar).toHaveBeenCalledTimes(3);
  });

  it('antes de empezar no vibra: no hay etapa que cambiar', () => {
    pintar({ ...CUATRO_SEIS, haptico: true });

    expect(vibrar).not.toHaveBeenCalled();
  });

  it('es suave: una vibracion corta, de 30 ms', async () => {
    pintar({ ...CUATRO_SEIS, haptico: true });
    await empezar();

    expect(vibrar).toHaveBeenCalledWith(30);
  });

  it('al terminar no vibra: acabar no es un cambio de etapa', async () => {
    pintar({ ...CUATRO_SEIS, haptico: true });
    await empezar();

    expect(vibrar).toHaveBeenCalledTimes(1);

    // De un solo salto, como una pestana dormida que despierta al final.
    adelantar(60_200);

    expect(screen.getByText('Gracias por darte este rato.')).toBeInTheDocument();
    expect(vibrar).toHaveBeenCalledTimes(1);
  });

  it('no vibra mientras la etapa sigue: una vez por cambio, no por segundo', async () => {
    pintar({ ...CUATRO_SEIS, haptico: true });
    await empezar();

    adelantar(3000);

    expect(vibrar).toHaveBeenCalledTimes(1);
  });

  it('sin que la sesion la pida, nunca vibra', async () => {
    pintar({ ...CUATRO_SEIS, haptico: false });
    await empezar();
    adelantar(25_000);

    expect(vibrar).not.toHaveBeenCalled();
  });

  it('con menos movimiento pedido en el telefono, no vibra aunque la sesion lo pida', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    pintar({ ...CUATRO_SEIS, haptico: true });
    await empezar();
    adelantar(5000);

    expect(vibrar).not.toHaveBeenCalled();
  });
});

describe('el reloj', () => {
  it('solo corre mientras se respira: ni antes de empezar ni despues de terminar', async () => {
    pintar();
    const enReposo = vi.getTimerCount();

    await empezar();
    expect(vi.getTimerCount()).toBeGreaterThan(enReposo);

    adelantar(60_200);
    expect(vi.getTimerCount()).toBe(enReposo);
  });

  it('al parar se detiene', async () => {
    pintar();
    const enReposo = vi.getTimerCount();

    await empezar();
    await usuario.click(screen.getByRole('button', { name: 'Parar' }));

    expect(vi.getTimerCount()).toBe(enReposo);
  });

  it('al salir de la pantalla se limpia: no queda nada contando', async () => {
    const { unmount } = pintar();
    const enReposo = vi.getTimerCount();

    await empezar();
    unmount();

    expect(vi.getTimerCount()).toBeLessThanOrEqual(enReposo);
  });
});

describe('parar y terminar', () => {
  it('siempre hay un boton para parar, que se puede pulsar en cualquier momento', async () => {
    pintar();
    await empezar();

    expect(screen.getByRole('button', { name: 'Parar' })).toBeEnabled();

    adelantar(15_000);
    expect(screen.getByRole('button', { name: 'Parar' })).toBeEnabled();
  });

  it('antes de empezar no hay nada que parar', () => {
    pintar();

    expect(screen.queryByRole('button', { name: 'Parar' })).not.toBeInTheDocument();
  });

  it('al parar, agradece igual y se registra que se hizo, con lo que duro y sin puntaje', async () => {
    pintar();
    await empezar();
    adelantar(24_000);

    await usuario.click(screen.getByRole('button', { name: 'Parar' }));

    expect(screen.getByText('Gracias por darte este rato.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledTimes(1);

    const entregado = alTerminar.mock.calls[0]?.[0] as {
      score?: number;
      metadata: { segundos: number; ciclos: number; completa: boolean };
    };

    // La actividad no se valora: mandar un puntaje seria un error.
    expect(entregado).not.toHaveProperty('score');
    // Lleva 24 s: dos ciclos hechos y el tercero a medias, que no cuenta.
    expect(entregado.metadata).toEqual({ segundos: 24, ciclos: 2, completa: false });
  });

  it('los segundos que se registran al parar son enteros', async () => {
    pintar();
    await empezar();
    // El reloj marca 24,25 s: se registran 24, no 24,25.
    adelantar(24_400);

    await usuario.click(screen.getByRole('button', { name: 'Parar' }));
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    const { segundos } = (alTerminar.mock.calls[0]?.[0] as { metadata: { segundos: number } })
      .metadata;

    expect(Number.isInteger(segundos)).toBe(true);
    expect(segundos).toBe(24);
  });

  it('terminada, el circulo vuelve a su reposo', async () => {
    pintar();
    await empezar();
    adelantar(60_200);

    const circulo = document.querySelector<HTMLElement>('.respiracion__circulo');

    expect(circulo?.dataset.etapa).toBe('reposo');
    expect(circulo?.style.getPropertyValue('--escala')).toBe('0.55');
    expect(laPalabra()).toBe('');
    expect(laCuenta()).toBe('');
  });

  it('al llegar al final, agradece y nunca dice que se respiro bien o mal', async () => {
    pintar();
    await empezar();
    adelantar(60_200);

    expect(screen.getByText('Gracias por darte este rato.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/muy bien|perfecto|bravo|correcto|incorrecto/i);
    expect(screen.queryByRole('button', { name: 'Parar' })).not.toBeInTheDocument();
  });

  it('terminada, se registra completa: los ciclos y los segundos de la sesion', async () => {
    pintar();
    await empezar();
    adelantar(60_200);

    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toEqual({
      metadata: { segundos: 60, ciclos: 6, completa: true },
    });
  });

  it('el reloj se detiene al terminar: no sigue contando nada', async () => {
    pintar();
    await empezar();
    adelantar(60_200);

    expect(document.querySelector('.respiracion__circulo')).not.toBeNull();

    adelantar(30_000);
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(
      (alTerminar.mock.calls[0]?.[0] as { metadata: { segundos: number } }).metadata.segundos,
    ).toBe(60);
  });

  it('pulsar «Terminar» dos veces entrega el resultado una sola vez', async () => {
    pintar();
    await empezar();
    adelantar(60_200);

    const terminar = screen.getByRole('button', { name: 'Terminar' });

    await usuario.click(terminar);
    await usuario.click(terminar);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('mientras se guarda, el boton lo dice y no se puede pulsar', async () => {
    pintar(CUATRO_SEIS, true);
    await empezar();
    adelantar(60_200);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('se puede parar al instante de empezar: cero ciclos, y se registra igual', async () => {
    pintar();
    await empezar();
    await usuario.click(screen.getByRole('button', { name: 'Parar' }));
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar.mock.calls[0]?.[0]).toMatchObject({
      metadata: { ciclos: 0, completa: false },
    });
  });
});
