import { editarAnotacion, escribirEnElDiario } from '../infraestructura/api/diario.ts';
import {
  borrarPendiente,
  crearPendiente,
  editarPendiente,
} from '../infraestructura/api/pendientes.ts';
import { registrarResultado } from '../infraestructura/api/resultados.ts';
import { VERSION_ACTUAL_DEL_PAYLOAD, type Operacion, type TipoDeOperacion } from './cola.ts';

/**
 * Como se envia cada tipo de operacion (SCRUM-136).
 *
 * Una operacion guarda **lo que se le mando a la API** (su `payload`), tal cual. Aqui
 * se comprueba que tenga la forma esperada y se hace la llamada. Cada llamada es
 * una que la API ya acepta y es idempotente por el identificador de operacion:
 * enviarla dos veces no duplica nada. Esa garantia no la da este codigo, la dan las
 * restricciones de la base de datos.
 *
 * ## Cosas creadas sin conexion
 *
 * Editar un pendiente que se creo sin conexion no se puede decir con su
 * identificador, porque todavia no existe: lo asigna el servidor al crearlo. Hasta
 * entonces se le llama `local:<operationId de la operacion que lo crea>`. Al
 * enviar, el recibo de esa operacion (que ya termino, porque la que edita
 * `dependeDe` de ella) trae el identificador de verdad y se sustituye.
 *
 * Lo mismo pasa con la version de una anotacion que se escribio y se edito sin
 * conexion: la de la edicion es la que respondio la operacion anterior.
 */

/** Lo que el motor le da a un ejecutor ademas de la operacion. */
export interface ContextoDeEjecucion {
  /** El recibo de otra operacion (que ya termino bien), o `null` si no hay. */
  reciboDe(operationId: string): unknown;
}

export type Ejecutor = (operacion: Operacion, contexto: ContextoDeEjecucion) => Promise<unknown>;

/** Por que una operacion no se puede enviar, antes de intentarlo. Son errores propios, no de la API. */
export class OperacionInvalida extends Error {
  readonly codigo: string;

  constructor(codigo: string) {
    super(`La operacion no se puede enviar: ${codigo}.`);
    this.name = 'OperacionInvalida';
    this.codigo = codigo;
  }
}

// ---------------------------------------------------------------------------
// Comprobar la forma
// ---------------------------------------------------------------------------

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTextoConContenido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim() !== '';
}

function esFechaIso(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(valor) &&
    !Number.isNaN(Date.parse(valor))
  );
}

function esDia(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
}

/** Un campo que puede faltar, pero si esta tiene que cumplir. */
function opcional(objeto: Objeto, campo: string, cumple: (valor: unknown) => boolean): boolean {
  return objeto[campo] === undefined || cumple(objeto[campo]);
}

/** Los tipos que crean algo: su `clientOperationId` es el de la operacion. */
const CREAN: ReadonlySet<TipoDeOperacion> = new Set([
  'resultado.registrar',
  'diario.escribir',
  'pendiente.crear',
]);

/**
 * Si una operacion se puede enviar tal como esta guardada. `null` si si; si no, un
 * codigo estable que dice por que (sin repetir nada de lo que contiene).
 */
export function comprobarLaOperacion(operacion: Operacion): string | null {
  if (operacion.ilegible === true) {
    return 'ALMACEN_ILEGIBLE';
  }

  // Una forma mas nueva que la que este codigo entiende: no se adivina. Se marca
  // para atencion y no se descarta, para que una version posterior de la
  // aplicacion pueda enviarla.
  if (operacion.payloadVersion > VERSION_ACTUAL_DEL_PAYLOAD) {
    return 'PAYLOAD_VERSION_NO_SOPORTADA';
  }

  const { payload } = operacion;

  if (!esObjeto(payload)) {
    return 'PAYLOAD_INVALIDO';
  }

  // Lo que hace seguro reintentar es que el identificador que viaja sea siempre el
  // mismo. Si no coinciden, una operacion podria duplicarse o confundirse con otra.
  if (CREAN.has(operacion.tipo) && payload.clientOperationId !== operacion.operationId) {
    return 'IDENTIFICADOR_DE_OPERACION_NO_COINCIDE';
  }

  const bien = ((): boolean => {
    switch (operacion.tipo) {
      case 'resultado.registrar':
        return (
          esTextoConContenido(payload.activityId) &&
          esFechaIso(payload.completedAt) &&
          opcional(
            payload,
            'score',
            (valor) => typeof valor === 'number' && Number.isFinite(valor),
          ) &&
          opcional(payload, 'metadata', esObjeto)
        );

      case 'diario.escribir':
        return (
          esDia(payload.dia) &&
          esObjeto(payload.contenido) &&
          opcional(payload, 'titulo', (valor) => typeof valor === 'string') &&
          opcional(payload, 'adjuntos', Array.isArray)
        );

      case 'diario.editar':
        return (
          esTextoConContenido(payload.id) &&
          opcional(payload, 'version', esEnteroPositivo) &&
          opcional(payload, 'titulo', (valor) => valor === null || typeof valor === 'string') &&
          opcional(payload, 'contenido', esObjeto) &&
          opcional(payload, 'adjuntos', (valor) => valor === null || Array.isArray(valor))
        );

      case 'pendiente.crear':
        return (
          esTextoConContenido(payload.texto) &&
          esTextoConContenido(payload.nivel) &&
          opcional(payload, 'fechaLimite', esDia)
        );

      case 'pendiente.editar':
        return esTextoConContenido(payload.id) && esObjeto(payload.cambios);

      case 'pendiente.borrar':
        return esTextoConContenido(payload.id);
    }
  })();

  return bien ? null : 'PAYLOAD_INVALIDO';
}

