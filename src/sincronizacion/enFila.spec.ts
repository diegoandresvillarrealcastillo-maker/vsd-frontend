import { describe, expect, it } from 'vitest';

import { crearFila } from './enFila.ts';

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

describe('crearFila', () => {
  it('cada tarea espera a la anterior, aunque la anterior tarde', async () => {
    const enFila = crearFila();
    const orden: string[] = [];

    const una = enFila(async () => {
      await esperar(30);
      orden.push('una');
    });
    const otra = enFila(() => {
      orden.push('otra');

      return Promise.resolve();
    });

    await Promise.all([una, otra]);

    expect(orden).toEqual(['una', 'otra']);
  });

  it('una tarea que falla no rechaza ni detiene a las siguientes', async () => {
    const enFila = crearFila();
    let corrio = false;

    await expect(enFila(() => Promise.reject(new Error('fallo')))).resolves.toBeUndefined();
    await enFila(() => {
      corrio = true;

      return Promise.resolve();
    });

    expect(corrio).toBe(true);
  });

  it('una tarea que falla sin esperar a nadie tampoco', async () => {
    const enFila = crearFila();

    await expect(
      enFila(() => {
        throw new Error('fallo sincrono');
      }),
    ).resolves.toBeUndefined();
  });

  it('cada fila es independiente de las demas', async () => {
    const una = crearFila();
    const otra = crearFila();
    const orden: string[] = [];

    const lenta = una(async () => {
      await esperar(40);
      orden.push('lenta');
    });
    const rapida = otra(() => {
      orden.push('rapida');

      return Promise.resolve();
    });

    await Promise.all([lenta, rapida]);

    expect(orden).toEqual(['rapida', 'lenta']);
  });
});
