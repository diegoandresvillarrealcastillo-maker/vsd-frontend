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
 * pero que no se acumule. Si es por la fecha limite que la persona puso, dice
 * que llego el dia (SCRUM-119): no es "hace un tiempo", es lo que ella eligio.
 */
export function textoDelRecordatorio(recordatorio: Recordatorio): string {
  if (recordatorio.fechaLimite !== null) {
    return 'Llegó la fecha que le pusiste a esto. ¿Quieres revisarlo?';
  }

  return recordatorio.tono === 'suave'
    ? 'Esto no es urgente, pero no dejes que se acumule. ¿Le echas un vistazo?'
    : 'Ey, tienes esto pendiente desde hace un tiempo. ¿Quieres revisarlo?';
}

const FORMATO_DEL_DIA = new Intl.DateTimeFormat('es-CO', {
  // El dia ya es local: se pinta a mediodia UTC para que ninguna zona lo mueva.
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Cuantos dias van de uno a otro (AAAA-MM-DD): negativo si el limite ya paso. */
function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / UN_DIA_EN_MS,
  );
}

/**
 * Lo que dice la fecha limite de un pendiente, en palabras (SCRUM-119).
 *
 * `hoy` es el dia de la persona, en su zona: el mismo instante puede ser un dia
 * distinto en cada sitio. `vencida` es para quien pinta: una fecha que ya paso
 * no es un error ni una alarma, pero conviene que se note.
 */
export function vencimiento(
  fechaLimite: string,
  hoy: string,
): { readonly texto: string; readonly vencida: boolean } {
  const dias = diasEntre(hoy, fechaLimite);

  if (dias === 0) {
    return { texto: 'Vence hoy', vencida: false };
  }

  if (dias === 1) {
    return { texto: 'Vence mañana', vencida: false };
  }

  if (dias === -1) {
    return { texto: 'Venció ayer', vencida: true };
  }

  if (dias < 0) {
    return { texto: `Venció hace ${-dias} días`, vencida: true };
  }

  const nombre = FORMATO_DEL_DIA.format(new Date(`${fechaLimite}T12:00:00Z`));

  return { texto: `Vence el ${nombre}`, vencida: false };
}

/**
 * Los sin hacer de cada color, del mas antiguo al mas nuevo, y los hechos
 * aparte, el ultimo primero.
 */
export function agrupar<T extends Pendiente>(
  pendientes: readonly T[],
): {
  readonly porNivel: Readonly<Record<NivelDePendiente, readonly T[]>>;
  readonly hechos: readonly T[];
} {
  const porFecha = (uno: T, otro: T) => uno.creadoEn.localeCompare(otro.creadoEn);
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
