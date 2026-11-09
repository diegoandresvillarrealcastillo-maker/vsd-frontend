import { llamarALaApi } from './clienteHttp.ts';
import type { Modulo } from './cuenta.ts';
import type { Frecuencia, SesionDeLaActividad } from './progreso.ts';

export interface SesionPublicada {
  readonly id: string;
  readonly idActividad: string;
  readonly titulo: string;
  readonly actividad: string;
  readonly nivel: number;
  readonly frecuencia?: Frecuencia;
}

interface SesionConContenido extends SesionDeLaActividad {
  readonly idActividad: string;
}

export function consultarSesionesPublicadas(
  modulo: Modulo,
  senal?: AbortSignal,
): Promise<readonly SesionPublicada[]> {
  return llamarALaApi<readonly SesionPublicada[]>(
    `/api/catalogo/sesiones/${modulo}`,
    senal ? { senal } : {},
  );
}

/** Solo IDs de sesiones terminadas por la cuenta autenticada. */
export function consultarSesionesHechas(
  modulo: Modulo,
  senal?: AbortSignal,
): Promise<readonly string[]> {
  return llamarALaApi<readonly string[]>(
    `/api/progreso/${modulo}/sesiones-hechas`,
    senal ? { senal } : {},
  );
}

export function buscarSesionPublicada(
  id: string,
  senal?: AbortSignal,
): Promise<SesionConContenido | null> {
  return llamarALaApi<SesionConContenido | null>(
    `/api/catalogo/sesion/${encodeURIComponent(id)}`,
    senal ? { senal } : {},
  );
}
