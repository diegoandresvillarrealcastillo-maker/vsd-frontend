import { afterEach, describe, expect, it, vi } from 'vitest';

import { conLimite } from './tiempo.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('conLimite (SCRUM-138)', () => {
  it('si la promesa llega antes, es su valor', async () => {
    expect(await conLimite(Promise.resolve('listo'), 1000)).toBe('listo');
  });

  it('si la promesa falla antes, el fallo sale', async () => {
    await expect(conLimite(Promise.reject(new Error('fallo')), 1000)).rejects.toThrow('fallo');
  });

  it('si pasa el tiempo antes, es "tiempo", justo al milisegundo', async () => {
    vi.useFakeTimers();

    let termino = false;
    const resultado = conLimite(new Promise<string>(() => undefined), 1000).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(999);

    expect(termino).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(await resultado).toBe('tiempo');
  });

  it('la promesa no se cancela: sigue, y su valor llega a quien la guardo', async () => {
    vi.useFakeTimers();

    let resolver: (valor: string) => void = () => undefined;
    const promesa = new Promise<string>((resolve) => {
      resolver = resolve;
    });
    const resultado = conLimite(promesa, 10);

    await vi.advanceTimersByTimeAsync(10);

    expect(await resultado).toBe('tiempo');

    resolver('despues');

    expect(await promesa).toBe('despues');
  });

  it('no deja ningun temporizador vivo, gane quien gane', async () => {
    vi.useFakeTimers();

    await conLimite(Promise.resolve(1), 1000);

    expect(vi.getTimerCount()).toBe(0);

    await expect(conLimite(Promise.reject(new Error('x')), 1000)).rejects.toThrow();

    expect(vi.getTimerCount()).toBe(0);

    const tarde = conLimite(new Promise<number>(() => undefined), 5);

    await vi.advanceTimersByTimeAsync(5);
    await tarde;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('sin limite (infinito), es la promesa tal cual y no arma ningun temporizador', async () => {
    vi.useFakeTimers();

    const resultado = conLimite(Promise.resolve('valor'), Number.POSITIVE_INFINITY);

    expect(vi.getTimerCount()).toBe(0);
    expect(await resultado).toBe('valor');
  });

  it('un limite negativo o cero es "tiempo" de inmediato, no un error', async () => {
    vi.useFakeTimers();

    const resultado = conLimite(new Promise<string>(() => undefined), -50);

    await vi.advanceTimersByTimeAsync(0);

    expect(await resultado).toBe('tiempo');
  });
});
