import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { crearAlmacenEnMemoria, nombreDeLaBase, type AlmacenLocal } from './almacenLocal.ts';
import {
  SinAlmacenAbierto,
  alCambiarLaSesion,
  avisarQueLaColaCambio,
  cicloActual,
  encolar,
  olvidarLosDatosDeLaSesionActual,
  reiniciarElCicloParaLasPruebas,
  suscribirAlCiclo,
  suscribirALaCola,
  type CanalDeLaCola,
  type FabricasDelCiclo,
} from './ciclo.ts';
import { nuevaOperacion } from './cola.ts';
import { crearLlaveroEnIndexedDB, crearLlaveroEnMemoria } from './llavero.ts';

const AHORA = new Date('2026-10-07T12:00:00.000Z');
const RECORDADA = { persistente: true };
const NO_RECORDADA = { persistente: false };

function unaOperacion(operationId: string) {
  return nuevaOperacion(
    {
      operationId,
      tipo: 'pendiente.crear',
      entidad: `pendiente:${operationId}`,
      payload: { clientOperationId: operationId, texto: 'Llamar', nivel: 'urgente' },
    },
    AHORA,
  );
}

/** Un canal entre pestanas de mentira: lo que una publica, lo oyen las otras. */
class FalsoCanal implements CanalDeLaCola {
  readonly publicadas: string[] = [];
  cerrado = false;
  private oyente: ((persona: string) => void) | null = null;

  private readonly todos: FalsoCanal[];

  constructor(todos: FalsoCanal[]) {
    this.todos = todos;
  }

  publicar(persona: string): void {
    this.publicadas.push(persona);
    this.todos
      .filter((otro) => otro !== this && !otro.cerrado)
      .forEach((otro) => otro.oyente?.(persona));
  }

  escuchar(oyente: (persona: string) => void): void {
    this.oyente = oyente;
  }

  cerrar(): void {
    this.cerrado = true;
  }

  /** Lo que le llega desde otra pestana. */
  recibir(persona: string): void {
    this.oyente?.(persona);
  }
}

/**
 * Un "navegador" de mentira: las bases sobreviven a cerrarse y desaparecen al
 * borrarse, como las de verdad, y todo lo que pasa queda anotado.
 */
function crearMundo() {
  const llavero = crearLlaveroEnMemoria();
  const bases = new Map<string, AlmacenLocal>();
  const mundo = {
    llavero,
    bases,
    hayIndexedDB: true,
    laBaseFalla: false,
    elBorradoFalla: false,
    abiertas: [] as string[],
    cerradas: [] as string[],
    borradas: [] as string[],
    enMemoria: [] as string[],
    pedirPersistencia: vi.fn(),
    confirmarConexion: vi.fn(() => Promise.resolve(true)),
    /** Todos los canales abiertos, como las pestanas de un mismo navegador. */
    canales: [] as FalsoCanal[],
    hayCanales: true,
  };

  const fabricas: FabricasDelCiclo = {
    hayIndexedDB: () => mundo.hayIndexedDB,
    crearLlavero: () => llavero,
    abrirEnIndexedDB: async (persona, elLlavero) => {
      if (mundo.laBaseFalla) {
        throw new Error('la base esta bloqueada');
      }

      await elLlavero.obtenerOCrear(persona);

      const base = bases.get(persona) ?? crearAlmacenEnMemoria(persona);

      bases.set(persona, base);
      mundo.abiertas.push(persona);

      // Cerrar una base no la borra: cierra la conexion.
      return {
        ...base,
        persistente: true,
        cerrar: () => {
          mundo.cerradas.push(persona);
        },
      };
    },
    crearEnMemoria: (persona) => {
      mundo.enMemoria.push(persona);

      return crearAlmacenEnMemoria(persona);
    },
    borrarBase: (persona) => {
      if (mundo.elBorradoFalla) {
        return Promise.reject(new Error('la base esta en uso'));
      }

      bases.delete(persona);
      mundo.borradas.push(persona);

      return Promise.resolve();
    },
    confirmarConexion: mundo.confirmarConexion,
    pedirPersistencia: mundo.pedirPersistencia,
    crearCanalDeLaCola: () => {
      if (!mundo.hayCanales) {
        return null;
      }

      const canal = new FalsoCanal(mundo.canales);

      mundo.canales.push(canal);

      return canal;
    },
  };

  return { mundo, fabricas };
}

