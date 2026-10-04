import type {
  NivelDePendiente,
  Pendiente,
  Recordatorio,
} from '../infraestructura/api/pendientes.ts';

/**
 * Lo que dice el semaforo de cada color, y las reglas que no dependen de la
 * pantalla.
 *
 * Cada color es un plazo, como lo definio Diego (SCRUM-107): urgente es para
 * esta semana, prioridad para las proximas tres y aplazable para mas adelante.
 * El backend recuerda cuando se acaba ese plazo; aqui solo se cuenta.
 */

export const NIVELES: readonly NivelDePendiente[] = ['urgente', 'prioridad', 'aplazable'];

export const NIVEL: Readonly<
  Record<
    NivelDePendiente,
    { readonly nombre: string; readonly plazo: string; readonly sube: NivelDePendiente | null }
  >
> = {
  urgente: { nombre: 'Urgente', plazo: 'Esta semana', sube: null },
  prioridad: { nombre: 'Prioridad', plazo: 'En las próximas tres semanas', sube: 'urgente' },
  aplazable: { nombre: 'Aplazable', plazo: 'Cuando puedas', sube: 'prioridad' },
};

/** Los cuatro pasos de la primera vez. El ultimo no tiene color: es el trato. */
export const PASOS_DE_LA_INDUCCION: readonly {
  readonly nivel: NivelDePendiente | null;
  readonly titulo: string;
  readonly texto: string;
  readonly ejemplo: string;
}[] = [
  {
    nivel: 'urgente',
    titulo: 'Rojo: urgente',
    texto: 'Lo que no debería pasar de esta semana.',
    ejemplo: '«Entregar el trabajo de la universidad el viernes.»',
  },
  {
    nivel: 'prioridad',
    titulo: 'Ámbar: prioridad',
    texto: 'Lo que toca en las próximas tres semanas, sin la prisa de hoy.',
    ejemplo: '«Organizar los documentos del próximo mes.»',
  },
  {
    nivel: 'aplazable',
    titulo: 'Verde: aplazable',
    texto: 'Lo que puede esperar un poco más.',
    ejemplo: '«Organizar mi habitación.»',
  },
  {
    nivel: null,
    titulo: 'Te avisamos con calma',
    texto: 'Si algo lleva tiempo esperando, te lo recordamos con calma. Nunca para regañarte.',
    ejemplo: 'Tú decides qué es urgente.',
  },
];

const UN_DIA_EN_MS = 24 * 60 * 60 * 1000;

/** Dias completos entre dos instantes, como los cuenta el backend. */
export function diasDesde(desde: string, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - new Date(desde).getTime()) / UN_DIA_EN_MS));
}

/** Cuanto lleva anotado, en palabras. */
export function edad(dias: number): string {
  if (dias === 0) {
    return 'Anotado hoy';
  }

  if (dias === 1) {
    return 'Desde ayer';
  }

  if (dias < 14) {
    return `Hace ${dias} días`;
  }

  return `Hace ${Math.floor(dias / 7)} semanas`;
}

/**
 * Lo que dice el recordatorio. El del aplazable es el suave: no es urgente,
 * pero que no se acumule.
 */
export function textoDelRecordatorio(recordatorio: Recordatorio): string {
  return recordatorio.tono === 'suave'
    ? 'Esto no es urgente, pero no dejes que se acumule. ¿Le echas un vistazo?'
    : 'Ey, tienes esto pendiente desde hace un tiempo. ¿Quieres revisarlo?';
}

/**
 * Los sin hacer de cada color, del mas antiguo al mas nuevo, y los hechos
 * aparte, el ultimo primero.
 */
export function agrupar(pendientes: readonly Pendiente[]): {
  readonly porNivel: Readonly<Record<NivelDePendiente, readonly Pendiente[]>>;
  readonly hechos: readonly Pendiente[];
} {
  const porFecha = (uno: Pendiente, otro: Pendiente) => uno.creadoEn.localeCompare(otro.creadoEn);
  const sinHacer = pendientes.filter((pendiente) => !pendiente.hecho);

  return {
    porNivel: {
      urgente: sinHacer.filter((uno) => uno.nivel === 'urgente').sort(porFecha),
      prioridad: sinHacer.filter((uno) => uno.nivel === 'prioridad').sort(porFecha),
      aplazable: sinHacer.filter((uno) => uno.nivel === 'aplazable').sort(porFecha),
    },
    hechos: pendientes
      .filter((pendiente) => pendiente.hecho)
      .sort((uno, otro) => otro.editadoEn.localeCompare(uno.editadoEn)),
  };
}

/** Coincide con la columna `texto` del backend. */
export const LARGO_MAXIMO_DEL_TEXTO = 280;

/** Posponer un recordatorio lo calla una semana. */
export const DIAS_AL_POSPONER = 7;

export function dentroDeDias(dias: number, ahora: Date): string {
  return new Date(ahora.getTime() + dias * UN_DIA_EN_MS).toISOString();
}
