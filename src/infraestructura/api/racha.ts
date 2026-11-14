import { llamarALaApi } from './clienteHttp.ts';

/**
 * La racha por HTTP (SCRUM-186).
 *
 * Como los demas archivos de esta carpeta, es la copia de este lado del contrato que publica el
 * backend (ADR 0024 de `vsd-backend`).
 */

/** 0 es el ascua (menos de 7 dias); 1 desde 7, 2 desde 30, 3 desde 90 y 4 desde 365. */
export type NivelDeLaLlama = 0 | 1 | 2 | 3 | 4;

/** Como se ve un dia en la semana de la racha. */
export type EstadoDelDia = 'hecho' | 'cubierto' | 'hoy' | 'sinActividad' | 'futuro';

export interface DiaDeLaSemana {
  /** El dia del calendario local de la persona, AAAA-MM-DD. */
  readonly dia: string;
  readonly estado: EstadoDelDia;
}

/** Un hito de la escalera: los dias seguidos que pide y si la racha de ahora ya lo alcanzo. */
export interface HitoDeLaEscalera {
  readonly dias: number;
  readonly logrado: boolean;
}

export interface Racha {
  /** Dias con al menos una actividad en la cadena de ahora. */
  readonly dias: number;
  readonly nivel: NivelDeLaLlama;
  /** Si ya hizo algo hoy, en el dia local de la persona. */
  readonly hechoHoy: boolean;
  /** La llama descansa: no hay cadena en pie. Es un estado, no un castigo. */
  readonly enDescanso: boolean;
  /** Congelamientos usados en el mes de hoy. */
  readonly congelamientosUsados: number;
  /** Los que trae cada mes calendario. */
  readonly congelamientosPorMes: number;
  /** Dias de la cadena de ahora cubiertos por un congelamiento, AAAA-MM-DD. */
  readonly diasCubiertos: readonly string[];
  /** Los congelamientos que quedan este mes (SCRUM-242). */
  readonly congelamientosDisponibles: number;
  /** El proximo hito de la escalera; 0 si el servidor no lo dijo. */
  readonly proximoHito: number;
  /** Los hitos logrados y los tres que siguen; vacia si el servidor no la mando. */
  readonly escalera: readonly HitoDeLaEscalera[];
  /** La semana de hoy, de lunes a domingo; vacia si el servidor no la mando. */
  readonly semana: readonly DiaDeLaSemana[];
}

/** Lo que dice un servidor: los campos de SCRUM-242 pueden faltar si todavia no se desplego. */
type RachaDelServidor = Omit<
  Racha,
  'congelamientosDisponibles' | 'proximoHito' | 'escalera' | 'semana'
> &
  Partial<Record<'congelamientosDisponibles' | 'proximoHito' | 'escalera' | 'semana', unknown>>;

const ESTADOS_DEL_DIA: readonly unknown[] = ['hecho', 'cubierto', 'hoy', 'sinActividad', 'futuro'];

function esUnHito(valor: unknown): valor is HitoDeLaEscalera {
  const posible = valor as Partial<Record<keyof HitoDeLaEscalera, unknown>> | null;

  return (
    typeof posible === 'object' &&
    posible !== null &&
    typeof posible.dias === 'number' &&
    typeof posible.logrado === 'boolean'
  );
}

function esUnDiaDeLaSemana(valor: unknown): valor is DiaDeLaSemana {
  const posible = valor as Partial<Record<keyof DiaDeLaSemana, unknown>> | null;

  return (
    typeof posible === 'object' &&
    posible !== null &&
    typeof posible.dia === 'string' &&
    ESTADOS_DEL_DIA.includes(posible.estado)
  );
}

/**
 * Completa lo que un servidor viejo no manda. Un campo nuevo con una forma inesperada se trata como
 * si no estuviera: la llama es un acompanamiento, no una pantalla que pueda fallar.
 */
function normalizarLaRacha(cruda: RachaDelServidor): Racha {
  const { congelamientosDisponibles, proximoHito, escalera, semana, ...deSiempre } = cruda;

  return {
    ...deSiempre,
    congelamientosDisponibles:
      typeof congelamientosDisponibles === 'number' && congelamientosDisponibles >= 0
        ? congelamientosDisponibles
        : Math.max(0, deSiempre.congelamientosPorMes - deSiempre.congelamientosUsados),
    proximoHito:
      typeof proximoHito === 'number' && Number.isInteger(proximoHito) && proximoHito > 0
        ? proximoHito
        : 0,
    escalera: Array.isArray(escalera) && escalera.every(esUnHito) ? escalera : [],
    semana:
      Array.isArray(semana) && semana.length === 7 && semana.every(esUnDiaDeLaSemana) ? semana : [],
  };
}

/**
 * La racha de la cuenta propia.
 *
 * La calcula el servidor, en la zona de la persona y a partir de los resultados: el cliente no
 * cuenta ni un dia por su cuenta, para que el reloj del telefono no pueda decir otra cosa.
 */
export async function consultarLaRacha(senal?: AbortSignal): Promise<Racha> {
  return normalizarLaRacha(
    await llamarALaApi<RachaDelServidor>('/api/racha', senal ? { senal } : {}),
  );
}
