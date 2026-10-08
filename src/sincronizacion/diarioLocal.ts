import { consultarLaVersionDelAviso } from '../infraestructura/api/aviso.ts';
import { darDeAltaLaCuenta } from '../infraestructura/api/cuenta.ts';
import { consultarElDiario, type Anotacion } from '../infraestructura/api/diario.ts';
import { diasAntes } from '../tiempo/dias.ts';
import { diaEnLaZona } from '../tiempo/zonaHoraria.ts';
import {
  esAnotacion,
  esAnotacionCopiada,
  MOTIVOS_DE_LA_COPIA,
  soloLaAnotacion,
  sonIguales,
  type MotivoDeLaCopia,
} from './anotaciones.ts';
import { cicloActual } from './ciclo.ts';
import type { Operacion, TipoDeOperacion } from './cola.ts';
import {
  leerConCopia,
  leerSoloLaCopia,
  modificarLaCopia,
  type LecturaConCopia,
} from './lecturas.ts';

/**
 * El diario con copia en este dispositivo (SCRUM-139).
 *
 * Es lo mas delicado que guarda la aplicacion: lo que alguien escribio sobre si mismo. Por
 * eso la copia vive donde viven todas las demas —el almacen de la persona, cifrado, que se
 * borra al cerrar sesion— y no se comparte con nadie.
 *
 * ## Que hay guardado
 *
 * - **La instantanea** (`diario`): las anotaciones de los ultimos 30 dias tal como las
 *   tenia el servidor la ultima vez que se pregunto, mas lo que despues se supo que el
 *   servidor acepto (ver `conciliarElDiario`).
 * - **Las marcas de copia** (`diario-copias`): de cuales anotaciones son copia de otra, y
 *   por que. Ver mas abajo.
 *
 * Lo que **todavia no se envio** no esta aqui: esta en la cola, que ya es durable y
 * cifrada. La pantalla pone las dos cosas juntas (`componerElHistorial`).
 *
 * ## Una copia, ¿de donde viene?
 *
 * Cuando la API no deja corregir una anotacion (otro dispositivo la cambio, o ya paso su
 * hora), lo escrito en este equipo se guarda como una anotacion nueva (ADR 0009). La API
 * no tiene como marcarla como copia, asi que el dispositivo recuerda cual es y de cual
 * viene. **Solo este equipo lo sabe**: en otro dispositivo se ve como una anotacion mas.
 */

/** Cuantos dias, hacia atras desde hoy, se guardan. */
export const DIAS_QUE_SE_GUARDAN_DEL_DIARIO = 30;

export const CLAVE_DEL_DIARIO = 'diario';
export const CLAVE_DE_LAS_COPIAS_DEL_DIARIO = 'diario-copias';

export interface VentanaDelDiario {
  /** AAAA-MM-DD. */
  readonly desde: string;
  /** AAAA-MM-DD. */
  readonly hasta: string;
}

export interface InstantaneaDelDiario extends VentanaDelDiario {
  readonly anotaciones: readonly Anotacion[];
}

/** De cual anotacion es copia otra, y por que no se pudo corregir. */
export interface MarcaDeCopia {
  readonly copiaDe: string;
  readonly motivo: MotivoDeLaCopia;
}

/** Por el identificador de la anotacion que es copia. */
export type MarcasDeCopia = Readonly<Record<string, MarcaDeCopia>>;

/** Los ultimos 30 dias, contando hoy, en el calendario de la persona. */
export function ventanaDelDiario(ahora: Date = new Date()): VentanaDelDiario {
  const hoy = diaEnLaZona(ahora);

  return { desde: diasAntes(hoy, DIAS_QUE_SE_GUARDAN_DEL_DIARIO - 1), hasta: hoy };
}

// ---------------------------------------------------------------------------
// Reconocer lo guardado
// ---------------------------------------------------------------------------

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lo que se guardo puede ser de otra version de la aplicacion: se queda con lo que entiende. */
function comoInstantanea(valor: unknown): InstantaneaDelDiario | null {
  if (
    !esObjeto(valor) ||
    typeof valor.desde !== 'string' ||
    typeof valor.hasta !== 'string' ||
    !Array.isArray(valor.anotaciones)
  ) {
    return null;
  }

  return {
    desde: valor.desde,
    hasta: valor.hasta,
    anotaciones: (valor.anotaciones as unknown[]).filter(esAnotacion),
  };
}

