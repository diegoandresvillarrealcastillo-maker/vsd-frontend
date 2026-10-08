import type { Anotacion } from '../../infraestructura/api/diario.ts';
import {
  MOTIVOS_DE_LA_COPIA,
  type EdicionEnCola,
  type EscrituraEnCola,
} from '../../sincronizacion/anotaciones.ts';
import type { Operacion } from '../../sincronizacion/cola.ts';
import type { MarcaDeCopia, MarcasDeCopia } from '../../sincronizacion/diarioLocal.ts';
import { idLocalDe } from '../../sincronizacion/ejecutores.ts';
import { estadoDeUnCambio } from '../../sincronizacion/estadoDeUnCambio.ts';
import { minutosParaEditar } from './calendarioDelDiario.ts';

/**
 * El historial del diario: lo que el servidor tiene y lo que todavia esta en este equipo
 * (SCRUM-139).
 *
 * Es una funcion pura que junta tres cosas:
 *
 * 1. **Las anotaciones** que se saben del servidor (la copia local o la respuesta).
 * 2. **Lo pendiente de la cola**: las anotaciones escritas que aun no se enviaron, que
 *    aparecen al instante, y las correcciones, que se ven puestas encima de la
 *    anotacion que corrigen.
 * 3. **Las marcas de copia**: de cuales anotaciones son copia de otra.
 *
 * Cerrar el navegador y volver a abrirlo no pierde nada de esto: la cola es durable, y
 * esta funcion lo arma otra vez.
 */

const UNA_HORA = 60 * 60 * 1000;

/**
 * - **guardada**: el servidor la tiene.
 * - **en_este_equipo**: esta guardada aqui y todavia no se envia (sin conexion, o espera
 *   su turno).
 * - **guardando**: se esta enviando ahora.
 * - **error**: la API no la acepto o hace falta que la persona decida algo.
 */
export type EstadoDeLaEntrada = 'guardada' | 'en_este_equipo' | 'guardando' | 'error';

/** De cual anotacion es copia esta, y por que no se pudo corregir aquella. */
export interface OrigenDeLaCopia extends MarcaDeCopia {
  /** Cuando se escribio la original, si sigue en el historial. */
  readonly creadaEnLaOriginal: string | null;
}

export type EntradaDelHistorial = Anotacion & {
  readonly estado: EstadoDeLaEntrada;
  /** Si es una copia de otra anotacion: de cual y por que. */
  readonly copia?: OrigenDeLaCopia;
  /**
   * La operacion que fallo y espera a la persona (para reintentarla), si hay una. Solo
   * con `estado: 'error'`.
   */
  readonly operacionConError?: string;
};

export interface EntradaDelHistorialPorComponer {
  readonly anotaciones: readonly Anotacion[];
  readonly pendientes: readonly Operacion[];
  readonly marcas: MarcasDeCopia;
  /** El motor esta enviando ahora. */
  readonly sincronizando: boolean;
  readonly ahora: Date;
}

const GRAVEDAD: Readonly<Record<EstadoDeLaEntrada, number>> = {
  guardada: 0,
  en_este_equipo: 1,
  guardando: 2,
  error: 3,
};

/** Lo que mas hace falta decir: si algo fallo, eso; si no, si se esta enviando. */
function elPeor(uno: EstadoDeLaEntrada, otro: EstadoDeLaEntrada): EstadoDeLaEntrada {
  return GRAVEDAD[otro] > GRAVEDAD[uno] ? otro : uno;
}

function estadoDe(operacion: Operacion, sincronizando: boolean, ahora: Date): EstadoDeLaEntrada {
  const estado = estadoDeUnCambio(operacion, sincronizando, ahora);

  // Una anotacion no se resuelve eligiendo: un conflicto de una correccion se vuelve copia.
  return estado === 'conflicto' ? 'error' : estado;
}

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

function esHora(valor: unknown): valor is string {
  return esTexto(valor) && !Number.isNaN(Date.parse(valor));
}

