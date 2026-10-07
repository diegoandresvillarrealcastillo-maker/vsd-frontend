import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { deleteDB, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AlmacenCerrado,
  AlmacenLleno,
  abrirAlmacenEnIndexedDB,
  crearAlmacenEnMemoria,
  nombreDeLaBase,
  traducirErrorDeAlmacen,
  type AlmacenLocal,
} from './almacenLocal.ts';
import { nuevaOperacion, type Operacion } from './cola.ts';
import { crearLlaveroEnIndexedDB, type Llavero } from './llavero.ts';

const PERSONA = 'persona-ana';
const OTRA = 'persona-beto';
const AHORA = new Date('2026-10-07T12:00:00.000Z');

let llavero: Llavero;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  llavero = crearLlaveroEnIndexedDB();
});

afterEach(() => {
  vi.restoreAllMocks();
});

let contador = 0;

function operacion(cambios: Partial<Operacion> = {}): Operacion {
  contador += 1;

  return {
    ...nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo: 'pendiente.crear',
        entidad: `pendiente:${String(contador)}`,
        payload: {
          clientOperationId: `op-${String(contador)}`,
          texto: 'Pedir la cita',
          nivel: 'urgente',
        },
      },
      AHORA,
    ),
    ...cambios,
  };
}

// ---------------------------------------------------------------------------
// Lo que tienen que cumplir los dos almacenes
// ---------------------------------------------------------------------------

