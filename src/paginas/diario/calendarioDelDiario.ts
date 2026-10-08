import type { Anotacion } from '../../infraestructura/api/diario.ts';
import { diasAntes } from '../../tiempo/dias.ts';
import { diaEnLaZona, formatoEn, zonaActual } from '../../tiempo/zonaHoraria.ts';

export { diasAntes };

/**
 * Los dias y las horas del diario, en la zona de la persona (SCRUM-96,
 * SCRUM-123).
 *
 * El dia de una anotacion lo decide el servidor con la zona de la cuenta. Aqui
 * se calcula igual para saber que es "hoy" y para ensenar las horas: con una
 * zona distinta, el diario de alguien de viaje se veria corrido un dia. Ver
 * `tiempo/zonaHoraria.ts` para de donde sale.
 */

// Un dia ya es local: se pinta a mediodia UTC para que ninguna zona lo mueva.
const FORMATO_DE_NOMBRE = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * La hora de ahora. Vive aqui y no en los componentes porque las reglas de
 * React no dejan leer el reloj durante el render: se llama desde un
 * inicializador o un efecto.
 */
export function ahoraMismo(): Date {
  return new Date();
}

/** El dia de un instante en la zona de la persona, AAAA-MM-DD. */
export function diaDe(instante: Date): string {
  return diaEnLaZona(instante);
}

/** "8:14 p. m.", en la zona de la persona. */
export function horaDe(iso: string): string {
  return formatoEn(zonaActual(), 'es-CO', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
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
