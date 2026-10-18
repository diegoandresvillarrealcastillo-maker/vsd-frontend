import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { CARTA, CIERRE_DEL_DIA } from '../../../pruebas/sesionesDeBienestar.ts';
import { sesionDeCognicion } from '../../../pruebas/sesionesDeCognicion.ts';
import { EscrituraBreve } from './EscrituraBreve.tsx';

/**
 * Lo que suma SCRUM-227 a la escritura breve (motor `escritura_breve`, ADR 0030): `etiquetas` (lo que pide cada
 * campo), `textoNinguna` (lo que dice el boton de «hoy no»), `cierre` (lo que se dice al terminar) y
 * `guardarParaManana` (la carta de EMO-05, que se guarda tambien como una entrada del diario).
 *
 * Todo es opcional: las sesiones de antes siguen valiendo y se comportan igual (`EscrituraBreve.spec.tsx`).
 */
vi.setConfig({ testTimeout: 20_000 });

const { guardarLaCartaEnElDiario } = vi.hoisted(() => ({ guardarLaCartaEnElDiario: vi.fn() }));

// La carta va al diario por la cola de siempre (`cartaEnElDiario.spec.ts`); aqui solo se mira que se pida.
vi.mock('../cartaEnElDiario.ts', () => ({ guardarLaCartaEnElDiario }));

const alTerminar = vi.fn();
const usuario = userEvent.setup({ delay: null });

const TRES_COSAS = {
  invitacion: 'Algo que probaste hoy.',
  campos: 3,
  minimo: 1,
  largoMaximo: 200,
  permiteNingunaHoy: true,
};

function pintar(parametros: Record<string, unknown>) {
  return render(
    <EscrituraBreve
      alTerminar={alTerminar}
      enviando={false}
      sesion={sesionDeCognicion(parametros)}
    />,
  );
}

function terminar() {
  return usuario.click(screen.getByRole('button', { name: 'Terminar' }));
}

afterEach(() => {
  cleanup();
  alTerminar.mockClear();
  guardarLaCartaEnElDiario.mockReset();
});

describe('etiquetas (EMO-09, «El cierre del dia»)', () => {
  it('cada campo dice lo que pide, a la vista, y ese texto es su nombre', () => {
    pintar(CIERRE_DEL_DIA);

    expect(screen.getByRole('textbox', { name: 'Lo que dejo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Lo que me llevo' })).toBeInTheDocument();
    expect(screen.getByText('Lo que dejo')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: /Respuesta \d de 2/ })).not.toBeInTheDocument();
  });

  it('sin etiquetas, los campos se llaman como siempre', () => {
    pintar(TRES_COSAS);

    expect(screen.getByRole('textbox', { name: 'Respuesta 1 de 3' })).toBeInTheDocument();
    expect(screen.queryByText('Lo que dejo')).not.toBeInTheDocument();
  });

  it('se manda lo escrito en el orden de los campos, y los vacios no se mandan', async () => {
    pintar({ ...CIERRE_DEL_DIA, cierre: undefined });

    await usuario.type(screen.getByRole('textbox', { name: 'Lo que me llevo' }), 'Una caminata');
    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: { encontroUno: true, textos: ['Una caminata'] },
    });
  });
});

