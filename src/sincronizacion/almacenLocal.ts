import { deleteDB, openDB, type IDBPDatabase } from 'idb';

import { abrir, esSellado, sellar, type Sellado } from './cifrado.ts';
import type { Llavero } from './llavero.ts';
import type { Operacion } from './cola.ts';

/**
 * Lo que una persona tiene guardado en su dispositivo (SCRUM-136).
 *
 * Son tres cosas, y todas de **una sola persona**:
 *
 * - **Lecturas**: la ultima copia de lo que la API devolvio (el catalogo, el
 *   semaforo, el progreso...), para poder mostrarlo sin conexion.
 * - **La cola**: lo que la persona hizo sin conexion y todavia no se envio.
 * - **Meta**: apuntes del propio mecanismo (cuando se sincronizo por ultima vez).
 *
 * Hay dos implementaciones con exactamente la misma conducta (y las mismas
 * pruebas): **IndexedDB, cifrada**, para quien recuerda la sesion en este equipo, y
 * **en memoria**, para quien no (la sesion de una sala de computo no puede dejar
 * nada escrito) y como respaldo si el navegador no deja usar IndexedDB.
 *
 * ## Una base por persona
 *
 * `vsd-<persona>`. Dos personas en el mismo equipo no comparten nada: ni la base,
 * ni la clave que la cifra. Borrar a una persona es borrar su base y su clave.
 */

export interface LecturaGuardada<T = unknown> {
  readonly valor: T;
  /** Cuando se guardo la copia, en ISO 8601: es lo que la pantalla muestra como "datos de hace...". */
  readonly guardadoEn: string;
}

/** No hay espacio para guardar mas en este dispositivo. */
export class AlmacenLleno extends Error {
  constructor() {
    super('No hay espacio en este dispositivo para guardar mas.');
    this.name = 'AlmacenLleno';
  }
}

/** Se uso un almacen despues de cerrarlo o vaciarlo. Es un error de programacion. */
export class AlmacenCerrado extends Error {
  constructor() {
    super('El almacen local ya esta cerrado.');
    this.name = 'AlmacenCerrado';
  }
}

export interface AlmacenLocal {
  /** De quien es todo lo que hay aqui. */
  readonly persona: string;

  /** Si lo que se guarda sobrevive a cerrar la pestana. */
  readonly persistente: boolean;

  guardarLectura(clave: string, valor: unknown, ahora: Date): Promise<void>;
  leerLectura<T = unknown>(clave: string): Promise<LecturaGuardada<T> | null>;
  borrarLectura(clave: string): Promise<void>;

  /**
   * Agrega una operacion al final de la cola, y devuelve la que quedo guardada.
   *
   * **Es idempotente por `operationId`**: si ya hay una con ese identificador, no
   * agrega otra y devuelve la que estaba. Quien encola puede reintentar sin miedo
   * a duplicar, igual que la API.
   */
  agregarOperacion(operacion: Operacion): Promise<Operacion>;

  /** Todas, en el orden en que llegaron. Una que no se pueda leer sale marcada `ilegible`. */
  operaciones(): Promise<readonly Operacion[]>;
  operacion(operationId: string): Promise<Operacion | null>;

  /** Reemplaza una que ya estaba (cambia su estado, sus intentos, su recibo). */
  guardarOperacion(operacion: Operacion): Promise<void>;
  quitarOperacion(operationId: string): Promise<void>;

  leerMeta<T = unknown>(clave: string): Promise<T | null>;
  guardarMeta(clave: string, valor: unknown): Promise<void>;

  /** Borra todo lo de esta persona. El almacen no se puede volver a usar. */
  vaciar(): Promise<void>;

  /** Suelta la conexion sin borrar nada. */
  cerrar(): void;
}

/**
 * Convierte el error de "no hay espacio" de IndexedDB en el nuestro. Cualquier
 * otro se deja pasar: no es esto lo que fallo.
 */
