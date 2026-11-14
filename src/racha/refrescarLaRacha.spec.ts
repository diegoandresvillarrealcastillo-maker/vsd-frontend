import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import {
  alCambiarLaRacha,
  olvidarLaRacha,
  rachaRecordadaDe,
  recordarLaRacha,
} from './memoriaDeLaRacha.ts';
import { refrescarLaRacha } from './refrescarLaRacha.ts';

/**
 * Pedir la racha otra vez despues de una actividad (SCRUM-243).
 *
 * Devuelve lo que se sabia antes y lo que dice ahora el servidor, para que la pantalla decida si hay
 * algo que celebrar: el cliente no cuenta dias, solo compara.
 */
const { consultarLaRacha } = vi.hoisted(() => ({ consultarLaRacha: vi.fn() }));

vi.mock('../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

const ANA = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  consultarLaRacha.mockReset();
  olvidarLaRacha();
});

describe('refrescarLaRacha', () => {
  it('devuelve lo que se sabia y lo que dice ahora el servidor, y deja lo nuevo recordado', async () => {
    const antes = rachaDePrueba({ dias: 5, hechoHoy: false });
    const ahora = rachaDePrueba({ dias: 6, hechoHoy: true });

    recordarLaRacha(ANA, antes);
    consultarLaRacha.mockResolvedValue(ahora);

    await expect(refrescarLaRacha(ANA)).resolves.toEqual({ antes, ahora });
    expect(rachaRecordadaDe(ANA)).toEqual(ahora);
  });

  it('sin nada recordado, antes es null', async () => {
    consultarLaRacha.mockResolvedValue(rachaDePrueba());

    await expect(refrescarLaRacha(ANA)).resolves.toMatchObject({ antes: null });
  });

  it('avisa a quien escucha, para que la llama de la barra cambie sola', async () => {
    const avisar = vi.fn();
    const ahora = rachaDePrueba({ dias: 6 });

    consultarLaRacha.mockResolvedValue(ahora);
    alCambiarLaRacha(avisar);
    await refrescarLaRacha(ANA);

    expect(avisar).toHaveBeenCalledExactlyOnceWith(ANA, ahora);
  });

  it('si no se pudo pedir, rechaza y no toca lo recordado', async () => {
    const antes = rachaDePrueba({ dias: 5 });

    recordarLaRacha(ANA, antes);
    consultarLaRacha.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(refrescarLaRacha(ANA)).rejects.toBeInstanceOf(TypeError);
    expect(rachaRecordadaDe(ANA)).toEqual(antes);
  });

  it('pasa la senal de cancelacion a la peticion', async () => {
    const control = new AbortController();

    consultarLaRacha.mockResolvedValue(rachaDePrueba());
    await refrescarLaRacha(ANA, control.signal);

    expect(consultarLaRacha).toHaveBeenCalledWith(control.signal);
  });
});
