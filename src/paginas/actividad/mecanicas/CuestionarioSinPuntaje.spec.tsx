import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReglasLocales } from '../../../infraestructura/api/reglasLocales.ts';
import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import {
  GESTOS,
  PREGUNTAS,
  PREGUNTAS_CON_AYUDA,
  RUEDA,
  TARJETA,
} from '../../../pruebas/sesionesDeBienestar.ts';
import { sesionDeCognicion } from '../../../pruebas/sesionesDeCognicion.ts';
import { GestosDelDia } from './GestosDelDia.tsx';
import { PreguntasDelDia } from './PreguntasDelDia.tsx';
import type { PropsDeMecanica } from './registro.tsx';
import { RuedaDeEmociones } from './RuedaDeEmociones.tsx';
import { TarjetaDelDia } from './TarjetaDelDia.tsx';

/**
 * El cuestionario corto sin puntaje (SCRUM-227, ADR 0030): la tarjeta del dia, los gestos, las preguntas y la
 * rueda de emociones, con la sesion que manda el servidor y sin tocar la red.
 *
 * Lo que se protege: que nada puntue ni se interprete (R7) ni se mande un `score`, que ninguna respuesta se
 * premie ni se corrija, que lo que dice la mascota no dependa de lo que se contesto, que se pueda terminar sin
 * contestar todo, que la linea libre no se guarde en el navegador y que las lineas de atencion esten a mano.
 */
vi.setConfig({ testTimeout: 20_000 });

const { useReglasLocales } = vi.hoisted(() => ({
  useReglasLocales: vi.fn<() => ReglasLocales | null>(),
}));

vi.mock('../../../asistente/useReglasLocales.ts', () => ({ useReglasLocales }));

const alTerminar = vi.fn();
const usuario = userEvent.setup({ delay: null });

type Pantalla = (props: PropsDeMecanica) => React.JSX.Element;

function pintar(pantalla: Pantalla, parametros: Record<string, unknown>, enviando = false) {
  const Motor = pantalla;

  return render(
    <Motor alTerminar={alTerminar} enviando={enviando} sesion={sesionDeCognicion(parametros)} />,
  );
}

async function pulsar(nombre: string | RegExp) {
  await usuario.click(screen.getByRole('button', { name: nombre }));
}

function entregado() {
  expect(alTerminar).toHaveBeenCalledTimes(1);

  return alTerminar.mock.calls[0]?.[0] as { score?: number; metadata: Record<string, unknown> };
}

/** Lo que dice la mascota ahora: el globo que anuncia con `aria-live`. */
function loQueDiceLaMascota(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? '';
}

beforeEach(() => {
  useReglasLocales.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  alTerminar.mockClear();
  useReglasLocales.mockReset();
});