// ---------------------------------------------------------------------------
// Resolver lo que se creo sin conexion
// ---------------------------------------------------------------------------

const PREFIJO_LOCAL = 'local:';

/** El identificador que usa una pantalla para algo que todavia no existe en el servidor. */
export function idLocalDe(operationId: string): string {
  return `${PREFIJO_LOCAL}${operationId}`;
}

/** Si un identificador es de algo que se creo sin conexion y todavia no tiene el de verdad. */
export function esIdLocal(id: string): boolean {
  return id.startsWith(PREFIJO_LOCAL);
}

/**
 * El identificador de verdad de algo. Si se creo sin conexion, es el que respondio
 * la operacion que lo creo.
 *
 * @throws {OperacionInvalida} Si esa operacion todavia no termino bien.
 */
export function resolverElId(id: string, contexto: ContextoDeEjecucion): string {
  if (!esIdLocal(id)) {
    return id;
  }

  const recibo = contexto.reciboDe(id.slice(PREFIJO_LOCAL.length));
  const real = esObjeto(recibo) ? recibo.id : undefined;

  if (typeof real !== 'string' || real === '') {
    throw new OperacionInvalida('REFERENCIA_SIN_RESOLVER');
  }

  return real;
}

/** La version que respondio la operacion de la que depende esta, si la hay. */
function versionDeLaDependencia(
  operacion: Operacion,
  contexto: ContextoDeEjecucion,
): number | undefined {
  if (operacion.dependeDe === null) {
    return undefined;
  }

  const recibo = contexto.reciboDe(operacion.dependeDe);
  const version = esObjeto(recibo) ? recibo.version : undefined;

  return esEnteroPositivo(version) ? version : undefined;
}

// ---------------------------------------------------------------------------
// Los ejecutores
// ---------------------------------------------------------------------------

/**
 * Un ejecutor siempre devuelve una promesa: si algo falla antes de llamar a la API
 * (una referencia que no se puede resolver), **rechaza** en lugar de lanzar. Quien lo
 * use no tiene que saber en que punto fallo.
 */
function enPromesa(
  ejecutor: (operacion: Operacion, contexto: ContextoDeEjecucion) => Promise<unknown>,
): Ejecutor {
  return (operacion, contexto) => {
    try {
      return ejecutor(operacion, contexto);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Fallo el ejecutor.'));
    }
  };
}

/** Lo que cada operacion manda, ya comprobado por `comprobarLaOperacion`. */
export const EJECUTORES: Readonly<Record<TipoDeOperacion, Ejecutor>> = {
  'resultado.registrar': (operacion) =>
    registrarResultado(operacion.payload as Parameters<typeof registrarResultado>[0]),

  'diario.escribir': (operacion) =>
    escribirEnElDiario(operacion.payload as Parameters<typeof escribirEnElDiario>[0]),

  'diario.editar': enPromesa((operacion, contexto) => {
    const { id, version, ...cambios } = operacion.payload as {
      id: string;
      version?: number;
    } & Record<string, unknown>;
    const laVersion = version ?? versionDeLaDependencia(operacion, contexto);

    // La API exige la version, y sin ella no se puede editar sin arriesgarse a
    // pisar lo de otro dispositivo. Se pide atencion en lugar de adivinar.
    if (laVersion === undefined) {
      return Promise.reject(new OperacionInvalida('VERSION_SIN_CONOCER'));
    }

    return editarAnotacion(resolverElId(id, contexto), {
      ...(cambios as Omit<Parameters<typeof editarAnotacion>[1], 'version'>),
      version: laVersion,
    });
  }),

  'pendiente.crear': (operacion) =>
    crearPendiente(operacion.payload as Parameters<typeof crearPendiente>[0]),

  'pendiente.editar': enPromesa((operacion, contexto) => {
    const { id, cambios } = operacion.payload as {
      id: string;
      cambios: Parameters<typeof editarPendiente>[1];
    };
    // Si la edicion no fija la version, se usa la que respondio la anterior (una
    // cadena de ediciones sin conexion sobre lo mismo). Sin ninguna, la API no
    // comprueba nada, que es lo que hacia antes de tener version.
    const version = cambios.version ?? versionDeLaDependencia(operacion, contexto);

    return editarPendiente(resolverElId(id, contexto), {
      ...cambios,
      ...(version === undefined ? {} : { version }),
    });
  }),

  'pendiente.borrar': enPromesa((operacion, contexto) => {
    const { id } = operacion.payload as { id: string };

    return borrarPendiente(resolverElId(id, contexto));
  }),
};
