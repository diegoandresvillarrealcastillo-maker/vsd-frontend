import type { CambiosDePendiente, Pendiente } from '../infraestructura/api/pendientes.ts';
import type { Operacion } from '../sincronizacion/cola.ts';
import { idLocalDe } from '../sincronizacion/ejecutores.ts';
import { estadoDeUnCambio } from '../sincronizacion/estadoDeUnCambio.ts';
import { cambiosValidos, esNivelDePendiente } from '../sincronizacion/pendientes.ts';

/**
 * Lo que se ve del semaforo: lo que el servidor tiene y lo que todavia esta en este equipo
 * (SCRUM-140).
 *
 * Es una funcion pura que junta dos cosas:
 *
 * 1. **Los pendientes** que se saben del servidor (la copia local o la respuesta).
 * 2. **Lo pendiente de la cola**: lo anotado, cambiado o borrado que aun no se envio, que se
 *    ve **al instante** puesto sobre lo del servidor.
 *
 * Cerrar el navegador y volver a abrirlo no pierde nada de esto: la cola es durable, y esta
 * funcion lo arma otra vez.
 */

/**
 * - **guardado**: el servidor lo tiene como se ve.
 * - **en_este_equipo**: lo que se ve esta guardado aqui y todavia no se envia.
 * - **guardando**: se esta enviando ahora.
 * - **error**: la API no acepto el cambio y hace falta que la persona decida.
 * - **choco**: otro dispositivo cambio lo mismo y la persona tiene que elegir (ADR 0009).
 */
export type EstadoDelPendiente = 'guardado' | 'en_este_equipo' | 'guardando' | 'error' | 'choco';

export type PendienteEnPantalla = Pendiente & {
  readonly estado: EstadoDelPendiente;
  /** La operacion que fallo o choco (la primera), para resolverla. */
  readonly operacionConProblema?: string;
  /** Lo que tiene el servidor, cuando lo que se ve lleva un cambio que choco con eso. */
  readonly delServidor?: Pendiente;
};

export interface SemaforoPorComponer {
  readonly pendientes: readonly Pendiente[];
  readonly operaciones: readonly Operacion[];
  /** El motor esta enviando ahora. */
  readonly sincronizando: boolean;
  readonly ahora: Date;
}

const GRAVEDAD: Readonly<Record<EstadoDelPendiente, number>> = {
  guardado: 0,
  en_este_equipo: 1,
  guardando: 2,
  error: 3,
  choco: 4,
};

/** Lo que mas hace falta decir: que choco, luego que fallo, luego que se esta enviando. */
function elPeor(uno: EstadoDelPendiente, otro: EstadoDelPendiente): EstadoDelPendiente {
  return GRAVEDAD[otro] > GRAVEDAD[uno] ? otro : uno;
}

function estadoDe(operacion: Operacion, sincronizando: boolean, ahora: Date): EstadoDelPendiente {
  const estado = estadoDeUnCambio(operacion, sincronizando, ahora);

  return estado === 'conflicto' ? 'choco' : estado;
}

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

/** Un pendiente que se anoto en este equipo y todavia no se envio. */
function entradaDeUnaCreacion(
  operacion: Operacion,
  estado: EstadoDelPendiente,
): PendienteEnPantalla | null {
  const { payload } = operacion;

  if (!esObjeto(payload) || !esTexto(payload.texto) || !esNivelDePendiente(payload.nivel)) {
    return null;
  }

  return {
    id: idLocalDe(operacion.operationId),
    texto: payload.texto,
    nivel: payload.nivel,
    hecho: false,
    posponerHasta: null,
    fechaLimite: typeof payload.fechaLimite === 'string' ? payload.fechaLimite : null,
    creadoEn: operacion.creadaEn,
    editadoEn: operacion.creadaEn,
    estado,
    ...(estado === 'error' || estado === 'choco'
      ? { operacionConProblema: operacion.operationId }
      : {}),
  };
}

/** Lo que cambia una edicion pendiente, puesto sobre el pendiente que cambia. */
function conLosCambios<T extends Pendiente>(
  pendiente: T,
  cambios: CambiosDePendiente,
  hora: string,
): T {
  return {
    ...pendiente,
    ...(cambios.texto === undefined ? {} : { texto: cambios.texto }),
    ...(cambios.nivel === undefined ? {} : { nivel: cambios.nivel }),
    ...(cambios.hecho === undefined ? {} : { hecho: cambios.hecho }),
    ...(cambios.posponerHasta === undefined ? {} : { posponerHasta: cambios.posponerHasta }),
    ...(cambios.fechaLimite === undefined ? {} : { fechaLimite: cambios.fechaLimite }),
    editadoEn: hora,
  };
}