describe.each([
  ['La tarjeta del dia', TarjetaDelDia],
  ['Los gestos del dia', GestosDelDia],
  ['Las preguntas del dia', PreguntasDelDia],
  ['La rueda de emociones', RuedaDeEmociones],
] as const)('%s, sin una sesion que entienda', (_nombre, Motor) => {
  it.each([
    ['sin sesion', undefined],
    ['con parametros vacios', sesionDeCognicion({})],
    [
      'con un cuestionario con puntaje (sin modo)',
      sesionDeCognicion({ indicacion: 'Hola', preguntas: [], opciones: [] }),
    ],
  ])('%s: lo dice, y no hay nada que contestar', (_caso, sesion) => {
    render(<Motor alTerminar={alTerminar} enviando={false} sesion={sesion} />);

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// tarjeta
// ---------------------------------------------------------------------------

describe('La tarjeta del dia', () => {
  it('muestra la practica, su indicacion y la nota, y el «por que» queda cerrado', () => {
    pintar(TarjetaDelDia, TARJETA);

    expect(screen.getByText('Una práctica pequeña para hoy.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Apagar las pantallas un rato antes de dormir' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Prueba dejar el teléfono lejos de la cama/)).toBeInTheDocument();
    expect(screen.getByText('Cualquiera de las tres está bien.')).toBeInTheDocument();

    const porQue = screen.getByText('¿Por qué?').closest('details');

    expect(porQue).not.toHaveAttribute('open');
  });

  it('el «por que» se abre si se quiere', async () => {
    pintar(TarjetaDelDia, TARJETA);
    await usuario.click(screen.getByText('¿Por qué?'));

    expect(screen.getByText('¿Por qué?').closest('details')).toHaveAttribute('open');
  });

  it('sin «por que» no hay desplegable', () => {
    const { porQue: _quitado, ...sin } = TARJETA;

    pintar(TarjetaDelDia, sin);

    expect(screen.queryByText('¿Por qué?')).not.toBeInTheDocument();
  });

  it('ofrece las tres respuestas sin ninguna marcada, y espera a que se elija una', () => {
    pintar(TarjetaDelDia, TARJETA);

    const respuestas = within(
      screen.getByRole('radiogroup', { name: 'Tu respuesta' }),
    ).getAllByRole('radio');

    expect(respuestas.map((r) => (r as HTMLInputElement).checked)).toEqual([false, false, false]);
    expect(screen.getByRole('button', { name: 'Listo' })).toBeDisabled();
    expect(screen.getByText('Elige una respuesta para continuar.')).toBeInTheDocument();
  });

  it('las tres respuestas cuentan igual: la mascota dice lo mismo elijas lo que elijas', async () => {
    pintar(TarjetaDelDia, TARJETA);

    await usuario.click(screen.getByRole('radio', { name: 'Lo probé hoy' }));
    const siProbo = loQueDiceLaMascota();

    await usuario.click(screen.getByRole('radio', { name: 'Hoy no quise' }));
    const noQuiso = loQueDiceLaMascota();

    expect(siProbo).not.toBe('');
    expect(noQuiso).toBe(siProbo);
  });

  it('se puede cambiar de respuesta antes de terminar', async () => {
    pintar(TarjetaDelDia, TARJETA);
    await usuario.click(screen.getByRole('radio', { name: 'Lo probé hoy' }));
    await usuario.click(screen.getByRole('radio', { name: 'Lo pruebo otro día' }));

    expect(screen.getByRole('radio', { name: 'Lo pruebo otro día' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Lo probé hoy' })).not.toBeChecked();
  });

  it('con cierre, «Listo» lo muestra y recien «Terminar» entrega: la respuesta, y nunca un puntaje', async () => {
    pintar(TarjetaDelDia, TARJETA);
    await usuario.click(screen.getByRole('radio', { name: 'Lo pruebo otro día' }));
    await pulsar('Listo');

    expect(screen.getByText('Gracias por contarlo.')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();

    await pulsar('Terminar');

    expect(entregado().score).toBeUndefined();
    expect(entregado().metadata).toEqual({ respuesta: 'luego' });
  });

  it('sin cierre, «Listo» entrega al momento', async () => {
    const { cierre: _quitado, ...sin } = TARJETA;

    pintar(TarjetaDelDia, sin);
    await usuario.click(screen.getByRole('radio', { name: 'Hoy no quise' }));
    await pulsar('Listo');

    expect(entregado().metadata).toEqual({ respuesta: 'no' });
  });

  it('entrega una sola vez, aunque se pulse dos veces', async () => {
    pintar(TarjetaDelDia, TARJETA);
    await usuario.click(screen.getByRole('radio', { name: 'Hoy no quise' }));
    await pulsar('Listo');

    const terminar = screen.getByRole('button', { name: 'Terminar' });

    await usuario.click(terminar);
    await usuario.click(terminar);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('mientras se envia, el boton de terminar espera', async () => {
    const { rerender } = pintar(TarjetaDelDia, TARJETA);

    await usuario.click(screen.getByRole('radio', { name: 'Hoy no quise' }));
    await pulsar('Listo');
    rerender(
      <TarjetaDelDia alTerminar={alTerminar} enviando sesion={sesionDeCognicion(TARJETA)} />,
    );

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// lista
// ---------------------------------------------------------------------------

describe('Los gestos del dia', () => {
  it('muestra la indicacion, los gestos y la nota, todos sin marcar', () => {
    pintar(GestosDelDia, GESTOS);

    expect(screen.getByText('Antes de dormir, marca los que hagas hoy.')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(
      true,
    );
    expect(screen.getByText('Marcar ninguno también cuenta.')).toBeInTheDocument();
  });

  it('se termina con «Listo» aunque no se marque ninguno: un dia sin ninguno es un dia', async () => {
    const { cierre: _quitado, ...sinCierre } = GESTOS;

    pintar(GestosDelDia, sinCierre);

    expect(screen.getByRole('button', { name: 'Listo' })).toBeEnabled();

    await pulsar('Listo');

    expect(entregado().score).toBeUndefined();
    expect(entregado().metadata).toEqual({ marcados: [] });
  });

  it('entrega lo marcado en el orden de la lista, no en el que se marco', async () => {
    const { cierre: _quitado, ...sinCierre } = GESTOS;

    pintar(GestosDelDia, sinCierre);
    await usuario.click(screen.getByRole('checkbox', { name: 'Dejar el teléfono lejos' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Bajar las luces' }));
    await pulsar('Listo');

    expect(entregado().metadata).toEqual({ marcados: ['luz', 'pantalla'] });
  });

  it('se puede desmarcar', async () => {
    const { cierre: _quitado, ...sinCierre } = GESTOS;

    pintar(GestosDelDia, sinCierre);
    await usuario.click(screen.getByRole('checkbox', { name: 'Bajar las luces' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Bajar las luces' }));
    await pulsar('Listo');

    expect(entregado().metadata).toEqual({ marcados: [] });
  });

  it('con cierre, lo dice antes de entregar', async () => {
    pintar(GestosDelDia, GESTOS);
    await usuario.click(screen.getByRole('checkbox', { name: 'Tomar un poco de agua' }));
    await pulsar('Listo');

    expect(screen.getByText('Que descanses.')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();

    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({ marcados: ['agua'] });
  });
});

// ---------------------------------------------------------------------------
// preguntas
// ---------------------------------------------------------------------------

describe('Las preguntas del dia', () => {
  const hora = () => screen.getByLabelText('Hora');

  it('la primera es la de la hora: con el campo del dispositivo, su pista y la indicacion', () => {
    pintar(PreguntasDelDia, PREGUNTAS);

    expect(
      screen.getByRole('heading', { name: '¿A qué hora piensas dormir?' }),
    ).toBeInTheDocument();
    expect(hora()).toHaveAttribute('type', 'time');
    expect(screen.getByText('Una hora aproximada.')).toBeInTheDocument();
    expect(screen.getByText('Tres preguntas cortas sobre mañana.')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 de 3')).toBeInTheDocument();
  });

  it('«Continuar» espera a que haya una hora, y «Saltar» siempre esta', () => {
    pintar(PreguntasDelDia, PREGUNTAS);

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saltar' })).toBeEnabled();

    fireEvent.change(hora(), { target: { value: '22:30' } });

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('saltar una pregunta lleva a la siguiente sin contestar', async () => {
    pintar(PreguntasDelDia, PREGUNTAS);
    await pulsar('Saltar');

    expect(
      await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pregunta 2 de 3')).toBeInTheDocument();
  });

  it('una pregunta de una opcion pide elegir una', async () => {
    pintar(PreguntasDelDia, PREGUNTAS);
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await usuario.click(screen.getByRole('radio', { name: 'Con calma' }));

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('una pregunta de varias se puede seguir sin marcar ninguna, y dice que ninguna esta bien', async () => {
    pintar(PreguntasDelDia, PREGUNTAS);
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });

    expect(screen.getByText('Elige las que quieras, o ninguna.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeEnabled();
  });

  it('se puede volver atras sin perder lo contestado', async () => {
    pintar(PreguntasDelDia, PREGUNTAS);
    fireEvent.change(hora(), { target: { value: '23:00' } });
    await pulsar('Continuar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Atrás');
    await screen.findByRole('heading', { name: '¿A qué hora piensas dormir?' });

    expect(hora()).toHaveValue('23:00');
  });

  it('el aviso de la noche y la nota solo salen en la ultima pregunta, y el enlace abre otra pestana', async () => {
    pintar(PreguntasDelDia, PREGUNTAS);

    expect(screen.queryByText('Nada de esto se interpreta.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ir a mi perfil/ })).not.toBeInTheDocument();

    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });

    const enlace = screen.getByRole('link', { name: /Ir a mi perfil/ });

    expect(enlace).toHaveAttribute('href', '/perfil');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('Nada de esto se interpreta.')).toBeInTheDocument();
  });

  it('sin `enlaceAlAviso` no se ofrece ir al perfil', async () => {
    pintar(PreguntasDelDia, { ...PREGUNTAS, enlaceAlAviso: false });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });

    expect(screen.queryByRole('link', { name: /Ir a mi perfil/ })).not.toBeInTheDocument();
  });

  it('entrega lo contestado por clave, con las de varias en el orden de las opciones, y nunca un puntaje', async () => {
    pintar(PreguntasDelDia, { ...PREGUNTAS, cierre: undefined });
    fireEvent.change(hora(), { target: { value: '22:30' } });
    await pulsar('Continuar');
    await usuario.click(await screen.findByRole('radio', { name: 'Con calma' }));
    await pulsar('Continuar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });
    await usuario.click(screen.getByRole('checkbox', { name: 'Música suave' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Silencio' }));
    await pulsar('Terminar');

    expect(entregado().score).toBeUndefined();
    expect(entregado().metadata).toEqual({
      respuestas: { hora: '22:30', como: 'tranquilo', ayudas: ['silencio', 'musica'] },
    });
  });

  it('lo saltado no se manda: ni vacio ni como lista vacia', async () => {
    pintar(PreguntasDelDia, { ...PREGUNTAS, cierre: undefined });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });
    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({ respuestas: {} });
  });

  it('saltar una pregunta ya contestada, tras volver atras, borra lo que habia', async () => {
    pintar(PreguntasDelDia, { ...PREGUNTAS, cierre: undefined });
    fireEvent.change(hora(), { target: { value: '22:30' } });
    await pulsar('Continuar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Atrás');
    await screen.findByRole('heading', { name: '¿A qué hora piensas dormir?' });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });
    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({ respuestas: {} });
  });

  it('desmarcar todas las de «varias» es dejarla sin responder', async () => {
    pintar(PreguntasDelDia, {
      ...PREGUNTAS,
      cierre: undefined,
      preguntas: [PREGUNTAS.preguntas[2]],
    });
    await usuario.click(screen.getByRole('checkbox', { name: 'Silencio' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Silencio' }));
    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({ respuestas: {} });
  });

  it('con cierre lo dice al terminar, antes de entregar', async () => {
    pintar(PreguntasDelDia, { ...PREGUNTAS, preguntas: [PREGUNTAS.preguntas[2]] });
    await usuario.click(screen.getByRole('checkbox', { name: 'Oscuridad' }));
    await pulsar('Terminar');

    expect(screen.getByText('Gracias por contarlo.')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();

    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({ respuestas: { ayudas: ['oscuridad'] } });
  });

  describe('con el aviso de siempre y las lineas de atencion (EMO-08)', () => {
    it('la frase queda a la vista en todas las preguntas', async () => {
      pintar(PreguntasDelDia, PREGUNTAS_CON_AYUDA);

      expect(
        screen.getByText('Si lo necesitas, hay personas que pueden acompañarte.'),
      ).toBeInTheDocument();

      await pulsar('Saltar');
      await screen.findByRole('heading', { name: '¿Quieres hablar con alguien hoy?' });

      expect(
        screen.getByText('Si lo necesitas, hay personas que pueden acompañarte.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Líneas de atención' })).toBeInTheDocument();
    });

    it('abren las lineas, con el respaldo si todavia no hay reglas locales', async () => {
      pintar(PreguntasDelDia, PREGUNTAS_CON_AYUDA);
      await pulsar('Líneas de atención');

      expect(
        screen.getByRole('heading', { name: 'Si te sirve hablarlo con alguien' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Ocultar las líneas de atención' }),
      ).toHaveAttribute('aria-expanded', 'true');
    });

    it('sin la sesion pidiendolo no hay acceso a las lineas', () => {
      pintar(PreguntasDelDia, PREGUNTAS);

      expect(screen.queryByRole('button', { name: /Líneas de atención/ })).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// rueda
// ---------------------------------------------------------------------------

describe('La rueda de emociones', () => {
  async function aLaEmocion(...nombres: string[]) {
    pintar(RuedaDeEmociones, RUEDA);
    await pulsar('Empezar');

    for (const nombre of nombres) {
      await usuario.click(screen.getByRole('button', { name: nombre }));
    }
  }

  it('empieza con una puerta que explica que no hay respuestas correctas', () => {
    pintar(RuedaDeEmociones, RUEDA);

    expect(screen.getByRole('heading', { name: 'Ponerle nombre' })).toBeInTheDocument();
    expect(screen.getByText(/No hay respuestas correctas/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alegría' })).not.toBeInTheDocument();
  });

  it('el primer nivel son los circulos grandes, y ahi no hay «Atras»', async () => {
    pintar(RuedaDeEmociones, RUEDA);
    await pulsar('Empezar');

    expect(
      screen.getByRole('heading', { name: '¿Cuál se parece más a lo que sientes?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alegría' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tristeza' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Por dónde vas' })).not.toBeInTheDocument();
  });

  it('se baja de lo amplio a lo fino y la ruta recorrida se lee completa', async () => {
    await aLaEmocion('Alegría', 'Serenidad');

    expect(
      screen.getByRole('heading', { name: 'Más fino, dentro de «Serenidad»' }),
    ).toBeInTheDocument();

    const ruta = within(screen.getByRole('navigation', { name: 'Por dónde vas' })).getAllByRole(
      'listitem',
    );

    expect(ruta.map((paso) => paso.textContent)).toEqual(['Alegría', 'Serenidad']);
    expect(ruta[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Calma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alivio' })).toBeInTheDocument();
  });

  it('«Atras» sube un nivel', async () => {
    await aLaEmocion('Alegría', 'Serenidad');
    await pulsar('Atrás');

    expect(
      screen.getByRole('heading', { name: 'Más fino, dentro de «Alegría»' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entusiasmo' })).toBeInTheDocument();
  });

  it('una emocion se lee con su definicion y se confirma con «Esta es»', async () => {
    await aLaEmocion('Alegría', 'Serenidad', 'Alivio');

    expect(screen.getByRole('heading', { name: 'Alivio' })).toBeInTheDocument();
    expect(screen.getByText('Alivio: sentir que algo pesado ya pasó.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esta es' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir otra' })).toBeInTheDocument();
  });

  it('«Elegir otra» vuelve a las emociones del nivel, sin perder la ruta', async () => {
    await aLaEmocion('Tristeza', 'Soledad', 'Vacío');
    await pulsar('Elegir otra');

    expect(screen.getByRole('button', { name: 'Nostalgia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vacío' })).toBeInTheDocument();
  });

  it('lo que dice la mascota no depende de la emocion: es lo mismo en una y en otra', async () => {
    await aLaEmocion('Alegría', 'Serenidad');
    const enLaAlegria = loQueDiceLaMascota();

    cleanup();
    await aLaEmocion('Tristeza', 'Soledad');

    expect(loQueDiceLaMascota()).toBe(enLaAlegria);
  });

  it('con una linea opcional, «Esta es» la ofrece y se puede terminar sin escribir nada', async () => {
    await aLaEmocion('Alegría', 'Serenidad', 'Calma');
    await pulsar('Esta es');

    expect(screen.getByLabelText('Si quieres, cuéntalo en una línea.')).toHaveAttribute(
      'maxlength',
      '160',
    );
    expect(screen.getByText('Es opcional: puedes terminar sin escribir nada.')).toBeInTheDocument();

    await pulsar('Terminar');

    expect(screen.getByText('Ponerle nombre ayuda a verlo. Gracias.')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();

    await pulsar('Terminar');

    expect(entregado().score).toBeUndefined();
    expect(entregado().metadata).toEqual({ emocion: 'calma', camino: ['alegria', 'serenidad'] });
  });

  it('la linea escrita viaja en la peticion, recortada, y no se guarda en el navegador', async () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem');

    await aLaEmocion('Tristeza', 'Cansancio', 'Desgano');
    await pulsar('Esta es');
    await usuario.type(
      screen.getByLabelText('Si quieres, cuéntalo en una línea.'),
      '  Un día largo  ',
    );
    await pulsar('Terminar');
    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({
      emocion: 'desgano',
      camino: ['tristeza', 'cansancio'],
      linea: 'Un día largo',
    });
    expect(guardar.mock.calls.some(([, valor]) => String(valor).includes('Un día largo'))).toBe(
      false,
    );
  });

  it('sin linea, «Esta es» pasa al cierre directamente', async () => {
    const { linea: _quitada, ...sinLinea } = RUEDA;

    pintar(RuedaDeEmociones, sinLinea);
    await pulsar('Empezar');
    await usuario.click(screen.getByRole('button', { name: 'Alegría' }));
    await usuario.click(screen.getByRole('button', { name: 'Entusiasmo' }));
    await usuario.click(screen.getByRole('button', { name: 'Orgullo' }));
    await pulsar('Esta es');

    expect(screen.getByText('Ponerle nombre ayuda a verlo. Gracias.')).toBeInTheDocument();

    await pulsar('Terminar');

    expect(entregado().metadata).toEqual({ emocion: 'orgullo', camino: ['alegria', 'entusiasmo'] });
  });

  it('sin cierre entrega al confirmar', async () => {
    const { linea: _a, cierre: _b, ...sin } = RUEDA;

    pintar(RuedaDeEmociones, sin);
    await pulsar('Empezar');
    await usuario.click(screen.getByRole('button', { name: 'Tristeza' }));
    await usuario.click(screen.getByRole('button', { name: 'Soledad' }));
    await usuario.click(screen.getByRole('button', { name: 'Nostalgia' }));
    await pulsar('Esta es');

    expect(entregado().metadata).toEqual({ emocion: 'nostalgia', camino: ['tristeza', 'soledad'] });
  });
});

// ---------------------------------------------------------------------------
// axe
// ---------------------------------------------------------------------------

describe('accesibilidad con axe', () => {
  it('la tarjeta, con el por que abierto y con una respuesta elegida', async () => {
    pintar(TarjetaDelDia, TARJETA);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await usuario.click(screen.getByText('¿Por qué?'));
    await usuario.click(screen.getByRole('radio', { name: 'Hoy no quise' }));
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('los gestos y su cierre', async () => {
    pintar(GestosDelDia, GESTOS);
    await usuario.click(screen.getByRole('checkbox', { name: 'Bajar las luces' }));
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Listo');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('las preguntas en sus tres tipos, con las lineas abiertas', async () => {
    pintar(PreguntasDelDia, PREGUNTAS);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Cómo quieres despertar?' });
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Saltar');
    await screen.findByRole('heading', { name: '¿Qué te ayudaría a descansar?' });
    expect(await fallosDeAccesibilidad()).toEqual([]);

    cleanup();
    pintar(PreguntasDelDia, PREGUNTAS_CON_AYUDA);
    await pulsar('Líneas de atención');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });

  it('la rueda: la puerta, un nivel, una emocion y la linea', async () => {
    pintar(RuedaDeEmociones, RUEDA);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Empezar');
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await usuario.click(screen.getByRole('button', { name: 'Alegría' }));
    await usuario.click(screen.getByRole('button', { name: 'Serenidad' }));
    await usuario.click(screen.getByRole('button', { name: 'Calma' }));
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await pulsar('Esta es');
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