let aviso: MockInstance<typeof console.warn>;

beforeEach(() => {
  // Los avisos de "no se pudo guardar" son esperados en varias pruebas.
  aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  reiniciarElCicloParaLasPruebas();
  aviso.mockRestore();
});

describe('abrir el almacen cuando entra una persona', () => {
  it('con la sesion recordada en este equipo, abre el almacen que sobrevive a cerrar la pagina', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(cicloActual()?.persona).toBe('ana');
    expect(cicloActual()?.almacen.persistente).toBe(true);
    expect(mundo.abiertas).toEqual(['ana']);
    expect(mundo.enMemoria).toEqual([]);
  });

  it('le pide al navegador que no lo borre por falta de espacio', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(mundo.pedirPersistencia).toHaveBeenCalledTimes(1);
  });

  it('sin la sesion recordada, el almacen es solo de memoria: nada queda escrito', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', NO_RECORDADA);

    expect(cicloActual()?.almacen.persistente).toBe(false);
    expect(mundo.abiertas).toEqual([]);
    expect(mundo.enMemoria).toEqual(['ana']);
    expect(mundo.pedirPersistencia).not.toHaveBeenCalled();
  });

  it('si el navegador no tiene IndexedDB, sigue en memoria', async () => {
    const { mundo, fabricas } = crearMundo();

    mundo.hayIndexedDB = false;
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(cicloActual()?.almacen.persistente).toBe(false);
    expect(mundo.abiertas).toEqual([]);
  });

  it('si IndexedDB existe pero no se puede abrir (navegacion privada), sigue en memoria y no rompe', async () => {
    const { mundo, fabricas } = crearMundo();

    mundo.laBaseFalla = true;
    reiniciarElCicloParaLasPruebas(fabricas);

    await expect(alCambiarLaSesion('ana', RECORDADA)).resolves.toBeUndefined();

    expect(cicloActual()?.persona).toBe('ana');
    expect(cicloActual()?.almacen.persistente).toBe(false);
    expect(aviso).toHaveBeenCalled();
  });

  it('si llego a abrirse pero fallo despues, no deja la conexion abierta', async () => {
    const { mundo, fabricas } = crearMundo();

    vi.spyOn(mundo.llavero, 'personas').mockRejectedValue(new Error('el llavero fallo'));
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(mundo.abiertas).toEqual(['ana']);
    expect(mundo.cerradas).toEqual(['ana']);
    expect(cicloActual()?.almacen.persistente).toBe(false);
  });

  it('cada persona tiene SU motor, que pregunta por la conexion a la API', async () => {
    const { mundo, fabricas } = crearMundo();

    mundo.confirmarConexion.mockResolvedValue(false);
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));

    const resultado = await cicloActual()?.motor.sincronizar('manual');

    expect(resultado?.estado).toBe('sin_conexion');
    expect(mundo.confirmarConexion).toHaveBeenCalledTimes(1);
  });

  it('el motor no envia con la sesion de otra persona: lo sabe en cuanto la sesion cambia', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    const motorDeAna = cicloActual()?.motor;

    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));

    // Entra Beto. Todavia no se termino de abrir su almacen (la fila lo hace despues),
    // pero el motor de Ana ya no debe enviar nada.
    const cambio = alCambiarLaSesion('beto', RECORDADA);
    const resultado = await motorDeAna?.sincronizar('manual');

    expect(resultado?.estado).toBe('persona_distinta');

    await cambio;
  });

  it('pedir lo mismo otra vez no lo abre de nuevo', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    const primero = cicloActual();

    await alCambiarLaSesion('ana', RECORDADA);

    expect(cicloActual()).toBe(primero);
    expect(mundo.abiertas).toEqual(['ana']);
    expect(mundo.cerradas).toEqual([]);
  });

  it('si la misma persona pasa a no tener la sesion recordada, se pasa a memoria', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await alCambiarLaSesion('ana', NO_RECORDADA);

    expect(cicloActual()?.almacen.persistente).toBe(false);
    expect(mundo.cerradas).toEqual(['ana']);
  });
});