describe.each([
  [
    'en memoria',
    (persona: string): Promise<AlmacenLocal> => Promise.resolve(crearAlmacenEnMemoria(persona)),
  ],
  [
    'en IndexedDB',
    (persona: string): Promise<AlmacenLocal> => abrirAlmacenEnIndexedDB(persona, llavero),
  ],
])('el almacen %s', (_nombre, abrir) => {
  describe('las lecturas', () => {
    it('guarda y devuelve lo que se le dio, con la hora en que se guardo', async () => {
      const almacen = await abrir(PERSONA);

      await almacen.guardarLectura(
        'semaforo',
        { pendientes: [{ id: 'a', texto: 'Llamar' }] },
        AHORA,
      );

      expect(await almacen.leerLectura('semaforo')).toEqual({
        valor: { pendientes: [{ id: 'a', texto: 'Llamar' }] },
        guardadoEn: AHORA.toISOString(),
      });
    });

    it('lo que no se guardo es nulo', async () => {
      expect(await (await abrir(PERSONA)).leerLectura('nada')).toBeNull();
    });

    it('guardar de nuevo reemplaza, con la hora nueva', async () => {
      const almacen = await abrir(PERSONA);
      const despues = new Date(AHORA.getTime() + 60_000);

      await almacen.guardarLectura('catalogo', { v: 1 }, AHORA);
      await almacen.guardarLectura('catalogo', { v: 2 }, despues);

      expect(await almacen.leerLectura('catalogo')).toEqual({
        valor: { v: 2 },
        guardadoEn: despues.toISOString(),
      });
    });

    it('borrar la quita; borrar lo que no esta no falla', async () => {
      const almacen = await abrir(PERSONA);

      await almacen.guardarLectura('a', 1, AHORA);
      await almacen.borrarLectura('a');
      await almacen.borrarLectura('a');

      expect(await almacen.leerLectura('a')).toBeNull();
    });

    it('guarda cualquier cosa que sea JSON', async () => {
      const almacen = await abrir(PERSONA);

      for (const valor of [[], {}, 'texto', 0, false, [1, [2, [3]]], { a: null }]) {
        await almacen.guardarLectura('x', valor, AHORA);

        expect((await almacen.leerLectura('x'))?.valor).toEqual(valor);
      }
    });

    it('lo que devuelve es una copia: tocarla no cambia lo guardado', async () => {
      const almacen = await abrir(PERSONA);

      await almacen.guardarLectura('l', { lista: [1, 2] }, AHORA);

      const leida = await almacen.leerLectura<{ lista: number[] }>('l');

      leida?.valor.lista.push(99);

      expect((await almacen.leerLectura<{ lista: number[] }>('l'))?.valor.lista).toEqual([1, 2]);
    });

    it('lo que se le dio tambien se copia: cambiarlo despues no cambia lo guardado', async () => {
      const almacen = await abrir(PERSONA);
      const original = { lista: [1, 2] };

      await almacen.guardarLectura('l', original, AHORA);
      original.lista.push(99);

      expect((await almacen.leerLectura<{ lista: number[] }>('l'))?.valor.lista).toEqual([1, 2]);
    });
  });

  describe('la cola', () => {
    it('numera por orden de llegada, empezando en 1', async () => {
      const almacen = await abrir(PERSONA);

      const a = await almacen.agregarOperacion(operacion());
      const b = await almacen.agregarOperacion(operacion());
      const c = await almacen.agregarOperacion(operacion());

      expect([a.orden, b.orden, c.orden]).toEqual([1, 2, 3]);
    });

    it('devuelve todas, en el orden en que llegaron', async () => {
      const almacen = await abrir(PERSONA);
      const a = operacion();
      const b = operacion();
      const c = operacion();

      await almacen.agregarOperacion(b);
      await almacen.agregarOperacion(c);
      await almacen.agregarOperacion(a);

      expect((await almacen.operaciones()).map((o) => o.operationId)).toEqual([
        b.operationId,
        c.operationId,
        a.operationId,
      ]);
    });

    it('guarda la operacion completa, payload incluido', async () => {
      const almacen = await abrir(PERSONA);
      const o = operacion({
        tipo: 'diario.escribir',
        payload: {
          dia: '2026-10-07',
          contenido: { type: 'doc', content: [{ type: 'text', text: 'Hola' }] },
        },
        dependeDe: 'otra',
        proximoIntento: '2026-10-07T13:00:00.000Z',
        intentos: 3,
      });

      await almacen.agregarOperacion(o);

      expect(await almacen.operacion(o.operationId)).toMatchObject({
        operationId: o.operationId,
        tipo: 'diario.escribir',
        entidad: o.entidad,
        payload: o.payload,
        payloadVersion: 1,
        creadaEn: AHORA.toISOString(),
        intentos: 3,
        proximoIntento: '2026-10-07T13:00:00.000Z',
        dependeDe: 'otra',
        estado: 'pendiente',
        recibo: null,
        error: null,
      });
    });

    it('es idempotente: agregar la misma dos veces no la duplica y devuelve la que estaba', async () => {
      const almacen = await abrir(PERSONA);
      const o = operacion();

      const primera = await almacen.agregarOperacion(o);
      const segunda = await almacen.agregarOperacion({ ...o, payload: { cambiado: true } });

      expect(segunda).toEqual(primera);
      expect(await almacen.operaciones()).toHaveLength(1);
      expect((await almacen.operacion(o.operationId))?.payload).toEqual(o.payload);
    });

    it('una repetida no consume un numero de orden', async () => {
      const almacen = await abrir(PERSONA);
      const a = operacion();

      await almacen.agregarOperacion(a);
      await almacen.agregarOperacion(a);

      expect((await almacen.agregarOperacion(operacion())).orden).toBe(2);
    });

    it('agregar muchas a la vez les da numeros distintos y seguidos', async () => {
      const almacen = await abrir(PERSONA);

      const guardadas = await Promise.all(
        Array.from({ length: 10 }, () => almacen.agregarOperacion(operacion())),
      );
      const ordenes = guardadas.map((o) => o.orden).sort((x, y) => x - y);

      expect(ordenes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('una operacion que no esta es nula', async () => {
      expect(await (await abrir(PERSONA)).operacion('no-esta')).toBeNull();
    });

    it('guardar una operacion cambia lo que se pida, y conserva el orden de llegada', async () => {
      const almacen = await abrir(PERSONA);
      const a = await almacen.agregarOperacion(operacion());

      await almacen.agregarOperacion(operacion());
      await almacen.guardarOperacion({
        ...a,
        orden: 999,
        estado: 'hecha',
        intentos: 2,
        recibo: { id: 'servidor-1', nivelOrientativo: 'favorable' },
        error: null,
      });

      expect(await almacen.operacion(a.operationId)).toMatchObject({
        estado: 'hecha',
        intentos: 2,
        orden: 1,
        recibo: { id: 'servidor-1', nivelOrientativo: 'favorable' },
      });
    });

    it('guarda el error con su codigo y sin repetir lo que se escribio', async () => {
      const almacen = await abrir(PERSONA);
      const a = await almacen.agregarOperacion(operacion());

      await almacen.guardarOperacion({
        ...a,
        estado: 'requiere_atencion',
        error: { codigo: 'PENDIENTE_INVALIDO', estado: 400, momento: AHORA.toISOString() },
      });

      expect((await almacen.operacion(a.operationId))?.error).toEqual({
        codigo: 'PENDIENTE_INVALIDO',
        estado: 400,
        momento: AHORA.toISOString(),
      });
    });

    it('guardar una que no estaba en la cola es un error', async () => {
      await expect((await abrir(PERSONA)).guardarOperacion(operacion())).rejects.toThrow(
        /no esta en la cola/,
      );
    });

    it('quitar la saca; quitar la que no esta no falla', async () => {
      const almacen = await abrir(PERSONA);
      const a = await almacen.agregarOperacion(operacion());

      await almacen.quitarOperacion(a.operationId);
      await almacen.quitarOperacion(a.operationId);

      expect(await almacen.operaciones()).toEqual([]);
    });

    it('lo que sale es una copia: tocarla no cambia lo guardado', async () => {
      const almacen = await abrir(PERSONA);
      const a = await almacen.agregarOperacion(operacion());
      const leida = await almacen.operacion(a.operationId);

      (leida?.payload as { texto: string }).texto = 'ALTERADO';

      expect(((await almacen.operacion(a.operationId))?.payload as { texto: string }).texto).toBe(
        'Pedir la cita',
      );
    });

    it('un recibo nulo se queda nulo, y uno con contenido se conserva', async () => {
      const almacen = await abrir(PERSONA);
      const a = await almacen.agregarOperacion(operacion());

      expect((await almacen.operacion(a.operationId))?.recibo).toBeNull();

      await almacen.guardarOperacion({ ...a, recibo: { lineasDeAtencion: [{ id: 'l1' }] } });

      expect((await almacen.operacion(a.operationId))?.recibo).toEqual({
        lineasDeAtencion: [{ id: 'l1' }],
      });
    });
  });

  describe('lo propio del mecanismo (meta)', () => {
    it('guarda y devuelve un apunte', async () => {
      const almacen = await abrir(PERSONA);

      await almacen.guardarMeta('ultimaSincronizacion', AHORA.toISOString());

      expect(await almacen.leerMeta('ultimaSincronizacion')).toBe(AHORA.toISOString());
    });

    it('lo que no esta es nulo', async () => {
      expect(await (await abrir(PERSONA)).leerMeta('nada')).toBeNull();
    });
  });

  describe('cada persona tiene lo suyo', () => {
    it('dos personas no ven nada de la otra', async () => {
      const ana = await abrir(PERSONA);
      const beto = await abrir(OTRA);

      await ana.guardarLectura('semaforo', { de: 'ana' }, AHORA);
      await ana.agregarOperacion(operacion());
      await ana.guardarMeta('x', 1);

      expect(await beto.leerLectura('semaforo')).toBeNull();
      expect(await beto.operaciones()).toEqual([]);
      expect(await beto.leerMeta('x')).toBeNull();
    });

    it('dice de quien es', async () => {
      expect((await abrir(PERSONA)).persona).toBe(PERSONA);
    });
  });

  describe('cerrar y vaciar', () => {
    it('vaciar borra todo y deja el almacen inservible', async () => {
      const almacen = await abrir(PERSONA);

      await almacen.guardarLectura('a', 1, AHORA);
      await almacen.agregarOperacion(operacion());
      await almacen.vaciar();

      await expect(almacen.leerLectura('a')).rejects.toBeInstanceOf(AlmacenCerrado);
      await expect(almacen.operaciones()).rejects.toBeInstanceOf(AlmacenCerrado);
      await expect(almacen.agregarOperacion(operacion())).rejects.toBeInstanceOf(AlmacenCerrado);
      await expect(almacen.guardarMeta('x', 1)).rejects.toBeInstanceOf(AlmacenCerrado);
    });

    it('vaciar y volver a abrir empieza de cero', async () => {
      const almacen = await abrir(PERSONA);

      await almacen.guardarLectura('a', 1, AHORA);
      await almacen.agregarOperacion(operacion());
      await almacen.vaciar();

      const nuevo = await abrir(PERSONA);

      expect(await nuevo.leerLectura('a')).toBeNull();
      expect(await nuevo.operaciones()).toEqual([]);
      // Y la numeracion tambien empieza de nuevo.
      expect((await nuevo.agregarOperacion(operacion())).orden).toBe(1);
    });

    it('cerrar deja el almacen inservible', async () => {
      const almacen = await abrir(PERSONA);

      almacen.cerrar();

      await expect(almacen.operaciones()).rejects.toBeInstanceOf(AlmacenCerrado);
    });

    it('vaciar a una persona no toca a la otra', async () => {
      const ana = await abrir(PERSONA);
      const beto = await abrir(OTRA);

      await beto.guardarLectura('a', 'de beto', AHORA);
      await ana.vaciar();

      expect((await beto.leerLectura('a'))?.valor).toBe('de beto');
    });
  });
});

// ---------------------------------------------------------------------------
// Lo que solo tiene sentido en el de IndexedDB
// ---------------------------------------------------------------------------

/** Todo lo que hay en una base, tal como esta guardado: sin pasar por el almacen. */
async function contenidoCrudo(persona: string): Promise<{
  lecturas: unknown[];
  cola: unknown[];
  meta: unknown[];
}> {
  const base = await openDB(nombreDeLaBase(persona));

  try {
    return {
      lecturas: await base.getAll('lecturas'),
      cola: await base.getAll('cola'),
      meta: await base.getAll('meta'),
    };
  } finally {
    base.close();
  }
}

/** Los bytes de todo lo guardado, como texto, para buscar en ellos lo que no debe estar. */
function comoTexto(valor: unknown): string {
  const partes: string[] = [];

  const recorrer = (v: unknown): void => {
    if (v === null || v === undefined) {
      return;
    }

    if (
      v instanceof ArrayBuffer ||
      ArrayBuffer.isView(v) ||
      Object.prototype.toString.call(v) === '[object ArrayBuffer]'
    ) {
      const bytes =
        v instanceof ArrayBuffer
          ? new Uint8Array(v)
          : new Uint8Array((v as ArrayBufferView).buffer);

      partes.push(new TextDecoder('latin1').decode(bytes));

      return;
    }

    if (typeof v === 'object') {
      for (const [clave, hijo] of Object.entries(v)) {
        partes.push(clave);
        recorrer(hijo);
      }

      return;
    }

    partes.push(typeof v === 'string' ? v : JSON.stringify(v));
  };

  recorrer(valor);

  return partes.join('\n');
}

describe('el almacen en IndexedDB', () => {
  it('es persistente; el de memoria no', async () => {
    expect((await abrirAlmacenEnIndexedDB(PERSONA, llavero)).persistente).toBe(true);
    expect(crearAlmacenEnMemoria(PERSONA).persistente).toBe(false);
  });

  it('la base se llama vsd-<persona>', async () => {
    await abrirAlmacenEnIndexedDB(PERSONA, llavero);

    expect((await indexedDB.databases()).map((b) => b.name).sort()).toEqual([
      'vsd-llavero',
      'vsd-persona-ana',
    ]);
    expect(nombreDeLaBase(PERSONA)).toBe('vsd-persona-ana');
  });

  describe('lo guardado esta cifrado', () => {
    it('ni las lecturas ni la cola dejan nada legible en la base', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const secreto = {
        texto: 'MUY-SECRETO-123 hoy me siento sin ganas de nada',
        contenido: { type: 'doc', content: [{ type: 'text', text: 'ANOTACION-PRIVADA-456' }] },
      };

      await almacen.guardarLectura('semaforo', secreto, AHORA);
      const a = await almacen.agregarOperacion(operacion({ payload: secreto }));

      await almacen.guardarOperacion({
        ...a,
        estado: 'hecha',
        recibo: { nivelOrientativo: 'RECIBO-PRIVADO-789' },
      });

      const crudo = comoTexto(await contenidoCrudo(PERSONA));

      for (const rastro of [
        'MUY-SECRETO-123',
        'sin ganas',
        'ANOTACION-PRIVADA-456',
        'RECIBO-PRIVADO-789',
        'Pedir la cita',
      ]) {
        expect(crudo).not.toContain(rastro);
      }
    });

    it('lo que SI queda en claro es lo que no es contenido (el tipo, el estado, las fechas)', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await almacen.agregarOperacion(operacion({ tipo: 'resultado.registrar' }));

      const { cola } = await contenidoCrudo(PERSONA);

      expect(cola[0]).toMatchObject({
        operationId: a.operationId,
        tipo: 'resultado.registrar',
        estado: 'pendiente',
        orden: 1,
        creadaEn: AHORA.toISOString(),
      });
    });

    it('el contenido sale en la prueba de abajo, de modo que la anterior no pasa en vacio', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      await almacen.guardarMeta('sinCifrar', 'META-EN-CLARO');

      // La meta NO se cifra (son apuntes del mecanismo, sin contenido de la
      // persona): si el buscador de texto no la encontrara, la prueba de arriba
      // no demostraria nada.
      expect(comoTexto(await contenidoCrudo(PERSONA))).toContain('META-EN-CLARO');
    });
  });

  describe('lo guardado no se puede alterar sin que se note', () => {
    it('un payload alterado sale marcado como ilegible, sin payload', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await almacen.agregarOperacion(operacion());
      const base = await openDB(nombreDeLaBase(PERSONA));
      const registro = (await base.get('cola', a.operationId)) as {
        payload: { datos: ArrayBuffer };
      };
      const bytes = new Uint8Array(registro.payload.datos);

      bytes[0] = (bytes[0] ?? 0) ^ 0x01;
      await base.put('cola', registro);
      base.close();

      const leida = await almacen.operacion(a.operationId);

      expect(leida?.ilegible).toBe(true);
      expect(leida?.payload).toBeNull();
      // Y sigue estando: no se tira. Que se resuelva es cosa de la persona.
      expect(leida?.operationId).toBe(a.operationId);
      expect(await almacen.operaciones()).toHaveLength(1);
    });

    it('un payload movido a OTRA operacion no se descifra (el contexto va atado)', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await almacen.agregarOperacion(operacion());
      const b = await almacen.agregarOperacion(operacion());
      const base = await openDB(nombreDeLaBase(PERSONA));
      const deA = (await base.get('cola', a.operationId)) as { payload: unknown };
      const deB = (await base.get('cola', b.operationId)) as { payload: unknown };

      await base.put('cola', { ...deB, payload: deA.payload });
      base.close();

      expect((await almacen.operacion(b.operationId))?.ilegible).toBe(true);
      expect((await almacen.operacion(a.operationId))?.ilegible).toBeUndefined();
    });

    it('un recibo alterado deja la operacion ilegible', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await almacen.agregarOperacion(operacion());

      await almacen.guardarOperacion({ ...a, estado: 'hecha', recibo: { id: 'x' } });

      const base = await openDB(nombreDeLaBase(PERSONA));
      const registro = (await base.get('cola', a.operationId)) as {
        recibo: { datos: ArrayBuffer };
      };

      new Uint8Array(registro.recibo.datos)[0] = 0xff;
      await base.put('cola', registro);
      base.close();

      expect((await almacen.operacion(a.operationId))?.ilegible).toBe(true);
    });

    it('una lectura alterada se tira y se pide de nuevo: no se enseña basura', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      await almacen.guardarLectura('semaforo', { a: 1 }, AHORA);

      const base = await openDB(nombreDeLaBase(PERSONA));
      const registro = (await base.get('lecturas', 'semaforo')) as {
        sello: { datos: ArrayBuffer };
      };

      new Uint8Array(registro.sello.datos)[0] = 0x00;
      await base.put('lecturas', registro);
      base.close();

      expect(await almacen.leerLectura('semaforo')).toBeNull();
      // Y ya no esta: la siguiente lectura tampoco la encuentra.
      expect((await contenidoCrudo(PERSONA)).lecturas).toEqual([]);
    });

    it('un registro de la cola con una forma que no es la nuestra se ignora', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await almacen.agregarOperacion(operacion());
      const base = await openDB(nombreDeLaBase(PERSONA));

      await base.put('cola', { operationId: 'basura', algo: 'que no es una operacion' });
      base.close();

      expect((await almacen.operaciones()).map((o) => o.operationId)).toEqual([a.operationId]);
      expect(await almacen.operacion('basura')).toBeNull();
    });
  });

  describe('la clave', () => {
    it('al volver a abrir (recargar la pagina) todo se lee con la misma clave', async () => {
      const antes = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await antes.agregarOperacion(operacion());

      await antes.guardarLectura('semaforo', { guardado: 'antes de recargar' }, AHORA);
      antes.cerrar();

      const despues = await abrirAlmacenEnIndexedDB(PERSONA, crearLlaveroEnIndexedDB());

      expect((await despues.operacion(a.operationId))?.payload).toEqual(a.payload);
      expect((await despues.leerLectura('semaforo'))?.valor).toEqual({
        guardado: 'antes de recargar',
      });
    });

    it('la numeracion de la cola sigue donde iba al recargar', async () => {
      const antes = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      await antes.agregarOperacion(operacion());
      await antes.agregarOperacion(operacion());
      antes.cerrar();

      const despues = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      expect((await despues.agregarOperacion(operacion())).orden).toBe(3);
    });

    it('si se pierde la clave, lo guardado queda ilegible: la cola se marca y las lecturas se tiran', async () => {
      const antes = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const a = await antes.agregarOperacion(operacion());

      await antes.guardarLectura('semaforo', { a: 1 }, AHORA);
      antes.cerrar();

      await llavero.olvidar(PERSONA);

      const despues = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      expect((await despues.operacion(a.operationId))?.ilegible).toBe(true);
      expect(await despues.leerLectura('semaforo')).toBeNull();
    });
  });

  describe('vaciar', () => {
    it('borra la base de verdad: ya no esta entre las bases del navegador', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      await almacen.guardarLectura('a', 1, AHORA);
      await almacen.vaciar();

      expect((await indexedDB.databases()).map((b) => b.name)).not.toContain('vsd-persona-ana');
    });

    it('no se cuelga si otra pestana tiene la base abierta: la suelta cuando le piden borrarla', async () => {
      const pestanaUno = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const pestanaDos = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      await pestanaUno.guardarLectura('a', 1, AHORA);

      // La persona cierra sesion en la pestana uno. La dos tiene la base abierta:
      // borrar espera a que todas las conexiones la suelten, asi que la dos tiene
      // que hacerlo sola. Si no, esto no termina nunca.
      await Promise.race([
        pestanaUno.vaciar(),
        new Promise((_resolver, rechazar) =>
          setTimeout(() => rechazar(new Error('se colgo')), 2000),
        ),
      ]);

      await expect(pestanaDos.leerLectura('a')).rejects.toBeInstanceOf(AlmacenCerrado);
    });

    it('borrar desde fuera tampoco se cuelga', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      await Promise.race([
        deleteDB(nombreDeLaBase(PERSONA)),
        new Promise((_resolver, rechazar) =>
          setTimeout(() => rechazar(new Error('se colgo')), 2000),
        ),
      ]);

      await expect(almacen.operaciones()).rejects.toBeInstanceOf(AlmacenCerrado);
    });
  });

  describe('cuando no hay espacio', () => {
    it('guardar una lectura sin espacio dice AlmacenLleno, no un error raro', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);

      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('no hay espacio', 'QuotaExceededError');
      });

      await expect(almacen.guardarLectura('a', 1, AHORA)).rejects.toBeInstanceOf(AlmacenLleno);
    });

    it('encolar una operacion sin espacio dice AlmacenLleno, y no deja nada a medias', async () => {
      const almacen = await abrirAlmacenEnIndexedDB(PERSONA, llavero);
      const real = IDBObjectStore.prototype.put;

      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        valor: unknown,
        clave?: IDBValidKey,
      ) {
        if (this.name === 'cola') {
          throw new DOMException('no hay espacio', 'QuotaExceededError');
        }

        return real.call(this, valor, clave);
      });

      await expect(almacen.agregarOperacion(operacion())).rejects.toBeInstanceOf(AlmacenLleno);

      vi.restoreAllMocks();

      expect(await almacen.operaciones()).toEqual([]);
    });
  });
});

describe('traducirErrorDeAlmacen', () => {
  it('convierte el error de falta de espacio en el nuestro', () => {
    expect(traducirErrorDeAlmacen(new DOMException('x', 'QuotaExceededError'))).toBeInstanceOf(
      AlmacenLleno,
    );
  });

  it('tambien el que se reconoce por el codigo 22 (navegadores antiguos)', () => {
    expect(traducirErrorDeAlmacen({ code: 22 })).toBeInstanceOf(AlmacenLleno);
  });

  it.each([
    ['otro error de IndexedDB', new DOMException('x', 'ConstraintError')],
    ['un error cualquiera', new Error('otra cosa')],
    ['un texto', 'fallo'],
    ['nulo', null],
  ])('deja pasar %s tal cual', (_nombre, error) => {
    expect(traducirErrorDeAlmacen(error)).toBe(error);
  });

  it('el mensaje de AlmacenLleno es entendible', () => {
    expect(new AlmacenLleno().message).toMatch(/espacio/);
  });
});
