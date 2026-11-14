import { llamarALaApi } from './clienteHttp.ts';
import type { LineaDeAtencion } from './resultados.ts';

/**
 * VSD IA, por HTTP (SCRUM-100).
 *
 * Es el asistente por reglas que ya publica el backend en `POST /api/asistente`.
 * Lo que se le escribe viaja, se usa para responder y se descarta: el servidor
 * no lo guarda ni lo devuelve, y este lado tampoco lo guarda en ningun sitio.
 */

/**
 * Un recurso de la respuesta. Tiene la misma forma que las lineas de atencion
 * del resultado de una actividad: un telefono, una lectura o un ejercicio.
 */
export type Recurso = LineaDeAtencion;

export interface RespuestaDelAsistente {
  /** Que se entendio de la pregunta. */
  readonly intencion: string;
  readonly mensaje: string;
  readonly recursos: readonly Recurso[];
  /** El texto tenia una expresion de riesgo. Entonces siempre trae lineas. */
  readonly senalDeRiesgo: boolean;
  readonly incluyeLineasDeAtencion: boolean;
  /**
   * Los temas que el asistente si atiende, como frases que se pueden tocar y enviar tal cual
   * (SCRUM-176, SCRUM-193). Solo hay algo cuando no se reconocio lo que se escribio. Un servidor
   * anterior no lo manda: es opcional.
   */
  readonly sugerencias?: readonly string[];
}

/** Lo mismo que admite el backend. */
export const LARGO_MAXIMO_DE_LA_PREGUNTA = 1000;

export function preguntarAlAsistente(
  texto: string,
  senal?: AbortSignal,
): Promise<RespuestaDelAsistente> {
  return llamarALaApi<RespuestaDelAsistente>('/api/asistente', {
    metodo: 'POST',
    cuerpo: { texto },
    ...(senal ? { senal } : {}),
  });
}