describe('cuando entra OTRA persona (equipo compartido)', () => {
  it('lo de la anterior se borra: base y clave, sin dejarlo a la vista de la nueva', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await alCambiarLaSesion('beto', RECORDADA);

    expect(cicloActual()?.persona).toBe('beto');
    expect(mundo.cerradas).toEqual(['ana']);
    expect(mundo.borradas).toEqual(['ana']);
    expect(await mundo.llavero.personas()).toEqual(['beto']);
    expect(mundo.bases.has('ana')).toBe(false);
  });

  it('lo encuentra aunque la anterior hubiera quedado de una visita pasada', async () => {
    const { mundo, fabricas } = crearMundo();

    await mundo.llavero.obtenerOCrear('vieja');
    await mundo.llavero.obtenerOCrear('mas-vieja');
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    expect([...mundo.borradas].sort()).toEqual(['mas-vieja', 'vieja']);
    expect(await mundo.llavero.personas()).toEqual(['ana']);
  });

  it('con la sesion NO recordada no se borra nada de nadie: no se escribio nada', async () => {
    const { mundo, fabricas } = crearMundo();

    await mundo.llavero.obtenerOCrear('ana');
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('beto', NO_RECORDADA);

    // Beto no deja nada en el equipo y tampoco lee nada. Lo de Ana se limpiara la
    // proxima vez que alguien entre con la sesion recordada.
    expect(mundo.borradas).toEqual([]);
  });
});

describe('cuando la sesion termina SIN que la persona lo pida (caduco, se cerro en otra pestana)', () => {
  it('cierra el almacen pero NO lo borra: lo hecho sin conexion sigue ahi', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await alCambiarLaSesion(null, RECORDADA);

    expect(cicloActual()).toBeNull();
    expect(mundo.cerradas).toEqual(['ana']);
    expect(mundo.borradas).toEqual([]);
    expect(await mundo.llavero.personas()).toEqual(['ana']);
  });

  it('cuando la misma persona vuelve a entrar, su cola esta completa y se envia', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('b'));
    await alCambiarLaSesion(null, RECORDADA);
    await alCambiarLaSesion('ana', RECORDADA);

    const operaciones = await cicloActual()?.almacen.operaciones();

    expect(operaciones?.map((o) => o.operationId)).toEqual(['a', 'b']);
  });

  it('si en cambio entra otra persona, esa cola se pierde (es el costo de no mostrarla)', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await alCambiarLaSesion(null, RECORDADA);
    await alCambiarLaSesion('beto', RECORDADA);
    await alCambiarLaSesion(null, RECORDADA);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(await cicloActual()?.almacen.operaciones()).toEqual([]);
  });

  it('sin nada abierto no pasa nada ni avisa a nadie', async () => {
    const { fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    suscribirAlCiclo(oyente);

    await expect(alCambiarLaSesion(null, RECORDADA)).resolves.toBeUndefined();

    expect(oyente).not.toHaveBeenCalled();
  });

  it('el motor ya no envia: no hay sesion', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    const motor = cicloActual()?.motor;

    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await alCambiarLaSesion(null, RECORDADA);

    expect((await motor?.sincronizar('manual'))?.estado).toBe('sin_sesion');
  });
});