export function traducirErrorDeAlmacen(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    ((error as { name?: unknown }).name === 'QuotaExceededError' ||
      (error as { code?: unknown }).code === 22)
  ) {
    return new AlmacenLleno();
  }

  return error;
}

// ---------------------------------------------------------------------------
// En IndexedDB, cifrada
// ---------------------------------------------------------------------------

const LECTURAS = 'lecturas';
const COLA = 'cola';
const META = 'meta';
const CLAVE_DEL_ORDEN = 'orden';

/** El nombre de la base de una persona. */
export function nombreDeLaBase(persona: string): string {
  return `vsd-${persona}`;
}

interface RegistroDeLectura {
  readonly clave: string;
  readonly guardadoEn: string;
  readonly sello: Sellado;
}

interface RegistroDeOperacion extends Omit<Operacion, 'payload' | 'recibo' | 'ilegible'> {
  readonly payload: Sellado;
  readonly recibo: Sellado | null;
}

interface RegistroDeMeta {
  readonly clave: string;
  readonly valor: unknown;
}

function esRegistroDeOperacion(valor: unknown): valor is RegistroDeOperacion {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as { operationId?: unknown }).operationId === 'string' &&
    esSellado((valor as { payload?: unknown }).payload)
  );
}

export async function abrirAlmacenEnIndexedDB(
  persona: string,
  llavero: Llavero,
): Promise<AlmacenLocal> {
  const nombre = nombreDeLaBase(persona);
  let cerrado = false;
  const base: IDBPDatabase = await openDB(nombre, 1, {
    upgrade(db) {
      db.createObjectStore(LECTURAS, { keyPath: 'clave' });
      db.createObjectStore(COLA, { keyPath: 'operationId' });
      db.createObjectStore(META, { keyPath: 'clave' });
    },
    // Otra pestana quiere borrar esta base (la persona cerro sesion alli). Borrar
    // una base espera a que TODAS las conexiones la suelten, asi que si esta no
    // se cierra, el cierre de sesion de la otra pestana se queda colgado. Se
    // cierra y se marca: lo que se pida despues dira "cerrado", no fallara raro.
    blocking(_version, _versionPedida, evento) {
      cerrado = true;
      (evento.target as IDBDatabase | null)?.close();
    },
  });
  const clave = await llavero.obtenerOCrear(persona);

  const contextoDeLectura = (nombreDeLectura: string): string =>
    `${persona}|${LECTURAS}|${nombreDeLectura}`;
  const contextoDeCola = (operationId: string, campo: 'payload' | 'recibo'): string =>
    `${persona}|${COLA}|${operationId}|${campo}`;

  function vigente(): void {
    if (cerrado) {
      throw new AlmacenCerrado();
    }
  }

  async function aRegistro(operacion: Operacion, orden: number): Promise<RegistroDeOperacion> {
    const { payload, recibo, ilegible: _ilegible, ...resto } = operacion;

    return {
      ...resto,
      orden,
      payload: await sellar(clave, contextoDeCola(operacion.operationId, 'payload'), payload),
      recibo:
        recibo === null || recibo === undefined
          ? null
          : await sellar(clave, contextoDeCola(operacion.operationId, 'recibo'), recibo),
    };
  }

  async function aOperacion(registro: RegistroDeOperacion): Promise<Operacion> {
    const { payload: sellado, recibo: selladoDelRecibo, ...resto } = registro;

    try {
      return {
        ...resto,
        payload: await abrir(clave, contextoDeCola(registro.operationId, 'payload'), sellado),
        recibo:
          selladoDelRecibo === null
            ? null
            : await abrir(clave, contextoDeCola(registro.operationId, 'recibo'), selladoDelRecibo),
      };
    } catch {
      // No se puede leer: no se envia y tampoco se descarta. Sale marcada y el
      // motor la pasa a "requiere atencion".
      return { ...resto, payload: null, recibo: null, ilegible: true };
    }
  }

  return {
    persona,
    persistente: true,

    async guardarLectura(nombreDeLectura, valor, ahora) {
      vigente();

      const registro: RegistroDeLectura = {
        clave: nombreDeLectura,
        guardadoEn: ahora.toISOString(),
        sello: await sellar(clave, contextoDeLectura(nombreDeLectura), valor),
      };

      try {
        await base.put(LECTURAS, registro);
      } catch (error) {
        throw traducirErrorDeAlmacen(error);
      }
    },

    async leerLectura<T>(nombreDeLectura: string) {
      vigente();

      const registro = (await base.get(LECTURAS, nombreDeLectura)) as RegistroDeLectura | undefined;

      if (registro === undefined || !esSellado(registro.sello)) {
        return null;
      }

      try {
        return {
          valor: await abrir<T>(clave, contextoDeLectura(nombreDeLectura), registro.sello),
          guardadoEn: registro.guardadoEn,
        };
      } catch {
        // Una copia que no se puede leer no sirve de nada y estorba: se tira, y
        // la pantalla pedira la de verdad cuando haya red.
        await base.delete(LECTURAS, nombreDeLectura);

        return null;
      }
    },

    async borrarLectura(nombreDeLectura) {
      vigente();
      await base.delete(LECTURAS, nombreDeLectura);
    },

    async agregarOperacion(operacion) {
      vigente();

      // Se cifra ANTES de abrir la transaccion. Una transaccion de IndexedDB se
      // cierra sola en cuanto espera algo que no sea IndexedDB, y cifrar es
      // justo eso: con la transaccion abierta, el `put` de despues fallaria con
      // "TransactionInactiveError". El orden de llegada va sin cifrar, asi que
      // no hace falta saberlo todavia.
      const cifrada = await aRegistro(operacion, 0);

      const transaccion = base.transaction([COLA, META], 'readwrite');
      const existente = (await transaccion.objectStore(COLA).get(operacion.operationId)) as
        RegistroDeOperacion | undefined;

      if (existente !== undefined) {
        // Ya estaba: no se duplica. La transaccion termina sin escribir nada.
        await transaccion.done;

        return aOperacion(existente);
      }

      const contador = (await transaccion.objectStore(META).get(CLAVE_DEL_ORDEN)) as
        RegistroDeMeta | undefined;
      const orden = (typeof contador?.valor === 'number' ? contador.valor : 0) + 1;

      try {
        await transaccion.objectStore(COLA).put({ ...cifrada, orden });
        await transaccion.objectStore(META).put({ clave: CLAVE_DEL_ORDEN, valor: orden });
        await transaccion.done;
      } catch (error) {
        throw traducirErrorDeAlmacen(error);
      }

      return { ...operacion, orden };
    },

    async operaciones() {
      vigente();

      const registros = (await base.getAll(COLA)) as unknown[];
      const validos = registros.filter(esRegistroDeOperacion);
      const operaciones = await Promise.all(validos.map((registro) => aOperacion(registro)));

      return operaciones.sort((uno, otro) => uno.orden - otro.orden);
    },

    async operacion(operationId) {
      vigente();

      const registro: unknown = await base.get(COLA, operationId);

      return esRegistroDeOperacion(registro) ? aOperacion(registro) : null;
    },

    async guardarOperacion(operacion) {
      vigente();

      const anterior: unknown = await base.get(COLA, operacion.operationId);

      if (!esRegistroDeOperacion(anterior)) {
        throw new Error('La operacion que se quiere guardar no esta en la cola.');
      }

      // El orden de llegada es de la cola y no cambia al editar.
      const registro = await aRegistro(operacion, anterior.orden);

      try {
        await base.put(COLA, registro);
      } catch (error) {
        throw traducirErrorDeAlmacen(error);
      }
    },

    async quitarOperacion(operationId) {
      vigente();
      await base.delete(COLA, operationId);
    },

    async leerMeta<T>(nombreDeMeta: string) {
      vigente();

      const registro = (await base.get(META, nombreDeMeta)) as RegistroDeMeta | undefined;

      return registro === undefined ? null : (registro.valor as T);
    },

    async guardarMeta(nombreDeMeta, valor) {
      vigente();
      await base.put(META, { clave: nombreDeMeta, valor } satisfies RegistroDeMeta);
    },

    async vaciar() {
      cerrado = true;
      base.close();
      await deleteDB(nombre);
    },

    cerrar() {
      cerrado = true;
      base.close();
    },
  };
}

