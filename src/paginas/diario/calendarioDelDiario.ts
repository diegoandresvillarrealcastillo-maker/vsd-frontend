import type { Anotacion } from '../../infraestructura/api/diario.ts';

/**
 * Los dias y las horas del diario, siempre en hora de Colombia (SCRUM-96).
 *
 * El dia de una anotacion lo decide el servidor con la misma zona. Aqui se
 * calcula igual para saber que es "hoy" y para ensenar las horas: con la del
 * navegador, alguien de viaje veria su diario corrido un dia.
 */
const ZONA = 'America/Bogota';

const FORMATO_DE_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FORMATO_DE_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
});

// Un dia ya es local: se pinta a mediodia UTC para que ninguna zona lo mueva.
const FORMATO_DE_NOMBRE = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * La hora de ahora. Vive aqui y no en los componentes porque las reglas de
 * React no dejan leer el reloj durante el render: se llama desde un
 * inicializador o un efecto.
 */
export function ahoraMismo(): Date {
  return new Date();
}

/** El dia de un instante en Colombia, AAAA-MM-DD. */
export function diaEnColombia(instante: Date): string {
  return FORMATO_DE_DIA.format(instante);
}

/** El dia `n` dias antes. */
export function diasAntes(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) - n * UN_DIA).toISOString().slice(0, 10);
}

/** "8:14 p. m.", en hora de Colombia. */
export function horaEnColombia(iso: string): string {
  return FORMATO_DE_HORA.format(new Date(iso));
}

/** "Hoy", "Ayer" o "sábado, 27 de septiembre". */
export function nombreDelDia(dia: string, hoy: string): string {
  if (dia === hoy) {
    return 'Hoy';
  }

  if (dia === diasAntes(hoy, 1)) {
    return 'Ayer';
  }

  const nombre = FORMATO_DE_NOMBRE.format(new Date(`${dia}T12:00:00Z`));

  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/**
 * Cuantos minutos quedan para editar, redondeando hacia arriba: con 30
 * segundos se dice "queda 1 min", no "quedan 0". Cero si ya paso.
 */
export function minutosParaEditar(editableHasta: string, ahora: Date): number {
  const restante = Date.parse(editableHasta) - ahora.getTime();

  return restante <= 0 ? 0 : Math.ceil(restante / 60_000);
}

/** Los dias con anotaciones, del mas reciente al mas antiguo, y cada uno en orden de hora. */
export function agruparPorDia<T extends Pick<Anotacion, 'dia' | 'creadaEn'>>(
  anotaciones: readonly T[],
): { readonly dia: string; readonly anotaciones: readonly T[] }[] {
  const porDia = new Map<string, T[]>();

  for (const anotacion of anotaciones) {
    porDia.set(anotacion.dia, [...(porDia.get(anotacion.dia) ?? []), anotacion]);
  }

  return [...porDia.entries()]
    .sort(([uno], [otro]) => otro.localeCompare(uno))
    .map(([dia, delDia]) => ({
      dia,
      anotaciones: [...delDia].sort((una, otra) => una.creadaEn.localeCompare(otra.creadaEn)),
    }));
}