describe('«hoy no» con su propio texto (EMO-09)', () => {
  it('el boton dice lo que dice la sesion', () => {
    pintar(CIERRE_DEL_DIA);

    expect(
      screen.getByRole('button', { name: 'Hoy lo dejo todo para mañana' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Hoy no me sale ninguna' }),
    ).not.toBeInTheDocument();
  });

  it('sin texto propio dice lo de siempre', () => {
    pintar(TRES_COSAS);

    expect(screen.getByRole('button', { name: 'Hoy no me sale ninguna' })).toBeInTheDocument();
  });

  it('se registra igual que «hoy no me sale ninguna»: sin textos', async () => {
    pintar({ ...CIERRE_DEL_DIA, cierre: undefined });

    await usuario.click(screen.getByRole('button', { name: 'Hoy lo dejo todo para mañana' }));

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({ metadata: { encontroUno: false } });
  });
});

describe('cierre', () => {
  it('al terminar lo dice con la mascota y recien entonces entrega', async () => {
    pintar(CIERRE_DEL_DIA);

    await usuario.type(screen.getByRole('textbox', { name: 'Lo que dejo' }), 'La prisa');
    await terminar();

    expect(screen.getByText('Día cerrado. Gracias por contarlo.')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await terminar();

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: { encontroUno: true, textos: ['La prisa'] },
    });
  });

  it('«hoy no» tambien pasa por el cierre', async () => {
    pintar(CIERRE_DEL_DIA);

    await usuario.click(screen.getByRole('button', { name: 'Hoy lo dejo todo para mañana' }));

    expect(screen.getByText('Día cerrado. Gracias por contarlo.')).toBeInTheDocument();
    expect(alTerminar).not.toHaveBeenCalled();

    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({ metadata: { encontroUno: false } });
  });

  it('las sesiones de antes, sin cierre, entregan al momento como siempre', async () => {
    pintar(TRES_COSAS);

    await usuario.type(screen.getByRole('textbox', { name: 'Respuesta 1 de 3' }), 'Algo');
    await terminar();

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('entrega una sola vez, aunque se pulse dos veces', async () => {
    pintar(CIERRE_DEL_DIA);

    await usuario.type(screen.getByRole('textbox', { name: 'Lo que dejo' }), 'La prisa');
    await terminar();

    const boton = screen.getByRole('button', { name: 'Terminar' });

    await usuario.click(boton);
    await usuario.click(boton);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });
});

describe('la carta que se guarda en el diario (EMO-05)', () => {
  const carta = () => screen.getByRole('textbox', { name: 'Respuesta' });

  it('al terminar la deja en el diario, entera, y despues entrega y dice lo que paso', async () => {
    guardarLaCartaEnElDiario.mockResolvedValue(undefined);
    pintar(CARTA);

    await usuario.type(carta(), 'Que mañana vaya con calma.');
    await terminar();

    expect(guardarLaCartaEnElDiario).toHaveBeenCalledWith('Que mañana vaya con calma.');
    expect(await screen.findByText('Quedó guardada en tu diario.')).toBeInTheDocument();

    await terminar();

    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({
      metadata: { encontroUno: true, textos: ['Que mañana vaya con calma.'] },
    });
  });

  it('no la guarda hasta que se termina, ni si no se escribio nada', async () => {
    pintar(CARTA);

    await usuario.type(carta(), 'Hola');

    expect(guardarLaCartaEnElDiario).not.toHaveBeenCalled();

    await usuario.clear(carta());
    await terminar();

    expect(guardarLaCartaEnElDiario).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe algo');
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('si no se pudo guardar en el equipo, lo escrito se conserva y se puede intentar de nuevo', async () => {
    guardarLaCartaEnElDiario.mockRejectedValueOnce(new Error('sin almacen'));
    pintar(CARTA);

    await usuario.type(carta(), 'Una carta importante');
    await terminar();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardarla en tu diario');
    expect(carta()).toHaveValue('Una carta importante');
    expect(alTerminar).not.toHaveBeenCalled();
    expect(screen.queryByText('Quedó guardada en tu diario.')).not.toBeInTheDocument();

    guardarLaCartaEnElDiario.mockResolvedValueOnce(undefined);
    await terminar();

    expect(await screen.findByText('Quedó guardada en tu diario.')).toBeInTheDocument();
    expect(guardarLaCartaEnElDiario).toHaveBeenCalledTimes(2);
  });

  it('sin `guardarParaManana` no toca el diario', async () => {
    pintar({ ...CARTA, guardarParaManana: undefined, cierre: undefined });

    await usuario.type(carta(), 'Hola');
    await terminar();

    expect(guardarLaCartaEnElDiario).not.toHaveBeenCalled();
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('«hoy no me sale ninguna» no deja nada en el diario', async () => {
    pintar({ ...CARTA, permiteNingunaHoy: true, cierre: undefined });

    await usuario.click(screen.getByRole('button', { name: 'Hoy no me sale ninguna' }));

    expect(guardarLaCartaEnElDiario).not.toHaveBeenCalled();
    expect(alTerminar.mock.calls[0]?.[0]).toStrictEqual({ metadata: { encontroUno: false } });
  });

  it('el cierre no promete lo que no pasa: habla del diario, no de que reaparezca ni de borrarla', () => {
    expect(CARTA.cierre).not.toMatch(/ma[ñn]ana|aparecer|borr|devolver/i);
  });

  it('una sesion con la carta en varios campos no se entiende', () => {
    pintar({ ...CARTA, campos: 2 });

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });
});

describe('accesibilidad con axe', () => {
  it('con etiquetas, en el cierre y con la carta', async () => {
    pintar(CIERRE_DEL_DIA);
    expect(await fallosDeAccesibilidad()).toEqual([]);

    await usuario.type(screen.getByRole('textbox', { name: 'Lo que dejo' }), 'La prisa');
    await terminar();
    expect(await fallosDeAccesibilidad()).toEqual([]);

    cleanup();
    pintar(CARTA);
    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});

describe('leerEscrituraBreve con lo nuevo', () => {
  it('rechaza etiquetas que no son una por campo o que se repiten', () => {
    pintar({ ...CIERRE_DEL_DIA, etiquetas: ['Una sola'] });
    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();

    cleanup();
    pintar({ ...CIERRE_DEL_DIA, etiquetas: ['Igual', ' igual '] });
    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });

  it('rechaza un texto de «hoy no» si la sesion no lo permite', () => {
    pintar({ ...CIERRE_DEL_DIA, permiteNingunaHoy: false });

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });

  it('rechaza un cierre que no es texto', () => {
    pintar({ ...CIERRE_DEL_DIA, cierre: 5 });

    expect(screen.getByText(/necesita la sesión de hoy/)).toBeInTheDocument();
  });
});
