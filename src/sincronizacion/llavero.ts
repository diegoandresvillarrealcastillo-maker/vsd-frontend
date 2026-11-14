import { openDB, type IDBPDatabase } from 'idb';

import { generarLaClave } from './cifrado.ts';

/**
 * Donde viven las claves de cifrado (SCRUM-136).
 *
 * **Aparte de lo que cifran.** Las copias y la cola de cada persona viven en su
 * propia base (`vsd-<persona>`); las claves, en esta (`vsd-llavero`). Guardar la
 * clave junto a lo que protege seria dejar la llave pegada a la cerradura.
 *
 * Una clave por persona. Como es `CryptoKey` **no extraible**, IndexedDB la
 * guarda sin que el codigo pueda leer nunca sus bytes: solo puede usarla para
 * cifrar y descifrar. Si se borra la clave, lo que cifro queda ilegible para
 * siempre: por eso borrar la clave es la forma de olvidar a una persona.
 *
 * El llavero tambien es el **registro de a quien pertenecen las bases** que hay en
 * este dispositivo. Asi se sabe cuales borrar cuando entra otra persona, sin
 * depender de `indexedDB.databases()`, que no existe en todos los navegadores.
 */
export interface Llavero {
  /** La clave de la persona; la crea si no habia. Dos llamadas a la vez dan la misma. */
  obtenerOCrear(persona: string): Promise<CryptoKey>;

  /** Las personas que tienen clave en este dispositivo. */
  personas(): Promise<readonly string[]>;

  /** Borra la clave de una persona. Lo que cifro deja de poder leerse. */
  olvidar(persona: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// En IndexedDB
// ---------------------------------------------------------------------------

const NOMBRE_DEL_LLAVERO = 'vsd-llavero';
const ALMACEN_DE_CLAVES = 'claves';

interface RegistroDeClave {
  readonly persona: string;
  readonly clave: CryptoKey;
  readonly creadaEn: string;
}

function abrirElLlavero(nombre: string): Promise<IDBPDatabase> {
  return openDB(nombre, 1, {
    upgrade(base) {
      base.createObjectStore(ALMACEN_DE_CLAVES, { keyPath: 'persona' });
    },
  });
}

export function crearLlaveroEnIndexedDB(nombre: string = NOMBRE_DEL_LLAVERO): Llavero {
  let base: Promise<IDBPDatabase> | null = null;

  function abierta(): Promise<IDBPDatabase> {
    base ??= abrirElLlavero(nombre);

    return base;
  }

  return {
    async obtenerOCrear(persona) {
      const db = await abierta();
      const existente = (await db.get(ALMACEN_DE_CLAVES, persona)) as RegistroDeClave | undefined;

      if (existente !== undefined) {
        return existente.clave;
      }

      // Generar la clave no es una operacion de IndexedDB, asi que no puede
      // hacerse dentro de una transaccion (se cerraria sola mientras espera). Se
      // genera antes, y despues se vuelve a mirar: si en ese rato otra pestana
      // guardo la suya, gana la que llego primero y esta se descarta. Dos
      // pestanas nunca acaban con claves distintas.
      const nueva = await generarLaClave();
      const transaccion = db.transaction(ALMACEN_DE_CLAVES, 'readwrite');
      const llegoOtra = (await transaccion.store.get(persona)) as RegistroDeClave | undefined;

      if (llegoOtra !== undefined) {
        await transaccion.done;

        return llegoOtra.clave;
      }

      const registro: RegistroDeClave = {
        persona,
        clave: nueva,
        creadaEn: new Date().toISOString(),
      };

      await transaccion.store.put(registro);
      await transaccion.done;

      return nueva;
    },

    async personas() {
      const db = await abierta();

      return (await db.getAllKeys(ALMACEN_DE_CLAVES)) as string[];
    },

    async olvidar(persona) {
      const db = await abierta();

      await db.delete(ALMACEN_DE_CLAVES, persona);
    },
  };
}

// ---------------------------------------------------------------------------
// En memoria
// ---------------------------------------------------------------------------

/**
 * Un llavero que no escribe en ningun sitio: las claves duran lo que dure la
 * pagina. Es el de las sesiones que no se recuerdan en este equipo, y el de
 * respaldo cuando el navegador no deja usar IndexedDB.
 */
export function crearLlaveroEnMemoria(): Llavero {
  const claves = new Map<string, Promise<CryptoKey>>();

  return {
    obtenerOCrear(persona) {
      let clave = claves.get(persona);

      if (clave === undefined) {
        clave = generarLaClave();
        claves.set(persona, clave);
      }

      return clave;
    },

    personas() {
      return Promise.resolve([...claves.keys()]);
    },

    olvidar(persona) {
      claves.delete(persona);

      return Promise.resolve();
    },
  };
}
