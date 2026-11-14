import { esReglasLocales } from '../asistente/reglasLocales.ts';
import {
  consultarLasReglasLocales,
  type ReglasLocales,
} from '../infraestructura/api/reglasLocales.ts';
import { leerConCopia, leerSoloLaCopia, type LecturaConCopia } from './lecturas.ts';

/**
 * Las reglas de VSD IA para responder sin conexion, con copia en este dispositivo
 * (SCRUM-141).
 *
 * Son iguales para todo el mundo y no contienen nada de nadie (las publica el servidor en
 * una ruta publica), asi que se leen como el catalogo: preguntando con el `ETag` de la
 * copia, de modo que si no cambiaron no se baja nada. La copia vive en el almacen de la
 * persona, cifrada, como las demas, y se vuelve a bajar al abrir una sesion.
 *
 * ## Lo que se acepta
 *
 * Solo un paquete **del esquema que esta aplicacion sabe aplicar** y completo. Si el
 * servidor publica otro (una version mas nueva), o lo guardado es de otra version, no se
 * usa: se sigue con la copia que valga, o con nada. **Nunca se aplica a medias** una regla
 * que no se entiende: seria responder lo que nadie reviso.
 *
 * Sin copia y sin conexion no hay reglas, y el asistente se comporta como antes de
 * SCRUM-141: dice que no pudo responder.
 */

export const CLAVE_DE_LAS_REGLAS_LOCALES = 'asistente-reglas-locales';

/**
 * Las reglas: del servidor si se puede, de la copia si no. Ver `leerConCopia` para el
 * resto del comportamiento (tiempo de espera, errores que la copia no tapa).
 *
 * Si lo que llega no se entiende, se sigue con la copia (y sin copia, falla).
 */
export async function leerLasReglasLocalesConCopia(
  senal?: AbortSignal,
): Promise<LecturaConCopia<ReglasLocales>> {
  const lectura = await leerConCopia<ReglasLocales>(
    CLAVE_DE_LAS_REGLAS_LOCALES,
    async (etag) => {
      const respuesta = await consultarLasReglasLocales(etag, senal);

      // Un paquete que no se entiende ni se guarda ni se usa: "no cambio nada".
      return respuesta.estado === 'nuevo' && !esReglasLocales(respuesta.valor)
        ? { estado: 'sin_cambios' }
        : respuesta;
    },
    senal,
  );

  // Lo guardado puede ser de otra version: una copia que no se entiende es como no tenerla.
  if (!esReglasLocales(lectura.valor)) {
    throw new TypeError('Las reglas guardadas no se pueden leer.');
  }

  return lectura;
}

/**
 * Lo que hay guardado, **sin preguntar a nadie**: lo que se usa cuando no hay conexion.
 * `null` si no hay nada, o si lo guardado no se entiende.
 */
export async function leerLasReglasLocalesGuardadas(): Promise<ReglasLocales | null> {
  const guardadas = await leerSoloLaCopia<unknown>(CLAVE_DE_LAS_REGLAS_LOCALES);

  return esReglasLocales(guardadas) ? guardadas : null;
}

/** Las lee por adelantado, para tenerlas cuando no haya conexion. Ver `precarga.ts`. */
export function precargarLasReglasLocales(): Promise<unknown> {
  return leerLasReglasLocalesConCopia();
}
