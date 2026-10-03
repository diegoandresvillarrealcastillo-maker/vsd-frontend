import { llamarALaApi } from './clienteHttp.ts';
import type { Modulo } from './cuenta.ts';

/**
 * El sendero de cada modulo, por HTTP (SCRUM-91).
 *
 * Como los demas archivos de esta carpeta, es la copia de este lado del
 * contrato que publica el backend.
 */

/** Donde va la persona dentro del sendero de un modulo. */
export interface Etapa {
  /** 1 a 4 para las etapas; desde 1 otra vez para las temporadas. */
  readonly numero: number;
  readonly esTemporada: boolean;
  readonly sesionesHechas: number;
  readonly sesionesDeLaEtapa: number;
}

/**
 * Cada cuanto toca una actividad: todos los dias, ciertos dias de la semana
 * (1 es lunes y 7 domingo) o una sola vez.
 */
export type Frecuencia =
  | { readonly tipo: 'diaria' }
  | { readonly tipo: 'semanal'; readonly dias: readonly number[] }
  | { readonly tipo: 'unica' };

/** Una actividad que toca hoy. */
export interface ActividadDeHoy {
  readonly id: string;
  readonly nombre: string;
  readonly tipo?: string;
  readonly descripcion?: string;
  readonly hecha: boolean;
  /**
   * Para la etiqueta del sendero (SCRUM-92). Opcional porque una API anterior
   * a ese cambio no la manda; sin ella simplemente no se pinta la etiqueta.
   */
  readonly frecuencia?: Frecuencia;
}

/** El progreso de un modulo activo. */
export interface ProgresoDelModulo {
  readonly modulo: Modulo;
  /** Dias distintos en los que hizo algo de este modulo. */
  readonly sesiones: number;
  readonly etapa: Etapa;
  readonly hoy: readonly ActividadDeHoy[];
}

/**
 * El progreso de cada modulo activo de la cuenta propia, en orden.
 *
 * Lista vacia si todavia no eligio modulos. Lo calcula el servidor a partir
 * de los resultados y en hora de Colombia: el cliente no cuenta nada por su
 * cuenta, para que no haya dos versiones del mismo numero.
 */
export function consultarElProgreso(senal?: AbortSignal): Promise<readonly ProgresoDelModulo[]> {
  return llamarALaApi<readonly ProgresoDelModulo[]>('/api/progreso', senal ? { senal } : {});
}