/** Anota en la entrada que algo no salio, sin pisar el primer problema que ya tenia. */
function conElProblema(
  entrada: PendienteEnPantalla,
  operacion: Operacion,
  estado: EstadoDelPendiente,
  delServidor: Pendiente | undefined,
): PendienteEnPantalla {
  const esProblema = estado === 'error' || estado === 'choco';

  return {
    ...entrada,
    estado: elPeor(entrada.estado, estado),
    ...(esProblema && entrada.operacionConProblema === undefined
      ? { operacionConProblema: operacion.operationId }
      : {}),
    ...(estado === 'choco' && delServidor !== undefined ? { delServidor } : {}),
  };
}

export function componerElSemaforo({
  pendientes,
  operaciones,
  sincronizando,
  ahora,
}: SemaforoPorComponer): readonly PendienteEnPantalla[] {
  const delServidor = new Map(pendientes.map((pendiente) => [pendiente.id, pendiente]));
  const entradas = new Map<string, PendienteEnPantalla>();

  for (const pendiente of pendientes) {
    entradas.set(pendiente.id, { ...pendiente, estado: 'guardado' });
  }

  for (const operacion of operaciones) {
    const estado = estadoDe(operacion, sincronizando, ahora);
    const { payload } = operacion;

    if (operacion.tipo === 'pendiente.crear') {
      const nueva = entradaDeUnaCreacion(operacion, estado);

      if (nueva !== null) {
        entradas.set(nueva.id, nueva);
      }

      continue;
    }

    const id = esObjeto(payload) && esTexto(payload.id) ? payload.id : undefined;
    const entrada = id === undefined ? undefined : entradas.get(id);

    // Cambia algo que no se ve (ya se borro, o esta fuera de los 7 dias): no hay donde ponerlo.
    if (id === undefined || entrada === undefined) {
      continue;
    }

    if (operacion.tipo === 'pendiente.editar') {
      const cambios = cambiosValidos(esObjeto(payload) ? payload.cambios : undefined);

      entradas.set(
        id,
        conElProblema(
          conLosCambios(entrada, cambios, operacion.creadaEn),
          operacion,
          estado,
          delServidor.get(id),
        ),
      );
    } else if (operacion.tipo === 'pendiente.borrar') {
      // Borrado, se va de la lista. Pero si algo anterior sobre el choco o fallo, esta
      // detenido detras de eso y la persona tiene que verlo: se queda.
      if (entrada.operacionConProblema === undefined && estado !== 'error' && estado !== 'choco') {
        entradas.delete(id);
      } else {
        entradas.set(id, conElProblema(entrada, operacion, estado, delServidor.get(id)));
      }
    }
  }

  return [...entradas.values()];
}

// ---------------------------------------------------------------------------
// Lo que choco
// ---------------------------------------------------------------------------

/**
 * Lo que la persona queria hacer con un pendiente cuando choco con otro dispositivo, para
 * poder ensenarlo junto a lo del servidor y dejarla elegir.
 */
export interface CambiosEnConflicto {
  readonly id: string;
  /** La operacion que choco: la que se descarta o se reemplaza al elegir. */
  readonly operacionQueChoco: string;
  /**
   * Lo que se queria cambiar, sumando lo que se hizo despues sobre lo mismo (lo que quedo
   * detenido detras). Lo ultimo gana. Sin la version: esa la pone quien lo vuelve a mandar.
   */
  readonly cambios: CambiosDePendiente;
  /** Si lo ultimo que se hizo fue eliminarlo. */
  readonly eliminar: boolean;
  /** Cuantos cambios entran en esto. */
  readonly cuantos: number;
}

/**
 * Los cambios en conflicto sobre el pendiente `id`, o `null` si ninguno choco.
 *
 * Toma la primera edicion que choco y todo lo que se hizo despues sobre lo mismo: por estar
 * detras de ella, nada de eso se ha enviado.
 */
export function cambiosEnConflicto(
  operaciones: readonly Operacion[],
  id: string,
): CambiosEnConflicto | null {
  const delPendiente = [...operaciones]
    .filter(
      (operacion) =>
        (operacion.tipo === 'pendiente.editar' || operacion.tipo === 'pendiente.borrar') &&
        operacion.estado !== 'hecha' &&
        esObjeto(operacion.payload) &&
        operacion.payload.id === id,
    )
    .sort((una, otra) => una.orden - otra.orden);

  const primera = delPendiente.findIndex(
    (operacion) => operacion.tipo === 'pendiente.editar' && operacion.estado === 'conflicto',
  );

  if (primera === -1) {
    return null;
  }

  const detenidas = delPendiente.slice(primera);
  const [laQueChoco] = detenidas;

  if (laQueChoco === undefined) {
    return null;
  }

  let cambios: CambiosDePendiente = {};
  let eliminar = false;

  for (const operacion of detenidas) {
    if (operacion.tipo === 'pendiente.borrar') {
      eliminar = true;
    } else if (esObjeto(operacion.payload)) {
      cambios = { ...cambios, ...cambiosValidos(operacion.payload.cambios) };
    }
  }

  return {
    id,
    operacionQueChoco: laQueChoco.operationId,
    cambios,
    eliminar,
    cuantos: detenidas.length,
  };
}
