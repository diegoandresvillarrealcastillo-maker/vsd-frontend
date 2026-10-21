import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import {
  alCambiarLaRacha,
  olvidarLaRacha,
  rachaRecordadaDe,
  recordarLaRacha,
} from './memoriaDeLaRacha.ts';

/**
 * Lo ultimo que dijo el servidor de la racha (SCRUM-186), y desde SCRUM-243 quien quiera enterarse
 * cuando cambia: la llama de la barra se actualiza sola cuando una actividad la hace crecer.
 */
const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-9222-222222222222';

beforeEach(() => {
  olvidarLaRacha();
});

describe('memoriaDeLaRacha', () => {
  it('recuerda la ultima racha de una cuenta y no se la entrega a otra', () => {
    recordarLaRacha(ANA, rachaDePrueba({ dias: 5 }));

    expect(rachaRecordadaDe(ANA)?.dias).toBe(5);
    expect(rachaRecordadaDe(BETO)).toBeNull();
  });

  it('al cerrar sesion se olvida', () => {
    recordarLaRacha(ANA, rachaDePrueba());
    olvidarLaRacha();

    expect(rachaRecordadaDe(ANA)).toBeNull();
  });

  it('avisa a quien escucha, con la cuenta y la racha nueva', () => {
    const avisar = vi.fn();
    const nueva = rachaDePrueba({ dias: 6 });

    alCambiarLaRacha(avisar);
    recordarLaRacha(ANA, nueva);

    expect(avisar).toHaveBeenCalledExactlyOnceWith(ANA, nueva);
  });

  it('quien deja de escuchar no recibe nada mas', () => {
    const avisar = vi.fn();
    const dejarDeEscuchar = alCambiarLaRacha(avisar);

    dejarDeEscuchar();
    recordarLaRacha(ANA, rachaDePrueba());

    expect(avisar).not.toHaveBeenCalled();
  });

  it('varios pueden escuchar a la vez', () => {
    const uno = vi.fn();
    const otro = vi.fn();

    alCambiarLaRacha(uno);
    alCambiarLaRacha(otro);
    recordarLaRacha(ANA, rachaDePrueba());

    expect(uno).toHaveBeenCalledTimes(1);
    expect(otro).toHaveBeenCalledTimes(1);
  });

  it('un oyente que falla no impide que los demas se enteren', () => {
    const fallido = vi.fn(() => {
      throw new Error('fallo de un oyente');
    });
    const sano = vi.fn();

    alCambiarLaRacha(fallido);
    alCambiarLaRacha(sano);

    expect(() => {
      recordarLaRacha(ANA, rachaDePrueba());
    }).not.toThrow();
    expect(sano).toHaveBeenCalledTimes(1);
  });
});