describe('cuando la persona CIERRA SESION (o borra su cuenta)', () => {
  it('se olvida todo lo suyo: la base y la clave que la cifraba', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await olvidarLosDatosDeLaSesionActual();

    expect(cicloActual()).toBeNull();
    expect(mundo.cerradas).toEqual(['ana']);
    expect(mundo.borradas).toEqual(['ana']);
    expect(await mundo.llavero.personas()).toEqual([]);
  });

  it('al volver a entrar no queda nada de la sesion anterior', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await olvidarLosDatosDeLaSesionActual();
    await alCambiarLaSesion(null, RECORDADA);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(await cicloActual()?.almacen.operaciones()).toEqual([]);
  });

  it('despues de olvidar, el aviso de que ya no hay sesion no rompe nada ni borra dos veces', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    // Asi ocurre en la aplicacion: se pide olvidar y, al cerrarse la sesion,
    // llega el aviso de que ya no hay persona.
    const olvido = olvidarLosDatosDeLaSesionActual();
    const aviso2 = alCambiarLaSesion(null, RECORDADA);

    await Promise.all([olvido, aviso2]);

    expect(mundo.borradas).toEqual(['ana']);
    expect(mundo.cerradas).toEqual(['ana']);
  });

  it('sin sesion no hay nada que olvidar', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await olvidarLosDatosDeLaSesionActual();

    expect(mundo.borradas).toEqual([]);
  });

  it('si cerro sesion antes de que terminara de abrirse, tambien se borra', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);

    const apertura = alCambiarLaSesion('ana', RECORDADA);
    const olvido = olvidarLosDatosDeLaSesionActual();

    await Promise.all([apertura, olvido]);

    expect(cicloActual()).toBeNull();
    expect(mundo.borradas).toEqual(['ana']);
    expect(await mundo.llavero.personas()).toEqual([]);
  });

  it('con la sesion no recordada, igual limpia lo que una visita anterior hubiera dejado', async () => {
    const { mundo, fabricas } = crearMundo();

    // Ana ya habia usado este equipo con la sesion recordada.
    await mundo.llavero.obtenerOCrear('ana');
    mundo.bases.set('ana', crearAlmacenEnMemoria('ana'));
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', NO_RECORDADA);
    await olvidarLosDatosDeLaSesionActual();

    expect(mundo.borradas).toEqual(['ana']);
    expect(await mundo.llavero.personas()).toEqual([]);
  });

  it('sin IndexedDB no intenta tocar el llavero, y no falla', async () => {
    const { mundo, fabricas } = crearMundo();
    const crearLlavero = vi.spyOn(fabricas, 'crearLlavero');

    mundo.hayIndexedDB = false;
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    await expect(olvidarLosDatosDeLaSesionActual()).resolves.toBeUndefined();

    expect(crearLlavero).not.toHaveBeenCalled();
  });

  it('si la base no se deja borrar, la clave se olvida igual (lo que contiene deja de poder leerse)', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    mundo.elBorradoFalla = true;

    await expect(olvidarLosDatosDeLaSesionActual()).resolves.toBeUndefined();

    expect(await mundo.llavero.personas()).toEqual([]);
    expect(aviso).toHaveBeenCalled();
  });

  it('si no se puede olvidar la clave, cerrar sesion no se estorba', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    vi.spyOn(mundo.llavero, 'olvidar').mockRejectedValue(new Error('el llavero fallo'));

    await expect(olvidarLosDatosDeLaSesionActual()).resolves.toBeUndefined();

    expect(mundo.borradas).toEqual(['ana']);
    expect(cicloActual()).toBeNull();
    expect(aviso).toHaveBeenCalled();
  });
});

describe('cambios seguidos', () => {
  it('dos cambios sin esperar no se pisan: gana el ultimo y queda limpio', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);

    const uno = alCambiarLaSesion('ana', RECORDADA);
    const dos = alCambiarLaSesion('beto', RECORDADA);

    await Promise.all([uno, dos]);

    expect(cicloActual()?.persona).toBe('beto');
    expect(mundo.abiertas).toEqual(['ana', 'beto']);
    expect(await mundo.llavero.personas()).toEqual(['beto']);
  });

  it('un fallo no atasca la fila: lo siguiente se hace', async () => {
    const { mundo, fabricas } = crearMundo();
    let falla = true;

    reiniciarElCicloParaLasPruebas({
      ...fabricas,
      crearEnMemoria: (persona) => {
        if (falla) {
          falla = false;
          throw new Error('sin memoria');
        }

        return crearAlmacenEnMemoria(persona);
      },
    });

    await expect(alCambiarLaSesion('ana', NO_RECORDADA)).rejects.toThrow('sin memoria');
    await alCambiarLaSesion('ana', NO_RECORDADA);

    expect(cicloActual()?.persona).toBe('ana');
    expect(mundo.abiertas).toEqual([]);
  });
});

