import type { RespuestaCondicional } from '../infraestructura/api/clienteHttp.ts';
import { cicloActual } from './ciclo.ts';
import { clasificarFallo } from './clasificarFallo.ts';
import { conLimite } from './tiempo.ts';

/**
 * Lecturas con copia local (SCRUM-138): lo que se lee de la API y se guarda en el
 * dispositivo para poder volver a leerlo sin conexion.
 *
 * ## Que se guarda, y que no
 *
 * **Solo lo que es igual para todos**: el catalogo de actividades, por ejemplo. Lo de
 * una persona —su diario, sus resultados— se lee con `no-store` a proposito, y su
 * copia es otro tema (SCRUM-139 y 140), con sus propias reglas.
 *
 * Aun asi, la copia vive en el almacen **de la persona** y cifrada, como todo lo
 * demas: se borra al cerrar sesion, y nada queda en claro en un equipo compartido.
 *
 * ## Como se lee
 *
 * 1. Se pregunta a la API, mandando el `ETag` de la copia: si no cambio, el
 *    servidor responde `304` y no baja nada.
 * 2. Si hay algo nuevo, se guarda con su `ETag` y se devuelve.
 * 3. **Si no se pudo preguntar porque no hay conexion** (o el servidor no responde),
 *    se devuelve la copia, diciendo que lo es.
 * 4. Si falla por otra razon —el servidor dijo que no—, el error sale tal cual: una
 *    copia no tapa un "no existe" o un "no tienes permiso".
 *
 * Sin copia y sin conexion, no hay nada que devolver: el error sale, y quien llama
 * dice que hace falta conexion la primera vez. **Nunca se inventa un valor.**
 */

export interface LecturaConCopia<T> {
  readonly valor: T;
  /** Si viene de la copia guardada porque no se pudo preguntar a la API. */
  readonly deLaCopia: boolean;
  /** Cuando se guardo la copia, en ISO 8601, si se uso una. */
  readonly guardadoEn: string | null;
}

interface Copia<T> {
  readonly valor: T;
  readonly etag: string | null;
}

/**
 * Cuanto se espera a la API cuando ya hay una copia, antes de usar la copia y seguir en
 * segundo plano. Con una red lenta o una API dormida, abrir algo no puede quedarse
 * esperando: la copia ya sirve.
 */
export const ESPERA_CON_COPIA_EN_MS = 2500;

/** Lo que cuesta una copia que no se puede leer: nada. Se trata como si no hubiera. */
async function leerLaCopia<T>(
  clave: string,
): Promise<{ readonly copia: Copia<T>; readonly guardadoEn: string } | null> {
  try {
    const lectura = await cicloActual()?.almacen.leerLectura<Copia<T>>(clave);

    if (lectura === null || lectura === undefined) {
      return null;
    }

    const { valor } = lectura;

    // Lo guardado puede no tener la forma esperada (lo escribio otra version).
    if (typeof valor !== 'object' || valor === null || !('valor' in valor)) {
      return null;
    }

    return { copia: valor, guardadoEn: lectura.guardadoEn };
  } catch {
    // El almacen se cerro, o no se pudo descifrar: no hay copia que valga.
    return null;
  }
}

/**
 * Lo que hay guardado de `clave`, **sin preguntar a la API**. Para lo que solo
 * necesita acordarse de algo ya leido: el nombre de una actividad, por ejemplo.
 */
export async function leerSoloLaCopia<T>(clave: string): Promise<T | null> {
  return (await leerLaCopia<T>(clave))?.copia.valor ?? null;
}

async function guardarLaCopia<T>(clave: string, copia: Copia<T>): Promise<void> {
  try {
    await cicloActual()?.almacen.guardarLectura(clave, copia, new Date());
  } catch {
    // Sin espacio, o el almacen se cerro. La lectura ya se hizo: no se pierde por esto.
  }
}

/**
 * Cuando se uso la copia sin esperar a la API, la lectura sigue sola: si trae algo nuevo,
 * se guarda para la proxima vez. Si falla, no pasa nada: la copia ya se uso.
 */
function renovarEnSegundoPlano<T>(clave: string, pedida: Promise<RespuestaCondicional<T>>): void {
  void pedida
    .then(async (despues) => {
      if (despues.estado === 'nuevo') {
        await guardarLaCopia(clave, { valor: despues.valor, etag: despues.etag });
      }
    })
    .catch(() => undefined);
}

/** Una peticion cancelada no es "no hay conexion": quien la cancelo ya no espera nada. */
function seCancelo(error: unknown, senal: AbortSignal | undefined): boolean {
  return senal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError');
}

/**
 * Lee `clave` de la API, o de la copia si no se puede. Ver arriba.
 *
 * @param traer Hace la lectura condicional: recibe el `ETag` de la copia, si hay.
 */
export async function leerConCopia<T>(
  clave: string,
  traer: (etag: string | null) => Promise<RespuestaCondicional<T>>,
  senal?: AbortSignal,
): Promise<LecturaConCopia<T>> {
  const guardada = await leerLaCopia<T>(clave);

  try {
    const pedida = traer(guardada?.copia.etag ?? null);
    let respuesta: RespuestaCondicional<T>;

    if (guardada === null) {
      // Sin copia no hay otra cosa que hacer que esperar.
      respuesta = await pedida;
    } else {
      // Con copia, no se hace esperar a la persona: pasado el tiempo se usa la copia, y
      // la lectura sigue en segundo plano para renovarla.
      const alcanzo = await conLimite(pedida, ESPERA_CON_COPIA_EN_MS);

      if (alcanzo === 'tiempo') {
        renovarEnSegundoPlano(clave, pedida);

        return { valor: guardada.copia.valor, deLaCopia: true, guardadoEn: guardada.guardadoEn };
      }

      respuesta = alcanzo;
    }

    if (respuesta.estado === 'sin_cambios') {
      if (guardada !== null) {
        return { valor: guardada.copia.valor, deLaCopia: false, guardadoEn: guardada.guardadoEn };
      }

      // El servidor dijo "no cambio" sin que se hubiera preguntado por nada: no
      // hay valor que devolver. No debe pasar; si pasa, que se note.
      throw new Error('El servidor dijo que no cambio algo de lo que no hay copia.');
    }

    await guardarLaCopia(clave, { valor: respuesta.valor, etag: respuesta.etag });

    return { valor: respuesta.valor, deLaCopia: false, guardadoEn: null };
  } catch (error) {
    if (seCancelo(error, senal)) {
      throw error;
    }

    const clase = clasificarFallo(error).clase;

    // Solo cuando no se pudo llegar a la API. Lo demas es una respuesta, y se respeta.
    if (guardada !== null && (clase === 'red' || clase === 'temporal')) {
      return { valor: guardada.copia.valor, deLaCopia: true, guardadoEn: guardada.guardadoEn };
    }

    throw error;
  }
}