/** Una anotacion que se escribio en este equipo y todavia no se envio. */
function entradaDeUnaEscritura(operacion: Operacion, estado: EstadoDeLaEntrada) {
  const payload = operacion.payload as Partial<EscrituraEnCola> | null;

  if (
    !esObjeto(payload) ||
    !esTexto(payload.dia) ||
    !esObjeto(payload.contenido) ||
    typeof payload.contenido.type !== 'string'
  ) {
    return null;
  }

  const escritaEn = esHora(payload.escritaEn) ? payload.escritaEn : operacion.creadaEn;
  const entrada: EntradaDelHistorial = {
    id: idLocalDe(operacion.operationId),
    dia: payload.dia,
    titulo: typeof payload.titulo === 'string' ? payload.titulo : null,
    contenido: payload.contenido,
    adjuntos: Array.isArray(payload.adjuntos) ? payload.adjuntos : [],
    version: 0,
    creadaEn: escritaEn,
    editadaEn: escritaEn,
    editableHasta: new Date(Date.parse(escritaEn) + UNA_HORA).toISOString(),
    estado,
    ...(estado === 'error' ? { operacionConError: operacion.operationId } : {}),
    // Una copia que decidio el propio dispositivo: se sabe de cual es desde que se escribe.
    ...(esTexto(payload.copiaDe) &&
    typeof payload.motivo === 'string' &&
    MOTIVOS_DE_LA_COPIA.has(payload.motivo)
      ? { copia: { copiaDe: payload.copiaDe, motivo: payload.motivo, creadaEnLaOriginal: null } }
      : {}),
  };

  return entrada;
}

/** Lo que cambia una correccion pendiente, puesto sobre la anotacion que corrige. */
function conLaCorreccion(
  entrada: EntradaDelHistorial,
  operacion: Operacion,
  estado: EstadoDeLaEntrada,
): EntradaDelHistorial {
  const cambios = operacion.payload as Partial<EdicionEnCola>;

  return {
    ...entrada,
    titulo: cambios.titulo === undefined ? entrada.titulo : cambios.titulo,
    contenido: cambios.contenido ?? entrada.contenido,
    adjuntos: cambios.adjuntos === undefined ? entrada.adjuntos : (cambios.adjuntos ?? []),
    editadaEn: esHora(cambios.editadaEn) ? cambios.editadaEn : operacion.creadaEn,
    estado: elPeor(entrada.estado, estado),
    ...(estado === 'error' && entrada.operacionConError === undefined
      ? { operacionConError: operacion.operationId }
      : {}),
  };
}

/**
 * Junta dos listas de anotaciones. De cada una se queda con la version mas nueva; si son la
 * misma version, con la de `otra`.
 *
 * Sirve para poner juntas lo que se leyo del servidor y lo que hay en la copia local, que
 * puede saber algo mas reciente (una anotacion que el servidor acepto despues de preguntar)
 * o algo mas viejo (se leyo despues de que otro dispositivo la cambio).
 */
export function mezclarAnotaciones(
  una: readonly Anotacion[],
  otra: readonly Anotacion[],
): readonly Anotacion[] {
  const porId = new Map<string, Anotacion>();

  for (const anotacion of una) {
    porId.set(anotacion.id, anotacion);
  }

  for (const anotacion of otra) {
    const previa = porId.get(anotacion.id);

    if (previa === undefined || anotacion.version >= previa.version) {
      porId.set(anotacion.id, anotacion);
    }
  }

  return [...porId.values()];
}

export function componerElHistorial({
  anotaciones,
  pendientes,
  marcas,
  sincronizando,
  ahora,
}: EntradaDelHistorialPorComponer): readonly EntradaDelHistorial[] {
  const entradas = new Map<string, EntradaDelHistorial>();

  for (const anotacion of anotaciones) {
    entradas.set(anotacion.id, { ...anotacion, estado: 'guardada' });
  }

  for (const operacion of pendientes) {
    const estado = estadoDe(operacion, sincronizando, ahora);

    if (operacion.tipo === 'diario.escribir') {
      const nueva = entradaDeUnaEscritura(operacion, estado);

      if (nueva !== null) {
        entradas.set(nueva.id, nueva);
      }

      continue;
    }

    if (operacion.tipo === 'diario.editar') {
      const payload = operacion.payload as Partial<EdicionEnCola> | null;
      const corregida =
        esObjeto(payload) && esTexto(payload.id) ? entradas.get(payload.id) : undefined;

      // Corrige algo que esta fuera de los dias que se muestran: no hay donde ponerlo.
      if (corregida !== undefined) {
        entradas.set(corregida.id, conLaCorreccion(corregida, operacion, estado));
      }
    }
  }

  return [...entradas.values()].map((entrada) => {
    const marca = entrada.copia ?? marcas[entrada.id];

    return marca === undefined
      ? entrada
      : {
          ...entrada,
          copia: {
            ...marca,
            creadaEnLaOriginal: entradas.get(marca.copiaDe)?.creadaEn ?? null,
          },
        };
  });
}

/** Si una entrada se puede corregir ahora, y cuantos minutos le quedan. Cero si no. */
export function minutosQueLeQuedan(entrada: EntradaDelHistorial, ahora: Date): number {
  return entrada.estado === 'error' ? 0 : minutosParaEditar(entrada.editableHasta, ahora);
}
