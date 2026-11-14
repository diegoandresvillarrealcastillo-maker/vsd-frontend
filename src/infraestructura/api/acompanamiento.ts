import { llamarALaApi } from './clienteHttp.ts';
import type { LineaDeAtencion } from './resultados.ts';

/**
 * El acompanamiento por dias seguidos con atencion por HTTP (SCRUM-177).
 *
 * Como los demas archivos de esta carpeta, es la copia de este lado del contrato que publica el
 * backend (ADR 0034 de `vsd-backend`).
 */

/**
 * - **ninguno**: nada que ofrecer.
 * - **moderado**: tres dias seguidos con atencion; se ofrece hablarlo con un profesional, en un aviso
 *   que se puede cerrar.
 * - **critico**: siete dias seguidos; el aviso se queda a la vista con las lineas de atencion.
 */
export type NivelDeAcompanamiento = 'ninguno' | 'moderado' | 'critico';

export interface Acompanamiento {
  readonly nivel: NivelDeAcompanamiento;
  /**
   * El acompanamiento por abandono (SCRUM-256, ADR 0035 del backend): la persona venia de varios
   * dias seguidos con atencion, su ultimo registro fue de atencion y lleva dias sin registrar nada.
   * **moderado** si venia de 3 a 6 dias, **critico** (con lineas) si venia de 7 o mas. Nunca es
   * distinto de `ninguno` a la vez que `nivel`. Un servidor anterior no lo manda.
   */
  readonly abandono: NivelDeAcompanamiento;
  /**
   * Las lineas del pais de la persona, solo con `nivel` o `abandono` criticos. **No sale ningun puntaje ni
   * cuantos dias van**: lo unico que se sabe es el nivel.
   */
  readonly lineasDeAtencion: readonly LineaDeAtencion[];
}

/** El acompanamiento de la cuenta propia. Cambia con lo que la persona hace: no se guarda en cache. */
export function consultarElAcompanamiento(senal?: AbortSignal): Promise<Acompanamiento> {
  return llamarALaApi<Acompanamiento>('/api/acompanamiento', { ...(senal ? { senal } : {}) });
}
