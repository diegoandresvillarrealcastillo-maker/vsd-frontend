import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ComoDormisteAnoche } from './ComoDormisteAnoche.tsx';

/**
 * «Como dormiste anoche»: la bitacora que si puntua.
 *
 * El puntaje lo decide esta pantalla (el servidor tiene la misma escala y rechaza con 400
 * lo que no cuadre), asi que cada tramo se prueba con los valores que lo rodean: un
 * `>=` cambiado por `>` mueve a una persona de nivel sin que nada lo avise.
 */
const HORAS = '¿Cuántas horas dormiste?';
const DESPERTARES = '¿Cuántas veces te despertaste?';

const usuario = userEvent.setup({ delay: null });

function pintar(enviando = false) {
  const alTerminar = vi.fn();

  render(<ComoDormisteAnoche alTerminar={alTerminar} enviando={enviando} />);

  return alTerminar;
}

function poner(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByRole('spinbutton', { name: etiqueta }), {
    target: { value: valor },
  });
}

async function terminar(): Promise<void> {
  await usuario.click(screen.getByRole('button', { name: 'Terminar' }));
}

describe('lo que se guarda al terminar', () => {
  it('con las respuestas de partida manda 9 puntos y lo respondido tal cual', async () => {
    const alTerminar = pintar();

    await terminar();

    // 7 horas (4) + ningun despertar (3) + amanecer «normal» (2).
    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar).toHaveBeenCalledWith({
      score: 9,
      metadata: {
        horaDeAcostarse: '23:00',
        horasDormidas: 7,
        despertares: 0,
        comoAmaneciste: 'normal',
      },
    });
  });

  it('el dato es lo que la persona respondio, no el puntaje', async () => {
    const alTerminar = pintar();

    poner(HORAS, '5.5');
    poner(DESPERTARES, '2');
    await usuario.click(screen.getByRole('radio', { name: 'Cansado' }));
    await usuario.click(screen.getByRole('button', { name: '01:00' }));
    await terminar();

    expect(alTerminar).toHaveBeenCalledWith({
      score: 3,
      metadata: {
        horaDeAcostarse: '01:00',
        horasDormidas: 5.5,
        despertares: 2,
        comoAmaneciste: 'cansado',
      },
    });
  });
});

describe('cuanto suman las horas dormidas', () => {
  // Con 0 despertares (3) y amanecer «normal» (2), el total es lo de las horas mas 5.
  it.each([
    [0, 1],
    [4, 1],
    [4.5, 1],
    [5, 2],
    [5.5, 2],
    [6, 3],
    [6.5, 3],
    [7, 4],
    [8, 4],
    [9, 4],
    [9.5, 3],
    [10, 3],
    [10.5, 1],
    [24, 1],
  ])('%s horas suman %s', async (horas, suma) => {
    const alTerminar = pintar();

    poner(HORAS, String(horas));
    await terminar();

    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ score: suma + 5 }));
  });
});

describe('cuanto suman los despertares', () => {
  // Con 7 horas (4) y amanecer «normal» (2), el total es 6 mas lo de los despertares.
  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
    [20, 0],
  ])('%s despertares suman %s', async (veces, suma) => {
    const alTerminar = pintar();

    poner(DESPERTARES, String(veces));
    await terminar();

    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ score: 6 + suma }));
  });
});

describe('cuanto suma como amaneciste', () => {
  // Con 7 horas (4) y ningun despertar (3), el total es 7 mas lo del amanecer.
  it.each([
    ['Descansado', 3],
    ['Normal', 2],
    ['Cansado', 0],
  ])('%s suma %s', async (opcion, suma) => {
    const alTerminar = pintar();

    await usuario.click(screen.getByRole('radio', { name: opcion }));
    await terminar();

    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ score: 7 + suma }));
  });

  it('el mejor dia llega al maximo de 10 y no pasa de ahi', async () => {
    const alTerminar = pintar();

    await usuario.click(screen.getByRole('radio', { name: 'Descansado' }));
    await terminar();

    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ score: 10 }));
  });

  it('solo una opcion queda marcada a la vez', async () => {
    pintar();

    await usuario.click(screen.getByRole('radio', { name: 'Cansado' }));

    expect(screen.getByRole('radio', { name: 'Cansado' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Normal' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Descansado' })).not.toBeChecked();
  });
});

describe('la hora de acostarse', () => {
  it('parte de las 23:00', () => {
    pintar();

    expect(screen.getByLabelText('¿A qué hora te acostaste?')).toHaveValue('23:00');
    expect(screen.getByRole('button', { name: '23:00' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['21:00', '22:00', '00:00', '01:00'])(
    'el atajo de las %s la pone y es el unico marcado',
    async (hora) => {
      pintar();

      await usuario.click(screen.getByRole('button', { name: hora }));

      expect(screen.getByLabelText('¿A qué hora te acostaste?')).toHaveValue(hora);
      expect(screen.getByRole('button', { name: hora })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '23:00' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    },
  );

  it('tambien se puede escribir una hora que no tiene atajo', async () => {
    const alTerminar = pintar();

    fireEvent.change(screen.getByLabelText('¿A qué hora te acostaste?'), {
      target: { value: '23:45' },
    });
    await terminar();

    expect(alTerminar).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          horaDeAcostarse: '23:45',
          horasDormidas: 7,
          despertares: 0,
          comoAmaneciste: 'normal',
        },
      }),
    );
    expect(screen.getByRole('button', { name: '23:00' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('los contadores y lo que dice la mascota', () => {
  it('los botones mueven las horas de media en media hora', async () => {
    pintar();

    await usuario.click(screen.getByRole('button', { name: `Más: ${HORAS}` }));

    expect(screen.getByRole('spinbutton', { name: HORAS })).toHaveValue(7.5);

    await usuario.click(screen.getByRole('button', { name: `Menos: ${HORAS}` }));
    await usuario.click(screen.getByRole('button', { name: `Menos: ${HORAS}` }));

    expect(screen.getByRole('spinbutton', { name: HORAS })).toHaveValue(6.5);
  });

  it('los despertares no bajan de cero', () => {
    pintar();

    expect(screen.getByRole('button', { name: `Menos: ${DESPERTARES}` })).toBeDisabled();
  });

  it('la mascota repite lo anotado, sin opinar', () => {
    pintar();

    expect(screen.getByText(/Anotado: 7 horas de sueño\./)).toBeInTheDocument();

    poner(HORAS, '6.5');

    expect(screen.getByText(/Anotado: 6\.5 horas de sueño\./)).toBeInTheDocument();
    expect(screen.queryByText(/qué bien|qué poco/i)).toBeNull();
  });
});

describe('el boton de terminar', () => {
  it('se llama «Terminar» y esta activo', () => {
    pintar();

    expect(screen.getByRole('button', { name: 'Terminar' })).toBeEnabled();
  });

  it('mientras se guarda dice «Guardando…» y no se puede volver a tocar', () => {
    pintar(true);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Terminar' })).toBeNull();
  });
});