// ---------------------------------------------------------------------------
// En memoria
// ---------------------------------------------------------------------------

/**
 * El almacen que no escribe en ningun sitio. Lo que guarda dura lo que dure la
 * pagina. Hace lo mismo que el de IndexedDB, salvo lo que no tiene sentido sin un
 * disco: no hay nada que cifrar ni que pueda quedar ilegible.
 */
export function crearAlmacenEnMemoria(persona: string): AlmacenLocal {
  const lecturas = new Map<string, LecturaGuardada>();
  const cola = new Map<string, Operacion>();
  const meta = new Map<string, unknown>();
  let orden = 0;
  let cerrado = false;

  /**
   * Hace la accion si el almacen sigue abierto. Siempre devuelve una promesa: un
   * almacen cerrado **rechaza**, no lanza, igual que el de IndexedDB. Quien lo use
   * con `await` o con `.catch` no tiene que saber cual de los dos tiene delante.
   */
  function siEstaAbierto<T>(accion: () => T): Promise<T> {
    if (cerrado) {
      return Promise.reject(new AlmacenCerrado());
    }

    try {
      return Promise.resolve(accion());
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error('Fallo el almacen en memoria.'),
      );
    }
  }

  return {
    persona,
    persistente: false,

    guardarLectura(clave, valor, ahora) {
      return siEstaAbierto(() => {
        lecturas.set(clave, {
          valor: structuredClone(valor ?? null),
          guardadoEn: ahora.toISOString(),
        });
      });
    },

    leerLectura<T>(clave: string) {
      return siEstaAbierto(() => {
        const lectura = lecturas.get(clave);

        return lectura === undefined
          ? null
          : ({
              valor: structuredClone(lectura.valor),
              guardadoEn: lectura.guardadoEn,
            } as LecturaGuardada<T>);
      });
    },

    borrarLectura(clave) {
      return siEstaAbierto(() => {
        lecturas.delete(clave);
      });
    },

    agregarOperacion(operacion) {
      return siEstaAbierto(() => {
        const existente = cola.get(operacion.operationId);

        if (existente !== undefined) {
          return structuredClone(existente);
        }

        orden += 1;

        const guardada: Operacion = structuredClone({ ...operacion, orden });

        cola.set(operacion.operationId, guardada);

        return structuredClone(guardada);
      });
    },

    operaciones() {
      return siEstaAbierto(() =>
        [...cola.values()]
          .sort((uno, otro) => uno.orden - otro.orden)
          .map((o) => structuredClone(o)),
      );
    },

    operacion(operationId) {
      return siEstaAbierto(() => {
        const operacion = cola.get(operationId);

        return operacion === undefined ? null : structuredClone(operacion);
      });
    },

    guardarOperacion(operacion) {
      return siEstaAbierto(() => {
        const anterior = cola.get(operacion.operationId);

        if (anterior === undefined) {
          throw new Error('La operacion que se quiere guardar no esta en la cola.');
        }

        cola.set(operacion.operationId, structuredClone({ ...operacion, orden: anterior.orden }));
      });
    },

    quitarOperacion(operationId) {
      return siEstaAbierto(() => {
        cola.delete(operationId);
      });
    },

    leerMeta<T>(clave: string) {
      return siEstaAbierto(() =>
        meta.has(clave) ? (structuredClone(meta.get(clave)) as T) : null,
      );
    },

    guardarMeta(clave, valor) {
      return siEstaAbierto(() => {
        meta.set(clave, structuredClone(valor ?? null));
      });
    },

    vaciar() {
      cerrado = true;
      lecturas.clear();
      cola.clear();
      meta.clear();

      return Promise.resolve();
    },

    cerrar() {
      cerrado = true;
    },
  };
}
