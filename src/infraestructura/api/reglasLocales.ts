import { leerSiCambio, type RespuestaCondicional } from './clienteHttp.ts';
import type { LineaDeAtencion } from './resultados.ts';

/**
 * Las reglas de VSD IA para responder lo basico sin conexion (SCRUM-141), tal como las
 * publica el servidor en `GET /api/asistente/reglas-locales`.
 *
 * Son **los mismos datos** que usa el servidor para responder con conexion: la deteccion
 * de riesgo, la charla de todos los dias, lo que se reconoce de lo demas y las lineas de
 * ayuda de cada pais. Esta aplicacion no lleva una segunda lista: aplica esta.
 *
 * Es una ruta publica y la misma para todo el mundo (no sale de la cuenta de nadie), con
 * `ETag`: se lee con `leerSiCambio`, como el catalogo, y se guarda en el dispositivo.
 *
 * Esta ruta solo baja. Lo que una persona escribe sin conexion no viaja por aqui ni se
 * envia despues.
 */

/**
 * La version de la **forma** del paquete que esta aplicacion sabe aplicar. Si el servidor
 * publica otra, no se usa: se sigue con lo que ya habia guardado.
 */
export const ESQUEMA_QUE_ENTIENDE_LA_APLICACION = 1;

/** Otra respuesta para la misma intencion, segun lo que diga el mensaje. */
export interface VarianteDeLaCharla {
  readonly patrones: readonly string[];
  readonly mensaje: string;
}

export interface ReglaLocalDeCharla {
  readonly intencion: string;
  readonly patrones: readonly string[];
  /** Lo que se responde sin conexion, o `null` si esa intencion no se puede responder asi. */
  readonly mensaje: string | null;
  readonly variantes: readonly VarianteDeLaCharla[];
}

export interface ReglaLocalDeIntencion {
  readonly intencion: string;
  readonly patrones: readonly string[];
  /** Lo que se responde sin conexion, o `null` si esa intencion exige conexion. */
  readonly mensaje: string | null;
  /** Si la respuesta lleva las lineas de atencion del pais de la persona. */
  readonly conLineas: boolean;
}

export interface PaisConLineas {
  readonly zonas: readonly string[];
  readonly lineas: readonly LineaDeAtencion[];
}

export interface ReglasLocales {
  readonly esquema: number;
  /** La deteccion de riesgo. Va siempre primero, igual que en el servidor. */
  readonly riesgo: {
    /** Ya normalizadas: sin tildes y en minusculas. */
    readonly expresiones: readonly string[];
    readonly mensaje: string;
  };
  /** La charla de todos los dias: solo cuenta si el mensaje entero es charla. */
  readonly charla: {
    /** En el orden en que se evaluan: la primera que coincide gana. */
    readonly reglas: readonly ReglaLocalDeCharla[];
    readonly relleno: readonly string[];
  };
  /** Lo demas que el servidor reconoce, en su orden. */
  readonly intenciones: readonly ReglaLocalDeIntencion[];
  /** Los paises con lineas verificadas, por su codigo de dos letras. */
  readonly paises: Readonly<Record<string, PaisConLineas>>;
  /** Lo que recibe quien esta en una zona sin pais: el directorio internacional. */
  readonly internacional: readonly LineaDeAtencion[];
}

export const RUTA_DE_LAS_REGLAS_LOCALES = '/api/asistente/reglas-locales';

/**
 * Pide las reglas. Con el `ETag` de la copia, el servidor responde `304` y no baja nada
 * si no cambiaron.
 */
export function consultarLasReglasLocales(
  etag: string | null,
  senal?: AbortSignal,
): Promise<RespuestaCondicional<ReglasLocales>> {
  return leerSiCambio<ReglasLocales>(RUTA_DE_LAS_REGLAS_LOCALES, {
    etag,
    ...(senal ? { senal } : {}),
  });
}
