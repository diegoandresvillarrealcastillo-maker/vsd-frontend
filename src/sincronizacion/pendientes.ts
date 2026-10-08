import type {
  CambiosDePendiente,
  NivelDePendiente,
  Pendiente,
  PendientePorCrear,
} from '../infraestructura/api/pendientes.ts';

/**
 * Lo de los pendientes que comparten la cola y la pantalla (SCRUM-140): como se reconoce lo
 * que responde la API y lo que se guarda en una operacion.
 *
 * No importa nada del ciclo ni del motor: lo usan el almacen local del semaforo y la
 * funcion pura que arma lo que se ve.
 */

export const NIVELES_DE_PENDIENTE: readonly NivelDePendiente[] = [
  'urgente',
  'prioridad',
  'aplazable',
];

export function esNivelDePendiente(valor: unknown): valor is NivelDePendiente {
  return typeof valor === 'string' && (NIVELES_DE_PENDIENTE as readonly string[]).includes(valor);
}

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

function esTextoONulo(valor: unknown): valor is string | null {
  return valor === null || typeof valor === 'string';
}

/**
 * Si algo que respondio la API (o que se guardo hace tiempo) tiene la forma de un pendiente.
 * Se comprueba todo lo que la pantalla usa: una copia guardada por otra version de la
 * aplicacion no debe romper el semaforo.
 */
export function esPendiente(valor: unknown): valor is Pendiente {
  return (
    esObjeto(valor) &&
    esTexto(valor.id) &&
    typeof valor.texto === 'string' &&
    esNivelDePendiente(valor.nivel) &&
    typeof valor.hecho === 'boolean' &&
    esTextoONulo(valor.posponerHasta) &&
    esTextoONulo(valor.fechaLimite) &&
    esTexto(valor.creadoEn) &&
    esTexto(valor.editadoEn) &&
    // La version es opcional: un servidor anterior a SCRUM-134 no la manda.
    (valor.version === undefined ||
      (typeof valor.version === 'number' && Number.isInteger(valor.version)))
  );
}

/** Lo que guarda la cola al anotar un pendiente: lo que se le manda a la API. */
export type PendienteEnCola = PendientePorCrear;

/** Lo que guarda la cola al cambiar un pendiente. */
export interface CambioEnCola {
  readonly id: string;
  readonly cambios: CambiosDePendiente;
}

/**
 * Los cambios de una operacion de edicion, solo con los campos que tienen la forma
 * esperada. Lo demas se deja fuera: una operacion guardada por otra version de la aplicacion
 * no debe romper lo que se ve.
 */
export function cambiosValidos(valor: unknown): CambiosDePendiente {
  if (!esObjeto(valor)) {
    return {};
  }

  return {
    ...(typeof valor.texto === 'string' ? { texto: valor.texto } : {}),
    ...(esNivelDePendiente(valor.nivel) ? { nivel: valor.nivel } : {}),
    ...(typeof valor.hecho === 'boolean' ? { hecho: valor.hecho } : {}),
    ...(esTextoONulo(valor.posponerHasta) ? { posponerHasta: valor.posponerHasta } : {}),
    ...(esTextoONulo(valor.fechaLimite) ? { fechaLimite: valor.fechaLimite } : {}),
  };
}