function comoMarcas(valor: unknown): MarcasDeCopia {
  const marcas: Record<string, MarcaDeCopia> = {};

  if (!esObjeto(valor)) {
    return marcas;
  }

  for (const [id, marca] of Object.entries(valor)) {
    if (
      esObjeto(marca) &&
      typeof marca.copiaDe === 'string' &&
      marca.copiaDe !== '' &&
      typeof marca.motivo === 'string' &&
      MOTIVOS_DE_LA_COPIA.has(marca.motivo)
    ) {
      marcas[id] = { copiaDe: marca.copiaDe, motivo: marca.motivo as MotivoDeLaCopia };
    }
  }

  return marcas;
}

/** Si un tipo de operacion es del diario. */
export function esTipoDelDiario(tipo: TipoDeOperacion): boolean {
  return tipo === 'diario.escribir' || tipo === 'diario.editar';
}

/** Si una operacion es del diario. */
export function esDelDiario(operacion: Operacion): boolean {
  return esTipoDelDiario(operacion.tipo);
}

// ---------------------------------------------------------------------------
// Conciliar: lo que el servidor acepto, a la copia
// ---------------------------------------------------------------------------

/**
 * Pasa a la copia local lo que el servidor acepto del diario: las anotaciones que
 * respondieron las operaciones ya enviadas, y cuales son copia de otra.
 *
 * **Por que hace falta.** La instantanea es lo que el servidor tenia cuando se pregunto.
 * Una anotacion escrita despues, aunque ya este enviada, no esta en ella: sin conciliar,
 * sin conexion desaparecia justo despues de enviarla (ya no esta en la cola como
 * pendiente y todavia no esta en la copia).
 *
 * Es idempotente y no pierde nada: una anotacion solo se cambia por una de version igual
 * o mayor, y lo que no se entiende se deja como esta. Las operaciones enviadas se
 * conservan siete dias en la cola, asi que repetirla no hace dano y una tanda que se
 * corto a la mitad se completa la proxima vez.
 *
 * Nunca falla ni rechaza.
 */
export function conciliarElDiario(): Promise<void> {
  fila = fila.then(hacerLaConciliacion).catch(() => undefined);

  return fila;
}

/** Las conciliaciones se hacen de una en una: cada una lee, cambia y escribe. */
let fila: Promise<void> = Promise.resolve();

async function hacerLaConciliacion(): Promise<void> {
  const ciclo = cicloActual();

  if (ciclo === null) {
    return;
  }

  const hechas = (await ciclo.almacen.operaciones())
    .filter(
      (operacion) =>
        esDelDiario(operacion) && operacion.estado === 'hecha' && esAnotacion(operacion.recibo),
    )
    .sort((una, otra) => una.orden - otra.orden);

  if (hechas.length === 0) {
    return;
  }

  const copias = hechas.map((hecha) => hecha.recibo).filter(esAnotacionCopiada);

  if (copias.length > 0) {
    await modificarLaCopia<MarcasDeCopia>(CLAVE_DE_LAS_COPIAS_DEL_DIARIO, (guardadas) => {
      const marcas: Record<string, MarcaDeCopia> = { ...comoMarcas(guardadas) };
      let cambio = false;

      for (const copia of copias) {
        if (marcas[copia.id]?.copiaDe !== copia.copiaDe) {
          marcas[copia.id] = { copiaDe: copia.copiaDe, motivo: copia.motivo };
          cambio = true;
        }
      }

      return cambio ? marcas : null;
    });
  }

  await modificarLaCopia<InstantaneaDelDiario>(CLAVE_DEL_DIARIO, (guardada) => {
    const instantanea = comoInstantanea(guardada);

    // Sin una instantanea no hay a que agregar: una con solo unas cuantas anotaciones
    // pareceria el diario completo. Se arma la proxima vez que se pregunte al servidor.
    if (instantanea === null) {
      return null;
    }

    const porId = new Map(instantanea.anotaciones.map((anotacion) => [anotacion.id, anotacion]));
    let cambio = false;

    for (const { recibo } of hechas) {
      const nueva = soloLaAnotacion(recibo as Anotacion);
      const previa = porId.get(nueva.id);
      const sirve =
        previa === undefined
          ? nueva.dia >= instantanea.desde
          : nueva.version >= previa.version && !sonIguales(previa, nueva);

      if (sirve) {
        porId.set(nueva.id, nueva);
        cambio = true;
      }
    }

    return cambio ? { ...instantanea, anotaciones: [...porId.values()] } : null;
  });
}