describe('avisar a quien mira', () => {
  it('avisa cuando se abre y cuando se cierra', async () => {
    const { fabricas } = crearMundo();
    const vistos: (string | null)[] = [];

    reiniciarElCicloParaLasPruebas(fabricas);
    suscribirAlCiclo(() => vistos.push(cicloActual()?.persona ?? null));
    await alCambiarLaSesion('ana', RECORDADA);
    await alCambiarLaSesion(null, RECORDADA);

    expect(vistos).toEqual(['ana', null]);
  });

  it('cambiar de persona avisa del cierre de la anterior y de la apertura de la nueva', async () => {
    const { fabricas } = crearMundo();
    const vistos: (string | null)[] = [];

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirAlCiclo(() => vistos.push(cicloActual()?.persona ?? null));
    await alCambiarLaSesion('beto', RECORDADA);

    expect(vistos).toEqual([null, 'beto']);
  });

  it('quien deja de mirar ya no recibe avisos', async () => {
    const { fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    suscribirAlCiclo(oyente)();
    await alCambiarLaSesion('ana', RECORDADA);

    expect(oyente).not.toHaveBeenCalled();
  });

  it('pedir lo mismo otra vez no avisa de nada', async () => {
    const { fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirAlCiclo(oyente);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(oyente).not.toHaveBeenCalled();
  });
});

describe('reiniciar para las pruebas', () => {
  it('cierra lo abierto, olvida a quien miraba y deja la sesion sin persona', async () => {
    const { mundo, fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirAlCiclo(oyente);
    reiniciarElCicloParaLasPruebas(fabricas);

    expect(cicloActual()).toBeNull();
    expect(mundo.cerradas).toEqual(['ana']);

    // Sin persona en la sesion: "olvidar" no tiene a quien borrarle nada.
    await olvidarLosDatosDeLaSesionActual();

    expect(mundo.borradas).toEqual([]);

    await alCambiarLaSesion('ana', RECORDADA);

    expect(oyente).not.toHaveBeenCalled();
  });

  it('una apertura que se quedo colgada no impide empezar de cero', async () => {
    const { fabricas } = crearMundo();

    const intentos = vi.fn(() => new Promise<AlmacenLocal>(() => undefined));

    reiniciarElCicloParaLasPruebas({ ...fabricas, abrirEnIndexedDB: intentos });
    void alCambiarLaSesion('ana', RECORDADA);

    // Se espera a que de verdad se haya quedado colgada.
    await vi.waitFor(() => {
      expect(intentos).toHaveBeenCalled();
    });
    reiniciarElCicloParaLasPruebas(fabricas);

    await alCambiarLaSesion('beto', NO_RECORDADA);

    expect(cicloActual()?.persona).toBe('beto');
  });
});

describe('con IndexedDB de verdad (lo que hace el navegador)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    reiniciarElCicloParaLasPruebas();
  });

  async function bases(): Promise<string[]> {
    return (await indexedDB.databases()).map((base) => base.name ?? '').sort();
  }

  it('abre la base cifrada de la persona, y la cola sobrevive a cerrar y volver a abrir', async () => {
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await alCambiarLaSesion(null, RECORDADA);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(cicloActual()?.almacen.persistente).toBe(true);
    expect(await bases()).toEqual(['vsd-llavero', nombreDeLaBase('ana')].sort());
    expect((await cicloActual()?.almacen.operaciones())?.map((o) => o.operationId)).toEqual(['a']);
  });

  it('al cerrar sesion no queda NADA: ni la base ni la clave', async () => {
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await olvidarLosDatosDeLaSesionActual();
    await alCambiarLaSesion(null, RECORDADA);

    expect(await bases()).not.toContain(nombreDeLaBase('ana'));
    expect(await crearLlaveroEnIndexedDB().personas()).toEqual([]);
  });

  it('al entrar otra persona se borra lo de la anterior de verdad', async () => {
    await alCambiarLaSesion('ana', RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));
    await alCambiarLaSesion('beto', RECORDADA);

    expect(await bases()).toEqual(['vsd-llavero', nombreDeLaBase('beto')].sort());
    expect(await crearLlaveroEnIndexedDB().personas()).toEqual(['beto']);
  });

  it('le pide al navegador que no borre esto por falta de espacio', async () => {
    const persist = vi.fn(() => Promise.resolve(true));

    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });

    try {
      await alCambiarLaSesion('ana', RECORDADA);

      expect(persist).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('si el navegador contesta mal a esa peticion, o no la entiende, no pasa nada', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { persist: () => Promise.reject(new Error('no')) },
    });

    try {
      await alCambiarLaSesion('ana', RECORDADA);
      await Promise.resolve();

      expect(cicloActual()?.almacen.persistente).toBe(true);

      vi.stubGlobal('navigator', { ...navigator, storage: undefined });
      await alCambiarLaSesion('beto', RECORDADA);

      expect(cicloActual()?.persona).toBe('beto');
      expect(aviso).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('en un navegador sin IndexedDB sigue en memoria, en silencio: no es un error', async () => {
    vi.stubGlobal('indexedDB', undefined);

    try {
      await alCambiarLaSesion('ana', RECORDADA);

      expect(cicloActual()?.almacen.persistente).toBe(false);
      expect(aviso).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sin la sesion recordada no se escribe nada en el navegador', async () => {
    await alCambiarLaSesion('ana', NO_RECORDADA);
    await cicloActual()?.almacen.agregarOperacion(unaOperacion('a'));

    expect(cicloActual()?.almacen.persistente).toBe(false);
    expect(await bases()).toEqual([]);
  });
});

describe('encolar: el unico camino para agregar algo (SCRUM-137)', () => {
  it('guarda la operacion en el almacen de quien tiene la sesion y la devuelve', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    const guardada = await encolar({
      operationId: 'a',
      tipo: 'pendiente.crear',
      entidad: 'pendiente:a',
      payload: { clientOperationId: 'a', texto: 'Llamar', nivel: 'urgente' },
    });

    expect(guardada).toMatchObject({ operationId: 'a', estado: 'pendiente', intentos: 0 });
    expect((await cicloActual()?.almacen.operaciones())?.map((o) => o.operationId)).toEqual(['a']);
  });

  it('cada una va al almacen de su persona, no al de otra', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    await encolar(unaOperacion('de-ana'));
    await alCambiarLaSesion(null, RECORDADA);
    await alCambiarLaSesion('ana', RECORDADA);

    expect((await cicloActual()?.almacen.operaciones())?.map((o) => o.operationId)).toEqual([
      'de-ana',
    ]);
    expect(mundo.bases.has('beto')).toBe(false);
  });

  it('la fecha de creacion es la de ahora', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    const antes = Date.now();
    const guardada = await encolar(unaOperacion('a'));

    expect(new Date(guardada.creadaEn).getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(new Date(guardada.creadaEn).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('avisa a quien mira la cola DESPUES de guardar: lo que ve ya esta guardado', async () => {
    const { fabricas } = crearMundo();
    let visto: string[] = [];

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(() => {
      void cicloActual()
        ?.almacen.operaciones()
        .then((operaciones) => {
          visto = operaciones.map((o) => o.operationId);
        });
    });
    await encolar(unaOperacion('a'));
    await vi.waitFor(() => {
      expect(visto).toEqual(['a']);
    });
  });

  it('sin sesion no hay donde guardar, y lo dice', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);

    await expect(encolar(unaOperacion('a'))).rejects.toThrow(SinAlmacenAbierto);
  });

  describe('el orden sobre una misma cosa (SCRUM-139)', () => {
    const sobre = (operationId: string, entidad: string, extra: Record<string, unknown> = {}) => ({
      operationId,
      tipo: 'diario.editar' as const,
      entidad,
      payload: { id: 'x' },
      ...extra,
    });

    async function abrir() {
      const { fabricas } = crearMundo();

      reiniciarElCicloParaLasPruebas(fabricas);
      await alCambiarLaSesion('ana', RECORDADA);
    }

    it('la primera sobre una cosa no depende de nada', async () => {
      await abrir();

      expect((await encolar(sobre('a', 'diario:1'))).dependeDe).toBeNull();
    });

    it('la segunda sobre la misma cosa depende de la primera, y la tercera de la segunda', async () => {
      await abrir();
      await encolar(sobre('a', 'diario:1'));

      expect((await encolar(sobre('b', 'diario:1'))).dependeDe).toBe('a');
      expect((await encolar(sobre('c', 'diario:1'))).dependeDe).toBe('b');
    });

    it('lo que es de otra cosa no se mezcla', async () => {
      await abrir();
      await encolar(sobre('a', 'diario:1'));

      expect((await encolar(sobre('b', 'diario:2'))).dependeDe).toBeNull();
    });

    it('lo que ya termino no se espera', async () => {
      await abrir();

      const primera = await encolar(sobre('a', 'diario:1'));

      await cicloActual()?.almacen.guardarOperacion({ ...primera, estado: 'hecha' });

      expect((await encolar(sobre('b', 'diario:1'))).dependeDe).toBeNull();
    });

    it('lo que fallo si se espera: no se manda lo que depende de algo que nunca se creo', async () => {
      await abrir();

      const primera = await encolar(sobre('a', 'diario:1'));

      await cicloActual()?.almacen.guardarOperacion({ ...primera, estado: 'requiere_atencion' });

      expect((await encolar(sobre('b', 'diario:1'))).dependeDe).toBe('a');
    });

    it('quien lo dice, manda: otra operacion, o ninguna', async () => {
      await abrir();
      await encolar(sobre('a', 'diario:1'));
      await encolar(sobre('b', 'diario:1'));

      expect((await encolar(sobre('c', 'diario:1', { dependeDe: 'a' }))).dependeDe).toBe('a');
      expect((await encolar(sobre('d', 'diario:1', { dependeDe: null }))).dependeDe).toBeNull();
    });
  });

  it('si el almacen se esta abriendo, espera a que termine', async () => {
    const { fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);

    const apertura = alCambiarLaSesion('ana', RECORDADA);
    const guardada = await encolar(unaOperacion('a'));

    await apertura;

    expect(guardada.operationId).toBe('a');
    expect((await cicloActual()?.almacen.operaciones())?.length).toBe(1);
  });

  it('no avisa si no se pudo guardar', async () => {
    const { fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    suscribirALaCola(oyente);

    await expect(encolar(unaOperacion('a'))).rejects.toThrow();

    expect(oyente).not.toHaveBeenCalled();
  });
});

describe('avisos de que la cola cambio, entre pestanas (SCRUM-137)', () => {
  it('quien escucha se entera cuando algo avisa', async () => {
    const { fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(oyente);
    avisarQueLaColaCambio();

    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('quien deja de escuchar ya no se entera', async () => {
    const { fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(oyente)();
    avisarQueLaColaCambio();

    expect(oyente).not.toHaveBeenCalled();
  });

  it('las otras pestanas de la misma persona se enteran, con solo de quien es la cola', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(vi.fn());
    avisarQueLaColaCambio();

    expect(mundo.canales).toHaveLength(1);
    expect(mundo.canales[0]?.publicadas).toEqual(['ana']);
  });

  it('una aviso que llega de otra pestana de la misma persona llega a quien escucha, sin volver a publicarse', async () => {
    const { mundo, fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(oyente);
    mundo.canales[0]?.recibir('ana');

    expect(oyente).toHaveBeenCalledTimes(1);
    // Si se republicara, dos pestanas se avisarian la una a la otra para siempre.
    expect(mundo.canales[0]?.publicadas).toEqual([]);
  });

  it('el de otra persona (otra sesion en este navegador) no es de esta pestana', async () => {
    const { mundo, fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(oyente);
    mundo.canales[0]?.recibir('beto');

    expect(oyente).not.toHaveBeenCalled();
  });

  it('sin almacen abierto, un aviso de otra pestana no es de nadie', () => {
    const { mundo, fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    suscribirALaCola(oyente);
    mundo.canales[0]?.recibir('ana');

    expect(oyente).not.toHaveBeenCalled();
  });

  it('sin almacen abierto no se publica nada: no hay de quien', () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    suscribirALaCola(vi.fn());
    avisarQueLaColaCambio();

    expect(mundo.canales[0]?.publicadas).toEqual([]);
  });

  it('el canal no se abre hasta que alguien escucha, y se abre una sola vez', async () => {
    const { mundo, fabricas } = crearMundo();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);

    expect(mundo.canales).toHaveLength(0);

    suscribirALaCola(vi.fn());
    suscribirALaCola(vi.fn());

    expect(mundo.canales).toHaveLength(1);
  });

  it('donde el navegador no tiene canales, cada pestana va por su lado y no falla', async () => {
    const { mundo, fabricas } = crearMundo();
    const oyente = vi.fn();

    mundo.hayCanales = false;
    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(oyente);
    avisarQueLaColaCambio();

    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('reiniciar cierra el canal y olvida a quien escuchaba', async () => {
    const { mundo, fabricas } = crearMundo();
    const oyente = vi.fn();

    reiniciarElCicloParaLasPruebas(fabricas);
    await alCambiarLaSesion('ana', RECORDADA);
    suscribirALaCola(oyente);
    reiniciarElCicloParaLasPruebas(fabricas);

    expect(mundo.canales[0]?.cerrado).toBe(true);

    await alCambiarLaSesion('ana', RECORDADA);
    avisarQueLaColaCambio();

    expect(oyente).not.toHaveBeenCalled();
  });
});
