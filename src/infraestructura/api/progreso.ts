import { llamarALaApi, type ContextoDePeticion } from './clienteHttp.ts';
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
 * (1 es lunes y 7 domingo), una sola vez, o por **rotacion** (SCRUM-205): no toca por su
 * frecuencia, sino que el servidor elige hasta tres mecanicas por modulo y por dia.
 */
export type Frecuencia =
  | { readonly tipo: 'diaria' }
  | { readonly tipo: 'semanal'; readonly dias: readonly number[] }
  | { readonly tipo: 'unica' }
  | { readonly tipo: 'rotativa' };

/**
 * Lo que toca hacer hoy de una mecanica (SCRUM-205, ADR 0030): el contenido de **una vez**.
 *
 * Una actividad es una mecanica; lo que cambia cada dia es su sesion. La elige el servidor (la que
 * ya hizo hoy, o la siguiente que no hizo en 365 dias) y el cliente **no la elige**: la pinta y,
 * al terminar, dice cual fue (`idSesion`).
 */
export interface SesionDeLaActividad {
  readonly id: string;
  /** Nombre corto: lo usan la exportacion y la revision, no lo lee quien la hace. */
  readonly titulo: string;
  readonly nivel: number;
  /**
   * Lo que el motor necesita (tamano, textos, pasos...). Su forma es el contrato del motor; aqui
   * llega sin leer, y cada pantalla lo lee con cuidado (`parametrosDeLaSesion.ts`).
   */
  readonly parametros: Readonly<Record<string, unknown>>;
}

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
  /**
   * Que componente pinta la mecanica (SCRUM-205). Ausente en las actividades que todavia no
   * pasaron al modelo de sesiones, y en una API anterior.
   */
  readonly motor?: string;
  /** La sesion de hoy, cuando la actividad tiene motor. Ausente si no (o en una API anterior). */
  readonly sesion?: SesionDeLaActividad;
}

/** El progreso de un modulo activo. */
export interface ProgresoDelModulo {
  readonly modulo: Modulo;
  /** Dias distintos en los que hizo algo de este modulo. */
  readonly sesiones: number;
  readonly etapa: Etapa;
  /** Lo que toca hoy. Sin tope: salen todas, y nada impide hacer mas (SCRUM-184). */
  readonly hoy: readonly ActividadDeHoy[];
  /**
   * Otras actividades abiertas que hoy no tocan, hasta completar un minimo sugerido de tres con
   * lo de hoy (SCRUM-184). Es una **sugerencia**: no entra al plan del dia, ni suma sesiones, ni
   * cuenta para la racha. Opcional porque una API anterior (o una copia guardada en este equipo
   * antes de este cambio) no la manda: sin ella simplemente no hay seccion.
   */
  readonly sugeridas?: readonly ActividadDeHoy[];
}

/**
 * El progreso de cada modulo activo de la cuenta propia, en orden.
 *
 * Lista vacia si todavia no eligio modulos. Lo calcula el servidor a partir
 * de los resultados y en hora de Colombia: el cliente no cuenta nada por su
 * cuenta, para que no haya dos versiones del mismo numero.
 */
export function consultarElProgreso(
  senal?: AbortSignal,
  contexto?: ContextoDePeticion,
): Promise<readonly ProgresoDelModulo[]> {
  return llamarALaApi<readonly ProgresoDelModulo[]>('/api/progreso', {
    ...(senal ? { senal } : {}),
    ...(contexto ? { contexto } : {}),
  });
}
