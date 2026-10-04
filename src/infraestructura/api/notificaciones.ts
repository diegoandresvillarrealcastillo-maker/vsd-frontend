import { llamarALaApi } from './clienteHttp.ts';

/**
 * Los avisos por Web Push, por HTTP (SCRUM-102).
 *
 * Como `pendientes.ts`, es la copia de este lado del contrato que publica el
 * backend en `openapi.json`. La ruta es `/api/notificaciones`: `/api/aviso`
 * es el aviso de privacidad.
 */

export interface EstadoDeLasNotificaciones {
  /** Si el servidor puede mandar avisos. Sin claves VAPID, no. */
  readonly disponible: boolean;
  /** Con la que este navegador se suscribe. */
  readonly clavePublica: string | null;
  /** "HH:MM" en hora de Colombia, o null si esta apagado. */
  readonly horaSemaforo: string | null;
  readonly horaRacha: string | null;
}

/** Lo que no venga se queda; null apaga ese aviso. */
export interface CambiosDeHoras {
  readonly horaSemaforo?: string | null;
  readonly horaRacha?: string | null;
}

/** Lo que entrega `PushSubscription.toJSON()`. */
export interface SuscripcionDelNavegador {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

const RUTA = '/api/notificaciones';

export function consultarLasNotificaciones(
  senal?: AbortSignal,
): Promise<EstadoDeLasNotificaciones> {
  return llamarALaApi<EstadoDeLasNotificaciones>(RUTA, senal ? { senal } : {});
}

export function cambiarHorasDeAviso(cambios: CambiosDeHoras): Promise<EstadoDeLasNotificaciones> {
  return llamarALaApi<EstadoDeLasNotificaciones>(`${RUTA}/horas`, {
    metodo: 'PATCH',
    cuerpo: cambios,
  });
}

export function suscribirEsteNavegador(suscripcion: SuscripcionDelNavegador): Promise<void> {
  return llamarALaApi<void>(`${RUTA}/suscripciones`, { metodo: 'POST', cuerpo: suscripcion });
}

export function soltarEsteNavegadorDelServidor(endpoint: string): Promise<void> {
  return llamarALaApi<void>(`${RUTA}/suscripciones`, { metodo: 'DELETE', cuerpo: { endpoint } });
}