// ---------------------------------------------------------------------------
// Leer
// ---------------------------------------------------------------------------

export interface OpcionesDeLaLectura {
  readonly senal?: AbortSignal;
  /**
   * Dar de alta la cuenta antes de leer, como hace la pantalla: alguien puede abrir el
   * diario directamente, antes de que exista su cuenta. **La lectura por adelantado no
   * lo hace**: dar de alta registra el consentimiento, y eso solo lo hace una pantalla.
   */
  readonly darDeAlta?: boolean;
}

/**
 * Los ultimos dias del diario: del servidor si se puede, de la copia si no.
 *
 * La instantanea que devuelve ya esta conciliada con lo que el servidor acepto despues de
 * preguntar. Ver `leerConCopia` para el resto del comportamiento (tiempo de espera,
 * errores que la copia no tapa).
 */
export async function leerElDiarioConCopia(
  ventana: VentanaDelDiario,
  opciones: OpcionesDeLaLectura = {},
): Promise<LecturaConCopia<InstantaneaDelDiario>> {
  const { senal, darDeAlta = false } = opciones;

  const lectura = await leerConCopia<InstantaneaDelDiario>(
    CLAVE_DEL_DIARIO,
    async () => {
      if (darDeAlta) {
        await darDeAltaLaCuenta(await consultarLaVersionDelAviso(senal), senal);
      }

      return {
        estado: 'nuevo',
        valor: {
          ...ventana,
          anotaciones: await consultarElDiario(ventana.desde, ventana.hasta, senal),
        },
        etag: null,
      };
    },
    senal,
  );

  await conciliarElDiario();

  return { ...lectura, valor: (await leerLaInstantanea()) ?? lectura.valor };
}

/** Lo guardado en este dispositivo, sin preguntar a nadie. */
async function leerLaInstantanea(): Promise<InstantaneaDelDiario | null> {
  return comoInstantanea(await leerSoloLaCopia<unknown>(CLAVE_DEL_DIARIO));
}

export interface LoLocalDelDiario {
  /** Lo que se sabe del servidor, o `null` si nunca se pregunto. */
  readonly instantanea: InstantaneaDelDiario | null;
  readonly marcas: MarcasDeCopia;
  /** Lo del diario que todavia no se envio (o que no se pudo), en el orden en que se hizo. */
  readonly pendientes: readonly Operacion[];
}

/**
 * Todo lo del diario que hay en este dispositivo: lo de la copia y lo de la cola. Sin
 * preguntar a nadie.
 */
export async function leerLoLocalDelDiario(): Promise<LoLocalDelDiario> {
  await conciliarElDiario();

  const [instantanea, marcas, operaciones] = await Promise.all([
    leerLaInstantanea(),
    leerSoloLaCopia<unknown>(CLAVE_DE_LAS_COPIAS_DEL_DIARIO).then(comoMarcas),
    cicloActual()
      ?.almacen.operaciones()
      .catch((): readonly Operacion[] => []) ?? Promise.resolve<readonly Operacion[]>([]),
  ]);

  return {
    instantanea,
    marcas,
    pendientes: operaciones
      .filter(
        (operacion) =>
          esDelDiario(operacion) && operacion.estado !== 'hecha' && operacion.ilegible !== true,
      )
      .sort((una, otra) => una.orden - otra.orden),
  };
}

/**
 * Lee los ultimos dias del diario por adelantado, para tenerlos cuando no haya conexion.
 * Ver `precarga.ts`.
 */
export function precargarElDiario(): Promise<unknown> {
  return leerElDiarioConCopia(ventanaDelDiario());
}
