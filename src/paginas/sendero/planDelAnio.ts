import { ALTO_DE_FILA, ALTO_DE_FILA_DE_HOY, desplazamiento } from './geometria.ts';

/**
 * El plan de 365 dias de cada modulo (SCRUM-293).
 *
 * Un dia del plan es una **sesion** del sendero: un dia en el que la persona hizo algo del modulo
 * (`Sendero.ts` del backend). Faltar un dia no deja hueco, asi que el plan avanza con lo que se
 * hace y no con el calendario: hoy es siempre el dia siguiente al ultimo hecho, igual que decide
 * el servidor lo que toca hoy.
 *
 * El mapa se dibuja entero desde el primer dia. Lo que no se puede mostrar de antemano es **que**
 * actividad sera cada dia futuro: la sesion de cada dia la elige el servidor con lo que la persona
 * va haciendo (ADR 0030), asi que los dias que faltan se ven numerados y sin titulo.
 */
export const DIAS_DEL_PLAN = 365;

export interface PlanDelAnio {
  /** La vuelta al plan: 1 el primer ano. Al terminar los 365 dias empieza otra, sin perder la cuenta. */
  readonly vuelta: number;
  /** El dia de hoy dentro de la vuelta, desde 0. Los anteriores ya estan hechos. */
  readonly indiceDeHoy: number;
  /** Si hoy ya cuenta como dia hecho, porque se hizo algo. */
  readonly hoyCuenta: boolean;
  /** Los dias hechos de esta vuelta, contando hoy si ya cuenta. */
  readonly diasHechos: number;
}

/** Donde cae hoy dentro del plan, a partir de las sesiones que dice la API. */
export function planDelAnio(sesiones: number, hoyCuenta: boolean): PlanDelAnio {
  const antesDeHoy = Math.max(0, Math.floor(sesiones) - (hoyCuenta ? 1 : 0));
  const indiceDeHoy = antesDeHoy % DIAS_DEL_PLAN;

  return {
    vuelta: Math.floor(antesDeHoy / DIAS_DEL_PLAN) + 1,
    indiceDeHoy,
    hoyCuenta,
    diasHechos: indiceDeHoy + (hoyCuenta ? 1 : 0),
  };
}

export interface FilaDelMapa {
  readonly indice: number;
  /** El desplazamiento lateral del punto. */
  readonly x: number;
  /** El centro de la fila, medido desde arriba del mapa. */
  readonly y: number;
  readonly hecha: boolean;
  /** Solo el ultimo dia: cerrar el plan. */
  readonly meta: boolean;
}

export interface MapaDelPlan {
  readonly filas: readonly FilaDelMapa[];
  /** El alto del mapa entero. */
  readonly alto: number;
  /** Donde esta el centro del punto de hoy: a donde se lleva la vista al abrir el mapa. */
  readonly yDeHoy: number;
  /** Los tramos entre dos dias hechos, como un solo trazo. */
  readonly trazoHecho: string;
  /** Los demas tramos. */
  readonly trazoPendiente: string;
}

/**
 * Las medidas de los 365 puntos: todas las filas miden lo mismo menos la de hoy, que es mas alta, y
 * de eso sale el centro de cada una.
 */
export function filasDelMapa(plan: PlanDelAnio): MapaDelPlan {
  const extraDeHoy = ALTO_DE_FILA_DE_HOY - ALTO_DE_FILA;
  const filas = Array.from({ length: DIAS_DEL_PLAN }, (_, indice): FilaDelMapa => {
    const esHoy = indice === plan.indiceDeHoy;
    const arriba = indice * ALTO_DE_FILA + (indice > plan.indiceDeHoy ? extraDeHoy : 0);

    return {
      indice,
      x: desplazamiento(indice),
      y: arriba + (esHoy ? ALTO_DE_FILA_DE_HOY : ALTO_DE_FILA) / 2,
      hecha: indice < plan.indiceDeHoy || (esHoy && plan.hoyCuenta),
      meta: indice === DIAS_DEL_PLAN - 1,
    };
  });

  let trazoHecho = '';
  let trazoPendiente = '';

  for (let indice = 1; indice < filas.length; indice++) {
    const origen = filas[indice - 1];
    const destino = filas[indice];

    if (origen === undefined || destino === undefined) {
      continue;
    }

    const medio = (origen.y + destino.y) / 2;
    const tramo = `M${origen.x} ${origen.y}C${origen.x} ${medio} ${destino.x} ${medio} ${destino.x} ${destino.y}`;

    if (origen.hecha && destino.hecha) {
      trazoHecho += tramo;
    } else {
      trazoPendiente += tramo;
    }
  }

  return {
    filas,
    alto: DIAS_DEL_PLAN * ALTO_DE_FILA + extraDeHoy,
    yDeHoy: filas[plan.indiceDeHoy]?.y ?? 0,
    trazoHecho,
    trazoPendiente,
  };
}
