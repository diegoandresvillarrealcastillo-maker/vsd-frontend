import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import type { HechoDelHistorial } from '../../infraestructura/api/historial.ts';
import type { DiaDeLaSemana } from '../../infraestructura/api/racha.ts';

/**
 * Lo que dice «Mi actividad» de la semana (SCRUM-296). Solo participacion: cuantos dias y cuantas
 * actividades, nunca un puntaje ni un juicio. Los dias los cuenta el servidor (la racha, en la zona
 * de la persona); aqui no se calcula ninguno por cuenta propia.
 */

/** Un hecho del historial con el modulo al que pertenece (el servidor lo entrega por modulo). */
export interface HechoConModulo extends HechoDelHistorial {
  readonly modulo: Modulo;
}

/** Los dias de la semana en los que la persona hizo algo. Un dia cubierto por un congelamiento no cuenta. */
export function diasConActividad(semana: readonly DiaDeLaSemana[]): number {
  return semana.filter(({ estado }) => estado === 'hecho').length;
}

/** Cuantas actividades se hicieron en los dias de esta semana. */
export function actividadesDeLaSemana(
  semana: readonly DiaDeLaSemana[],
  hechos: readonly HechoDelHistorial[],
): number {
  const dias = new Set(semana.map(({ dia }) => dia));

  return hechos.filter(({ dia }) => dias.has(dia)).length;
}

/** Las ultimas actividades de todos los modulos, la mas reciente primero. */
export function ultimasActividades(
  hechos: readonly HechoConModulo[],
  cuantas: number,
): readonly HechoConModulo[] {
  return [...hechos]
    .sort((a, b) => Date.parse(b.hechaEn) - Date.parse(a.hechaEn))
    .slice(0, cuantas);
}

/** Hasta cuantos minutos despues de hacerla una actividad cuenta como «recien hecha» (SCRUM-311). */
export const MINUTOS_DE_LO_RECIENTE = 15;

/**
 * Si una actividad se hizo hace un momento. Solo sirve para dar un toque de color y movimiento en
 * pantalla; no se muestra ni se cuenta. Se mira la distancia en los dos sentidos porque el reloj del
 * aparato y el del servidor pueden diferir unos minutos; una fecha ilegible no es reciente.
 */
export function esReciente(hechaEn: string, ahora: Date): boolean {
  return Math.abs(ahora.getTime() - Date.parse(hechaEn)) <= MINUTOS_DE_LO_RECIENTE * 60_000;
}

function dias(cuantos: number): string {
  return `${String(cuantos)} ${cuantos === 1 ? 'día' : 'días'}`;
}

/**
 * La frase de arriba. `actividades` es `undefined` cuando no se pudo leer el historial (sin conexion):
 * entonces solo se dicen los dias, que si tienen copia. Si las actividades no cuadran con los dias
 * (un historial que no alcanza a cubrir la semana) tampoco se inventa un numero.
 */
export function textoDelResumen(diasHechos: number, actividades: number | undefined): string {
  if (diasHechos === 0) {
    return 'Esta semana todavía no hay actividad. Cuando quieras, aquí empieza.';
  }

  if (actividades === undefined || actividades === 0) {
    return `Participaste ${dias(diasHechos)} esta semana.`;
  }

  return `Participaste ${dias(diasHechos)} y completaste ${String(actividades)} ${actividades === 1 ? 'actividad' : 'actividades'}.`;
}
