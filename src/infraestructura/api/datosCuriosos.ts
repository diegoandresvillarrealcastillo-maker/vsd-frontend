import { llamarALaApi } from './clienteHttp.ts';

/**
 * El dato curioso del dia, por HTTP (SCRUM-185).
 *
 * Como los demas archivos de esta carpeta, es la copia de este lado del contrato que publica el
 * backend (ADR 0025 de `vsd-backend`).
 */

export interface DatoCurioso {
  readonly id: string;
  readonly texto: string;
  /** De que trata. Sirve para revisar el catalogo; no es para mostrar. */
  readonly tema: string;
}

export interface DatoCuriosoDelDia {
  /** El dia, AAAA-MM-DD, en el calendario de la persona, al que pertenece este dato. */
  readonly dia: string;
  /** `null` solo si todavia no hay ningun dato publicado. */
  readonly dato: DatoCurioso | null;
}

/**
 * El dato curioso de hoy.
 *
 * Es el mismo todo el dia y lo elige el servidor, en la zona de la persona y en el orden propio
 * de su ciclo: el cliente no elige ni cuenta nada.
 */
export function consultarElDatoDeHoy(senal?: AbortSignal): Promise<DatoCuriosoDelDia> {
  return llamarALaApi<DatoCuriosoDelDia>('/api/datos-curiosos/hoy', senal ? { senal } : {});
}
