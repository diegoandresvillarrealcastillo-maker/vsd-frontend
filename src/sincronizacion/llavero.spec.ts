import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { DescifradoFallido, abrir, sellar } from './cifrado.ts';
import { crearLlaveroEnIndexedDB, crearLlaveroEnMemoria, type Llavero } from './llavero.ts';

beforeEach(() => {
  // Cada prueba empieza con un navegador limpio: sin bases de la anterior.
  globalThis.indexedDB = new IDBFactory();
});

const CONTEXTO = 'contexto';

/** Si dos claves son la misma: lo que una cifra, la otra lo descifra. */
async function sonLaMisma(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  try {
    return (await abrir(b, CONTEXTO, await sellar(a, CONTEXTO, 'prueba'))) === 'prueba';
  } catch (error) {
    if (error instanceof DescifradoFallido) {
      return false;
    }

    throw error;
  }
}

describe.each([
  ['en memoria', (): Llavero => crearLlaveroEnMemoria()],
  ['en IndexedDB', (): Llavero => crearLlaveroEnIndexedDB()],
])('el llavero %s', (_nombre, crear) => {
  it('da la misma clave a la misma persona', async () => {
    const llavero = crear();

    expect(
      await sonLaMisma(await llavero.obtenerOCrear('ana'), await llavero.obtenerOCrear('ana')),
    ).toBe(true);
  });

  it('da claves distintas a personas distintas: lo de una no lo lee la otra', async () => {
    const llavero = crear();

    expect(
      await sonLaMisma(await llavero.obtenerOCrear('ana'), await llavero.obtenerOCrear('beto')),
    ).toBe(false);
  });

  it('la clave no es extraible', async () => {
    const clave = await crear().obtenerOCrear('ana');

    expect(clave.extractable).toBe(false);
  });

  it('lista a las personas que tienen clave', async () => {
    const llavero = crear();

    expect(await llavero.personas()).toEqual([]);

    await llavero.obtenerOCrear('ana');
    await llavero.obtenerOCrear('beto');

    expect([...(await llavero.personas())].sort()).toEqual(['ana', 'beto']);
  });

  it('olvidar a una persona borra su clave y solo la suya', async () => {
    const llavero = crear();

    await llavero.obtenerOCrear('ana');
    await llavero.obtenerOCrear('beto');
    await llavero.olvidar('ana');

    expect(await llavero.personas()).toEqual(['beto']);
  });

  it('olvidar a quien no esta no falla', async () => {
    await expect(crear().olvidar('nadie')).resolves.toBeUndefined();
  });

  it('despues de olvidarla, la clave nueva NO descifra lo que cifro la vieja', async () => {
    const llavero = crear();
    const vieja = await llavero.obtenerOCrear('ana');
    const sellado = await sellar(vieja, CONTEXTO, 'secreto');

    await llavero.olvidar('ana');

    const nueva = await llavero.obtenerOCrear('ana');

    // Es lo que hace que borrar la clave sea olvidar a la persona: lo cifrado con
    // la anterior queda ilegible para siempre, aunque quedara algun rastro.
    await expect(abrir(nueva, CONTEXTO, sellado)).rejects.toBeInstanceOf(DescifradoFallido);
  });

  it('varias peticiones a la vez de la misma persona acaban con la misma clave', async () => {
    const llavero = crear();

    const claves = await Promise.all(Array.from({ length: 8 }, () => llavero.obtenerOCrear('ana')));

    for (const clave of claves) {
      expect(await sonLaMisma(claves[0]!, clave)).toBe(true);
    }

    expect(await llavero.personas()).toEqual(['ana']);
  });
});

describe('el llavero en IndexedDB, ademas', () => {
  it('la clave sobrevive a recargar la pagina (otra instancia ve la misma)', async () => {
    const antes = crearLlaveroEnIndexedDB();
    const clave = await antes.obtenerOCrear('ana');
    const sellado = await sellar(clave, CONTEXTO, 'guardado antes de recargar');

    // Otra instancia: lo que se tiene al abrir la pagina de nuevo.
    const despues = crearLlaveroEnIndexedDB();

    expect(await abrir(await despues.obtenerOCrear('ana'), CONTEXTO, sellado)).toBe(
      'guardado antes de recargar',
    );
  });

  it('dos pestanas (dos instancias) que piden a la vez acaban con la misma clave', async () => {
    const pestanaUno = crearLlaveroEnIndexedDB();
    const pestanaDos = crearLlaveroEnIndexedDB();

    const [una, otra] = await Promise.all([
      pestanaUno.obtenerOCrear('ana'),
      pestanaDos.obtenerOCrear('ana'),
    ]);

    // La que llego segunda descarta la suya y usa la que ya estaba: nunca dos
    // pestanas con claves distintas para lo mismo.
    expect(await sonLaMisma(una, otra)).toBe(true);
    expect(await pestanaUno.personas()).toEqual(['ana']);
  });

  it('vive en su propia base, aparte de la de nadie', async () => {
    await crearLlaveroEnIndexedDB().obtenerOCrear('ana');

    const bases = await indexedDB.databases();

    expect(bases.map((b) => b.name)).toEqual(['vsd-llavero']);
  });

  it('el nombre del llavero se puede cambiar (para no mezclar entornos)', async () => {
    await crearLlaveroEnIndexedDB('otro-llavero').obtenerOCrear('ana');

    expect((await indexedDB.databases()).map((b) => b.name)).toEqual(['otro-llavero']);
    expect(await crearLlaveroEnIndexedDB().personas()).toEqual([]);
  });
});

describe('el llavero en memoria, ademas', () => {
  it('no escribe en ningun sitio', async () => {
    await crearLlaveroEnMemoria().obtenerOCrear('ana');

    expect(await indexedDB.databases()).toEqual([]);
  });

  it('dos llaveros en memoria no comparten nada (cada pagina empieza de cero)', async () => {
    const uno = crearLlaveroEnMemoria();
    const otro = crearLlaveroEnMemoria();

    await uno.obtenerOCrear('ana');

    expect(await otro.personas()).toEqual([]);
  });
});
