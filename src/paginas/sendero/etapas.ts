import type { Etapa } from '../../infraestructura/api/progreso.ts';

/**
 * Las etapas del sendero, de este lado (SCRUM-92).
 *
 * La API dice la etapa en la que va la persona contando lo de hoy. Para
 * dibujar el camino hace falta algo mas: la etapa en la que **cae** el dia de
 * hoy, que es distinta justo el dia que se completa una. Quien hace hoy su
 * quinta sesion ya esta en la etapa 2 para la API, pero en el sendero tiene
 * que ver la etapa 1 entera y el punto de hoy como el ultimo, cerrandola.
 *
 * Por eso esto repite las duraciones y el calculo de `Sendero.ts` del backend.
 * Si alli cambian, aqui tambien; las pruebas fijan los mismos casos.
 */
export const SESIONES_POR_ETAPA = [5, 10, 15, 20] as const;
export const SESIONES_POR_TEMPORADA = 25;

/** La etapa que corresponde a un numero de sesiones, igual que en el backend. */
export function etapaPara(sesiones: number): Etapa {
  let restantes = Math.max(0, Math.floor(sesiones));

  for (const [indice, duracion] of SESIONES_POR_ETAPA.entries()) {
    if (restantes < duracion) {
      return {
        numero: indice + 1,
        esTemporada: false,
        sesionesHechas: restantes,
        sesionesDeLaEtapa: duracion,
      };
    }

    restantes -= duracion;
  }

  return {
    numero: Math.floor(restantes / SESIONES_POR_TEMPORADA) + 1,
    esTemporada: true,
    sesionesHechas: restantes % SESIONES_POR_TEMPORADA,
    sesionesDeLaEtapa: SESIONES_POR_TEMPORADA,
  };
}

/** "Etapa 2" o "Temporada 1". */
export function nombreDeEtapa(etapa: Pick<Etapa, 'numero' | 'esTemporada'>): string {
  return `${etapa.esTemporada ? 'Temporada' : 'Etapa'} ${etapa.numero}`;
}

/** La que viene despues: tras la etapa 4 empiezan las temporadas. */
export function etapaSiguiente(etapa: Etapa): Etapa {
  if (etapa.esTemporada) {
    return {
      numero: etapa.numero + 1,
      esTemporada: true,
      sesionesHechas: 0,
      sesionesDeLaEtapa: SESIONES_POR_TEMPORADA,
    };
  }

  const duracion = SESIONES_POR_ETAPA[etapa.numero];

  return duracion === undefined
    ? { numero: 1, esTemporada: true, sesionesHechas: 0, sesionesDeLaEtapa: SESIONES_POR_TEMPORADA }
    : {
        numero: etapa.numero + 1,
        esTemporada: false,
        sesionesHechas: 0,
        sesionesDeLaEtapa: duracion,
      };
}

/** Las etapas ya completadas antes de esta, en orden. */
export function etapasAnteriores(etapa: Etapa): readonly Etapa[] {
  const anteriores: Etapa[] = [];
  const cuantas = etapa.esTemporada
    ? SESIONES_POR_ETAPA.length + etapa.numero - 1
    : etapa.numero - 1;
  let actual = etapaPara(0);

  for (let i = 0; i < cuantas; i++) {
    anteriores.push({ ...actual, sesionesHechas: actual.sesionesDeLaEtapa });
    actual = etapaSiguiente(actual);
  }

  return anteriores;
}

/** Donde cae hoy dentro del sendero. */
export interface Tramo {
  /** La etapa en la que cae el dia de hoy. */
  readonly etapa: Etapa;
  /** El punto de hoy, desde 0. Los anteriores ya estan hechos. */
  readonly indiceDeHoy: number;
  /** Si hoy ya cuenta como sesion, porque se hizo algo. */
  readonly hoyCuenta: boolean;
  /** Si con lo de hoy se completo la etapa. */
  readonly etapaCompletadaHoy: boolean;
}

/**
 * La etapa y el punto de hoy, a partir de las sesiones que dice la API.
 *
 * Hoy es siempre la sesion siguiente a las anteriores, se haya empezado o no:
 * asi es como el backend decide lo que toca hoy, y el sendero tiene que
 * coincidir con eso.
 */
export function tramoDeHoy(sesiones: number, hoyCuenta: boolean): Tramo {
  const antesDeHoy = Math.max(0, sesiones - (hoyCuenta ? 1 : 0));
  const etapa = etapaPara(antesDeHoy);
  const indiceDeHoy = etapa.sesionesHechas;

  return {
    etapa: { ...etapa, sesionesHechas: indiceDeHoy + (hoyCuenta ? 1 : 0) },
    indiceDeHoy,
    hoyCuenta,
    etapaCompletadaHoy: hoyCuenta && indiceDeHoy === etapa.sesionesDeLaEtapa - 1,
  };
}
