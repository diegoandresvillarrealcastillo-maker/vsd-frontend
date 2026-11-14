import type {
  Adjunto,
  Anotacion,
  AnotacionPorEscribir,
  CambiosDeAnotacion,
  NodoDelDocumento,
} from '../infraestructura/api/diario.ts';

/**
 * Lo del diario que comparten la cola y la pantalla (SCRUM-139): la forma de lo que se
 * guarda en una operacion, la de lo que responde la API y como se reconoce cada cosa.
 *
 * No importa nada del ciclo ni del motor: lo usan los ejecutores (que corren dentro del
 * motor) y tambien el almacen local de la pantalla.
 */

/** Por que una edicion no se pudo aplicar y se guardo como una anotacion nueva (ADR 0009). */
export type MotivoDeLaCopia = 'VERSION_DESACTUALIZADA' | 'EDICION_FUERA_DE_PLAZO';

export const MOTIVOS_DE_LA_COPIA: ReadonlySet<string> = new Set<MotivoDeLaCopia>([
  'VERSION_DESACTUALIZADA',
  'EDICION_FUERA_DE_PLAZO',
]);

/**
 * Lo que guarda la cola al escribir una anotacion: lo que se le manda a la API, y, si la
 * escribe el propio dispositivo como copia de otra (ya paso la hora para corregirla),
 * de cual y por que.
 *
 * `copiaDe` y `motivo` **no viajan**: son para la pantalla y para recordar que es una
 * copia cuando la API responda. Es la misma marca que deja una correccion que la API no
 * dejo hacer (ver `AnotacionCopiada`).
 */
export interface EscrituraEnCola extends AnotacionPorEscribir {
  readonly copiaDe?: string;
  readonly motivo?: MotivoDeLaCopia;
}

/**
 * Lo que guarda la cola al corregir una anotacion: lo que se le manda a la API
 * (`CambiosDeAnotacion`), mas el `id` de la anotacion y el `dia` en el que esta.
 *
 * El `dia` **no viaja** en la correccion: se guarda por si la API dice que ya no se puede
 * corregir, para escribir lo mismo como una anotacion nueva del mismo dia sin perderlo.
 */
export interface EdicionEnCola extends Partial<CambiosDeAnotacion> {
  readonly id: string;
  readonly dia?: string;
}

/**
 * Lo que responde una edicion que no se pudo aplicar y se guardo aparte: la anotacion
 * nueva, y de cual es copia.
 */
export interface AnotacionCopiada extends Anotacion {
  readonly copiaDe: string;
  readonly motivo: MotivoDeLaCopia;
}

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

/**
 * Si algo que respondio la API (o que se guardo hace tiempo) tiene la forma de una
 * anotacion. Se comprueba todo lo que la pantalla usa: una copia guardada por otra version
 * de la aplicacion no debe romper el diario.
 */
export function esAnotacion(valor: unknown): valor is Anotacion {
  return (
    esObjeto(valor) &&
    esTexto(valor.id) &&
    typeof valor.dia === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor.dia) &&
    (valor.titulo === null || typeof valor.titulo === 'string') &&
    esObjeto(valor.contenido) &&
    Array.isArray(valor.adjuntos) &&
    typeof valor.version === 'number' &&
    Number.isInteger(valor.version) &&
    esTexto(valor.creadaEn) &&
    esTexto(valor.editadaEn) &&
    esTexto(valor.editableHasta)
  );
}

/** Si lo que respondio una edicion es una anotacion que se guardo aparte. */
export function esAnotacionCopiada(valor: unknown): valor is AnotacionCopiada {
  return (
    esAnotacion(valor) &&
    esTexto((valor as unknown as Objeto).copiaDe) &&
    MOTIVOS_DE_LA_COPIA.has((valor as unknown as Objeto).motivo as string)
  );
}

/**
 * La anotacion sin lo que acompana a la respuesta (las lineas de atencion y de cual es
 * copia): lo que se guarda en la copia local del historial.
 */
export function soloLaAnotacion(valor: Anotacion): Anotacion {
  return {
    id: valor.id,
    dia: valor.dia,
    titulo: valor.titulo,
    contenido: valor.contenido,
    adjuntos: valor.adjuntos,
    version: valor.version,
    creadaEn: valor.creadaEn,
    editadaEn: valor.editadaEn,
    editableHasta: valor.editableHasta,
  };
}

/**
 * Si dos valores JSON dicen lo mismo. Una base de datos con `jsonb` no conserva el orden
 * de las claves, asi que comparar el texto no sirve: dos documentos iguales pueden
 * volver con las claves en otro orden.
 */
export function sonIguales(uno: unknown, otro: unknown): boolean {
  if (uno === otro) {
    return true;
  }

  if (Array.isArray(uno) || Array.isArray(otro)) {
    return (
      Array.isArray(uno) &&
      Array.isArray(otro) &&
      uno.length === otro.length &&
      uno.every((valor, indice) => sonIguales(valor, otro[indice]))
    );
  }

  if (!esObjeto(uno) || !esObjeto(otro)) {
    return false;
  }

  // Una clave sin valor es lo mismo que una clave que no esta.
  const claves = (objeto: Objeto) =>
    Object.keys(objeto).filter((clave) => objeto[clave] !== undefined);
  const delUno = claves(uno);
  const delOtro = claves(otro);

  return (
    delUno.length === delOtro.length &&
    delUno.every((clave) => clave in otro && sonIguales(uno[clave], otro[clave]))
  );
}

/**
 * Si lo que pide una edicion ya esta en la anotacion tal como la tiene el servidor.
 *
 * Pasa cuando se mando la correccion, el servidor la aplico y la respuesta se perdio: el
 * reintento lleva la version de antes y la API contesta que otro dispositivo la cambio,
 * cuando fue esta misma correccion. Eso **no** es un conflicto y no merece una copia.
 */
export function yaEstaAplicada(
  actual: Anotacion,
  cambios: Pick<EdicionEnCola, 'titulo' | 'contenido' | 'adjuntos'>,
): boolean {
  const titulo = cambios.titulo === undefined ? actual.titulo : cambios.titulo;
  const contenido: NodoDelDocumento | undefined = cambios.contenido;
  const adjuntos: readonly Adjunto[] | null | undefined = cambios.adjuntos;

  return (
    actual.titulo === titulo &&
    (contenido === undefined || sonIguales(actual.contenido, contenido)) &&
    (adjuntos === undefined || sonIguales(actual.adjuntos, adjuntos ?? []))
  );
}
