import { llamarALaApi } from './clienteHttp.ts';

/**
 * La racha por HTTP (SCRUM-186).
 *
 * Como los demas archivos de esta carpeta, es la copia de este lado del contrato que publica el
 * backend (ADR 0024 de `vsd-backend`).
 */

/** 0 es el ascua (menos de 7 dias); 1 desde 7, 2 desde 30, 3 desde 90 y 4 desde 365. */
export type NivelDeLaLlama = 0 | 1 | 2 | 3 | 4;

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
}

/**
 * La racha de la cuenta propia.
 *
 * La calcula el servidor, en la zona de la persona y a partir de los resultados: el cliente no
 * cuenta ni un dia por su cuenta, para que el reloj del telefono no pueda decir otra cosa.
 */
export function consultarLaRacha(senal?: AbortSignal): Promise<Racha> {
  return llamarALaApi<Racha>('/api/racha', senal ? { senal } : {});
}
