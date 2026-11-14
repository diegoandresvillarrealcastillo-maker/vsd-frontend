import { llamarALaApi } from './clienteHttp.ts';

/**
 * Los avisos por Web Push, por HTTP (SCRUM-102).
 *
 * Como `pendientes.ts`, es la copia de este lado del contrato que publica el
 * backend en `openapi.json`. La ruta es `/api/notificaciones`: `/api/aviso`
 * es el aviso de privacidad.
 */

/** Cuantas veces al dia avisa el semaforo (SCRUM-146, ADR 0036 del backend). */
export type FrecuenciaDelSemaforo = 'manana' | 'noche' | 'dos_veces';

export interface EstadoDeLasNotificaciones {
  /** Si el servidor puede mandar avisos. Sin claves VAPID, no. */
  readonly disponible: boolean;
  /** Con la que este navegador se suscribe. */
  readonly clavePublica: string | null;
  /** "HH:MM" en la zona de la persona (SCRUM-123), o null si esta apagado. La hora base. */
  readonly horaSemaforo: string | null;
  /**
   * SCRUM-146: cuantas veces al dia avisa el semaforo y a que horas de verdad,
   * que el servidor calcula (nunca cruzan la medianoche). Una API anterior no
   * los manda; la pantalla lo trata como «solo en la manana», a la hora guardada.
   */
  readonly frecuenciaSemaforo?: FrecuenciaDelSemaforo;
  readonly horasDelSemaforo?: readonly string[];
  readonly horaRacha: string | null;
  /**
   * Los recordatorios de las 8:00 y las 20:00 (SCRUM-126): encendidos o no. La
   * hora no se mueve. Una API anterior a SCRUM-126 no manda estos campos; la
   * pantalla lo trata como que no los ofrece.
   */
  readonly recordatorioManana?: boolean;
  readonly recordatorioNoche?: boolean;
}

/** Lo que no venga se queda; null apaga ese aviso. */
export interface CambiosDeHoras {
  readonly horaSemaforo?: string | null;
  /** No se puede apagar con null: se apaga con `horaSemaforo: null` y la frecuencia queda guardada. */
  readonly frecuenciaSemaforo?: FrecuenciaDelSemaforo;
  readonly horaRacha?: string | null;
}

/** Lo que no venga se queda. No hay hora que elegir: son las 8:00 y las 20:00 de la persona. */
export interface CambiosDeRecordatorios {
  readonly manana?: boolean;
  readonly noche?: boolean;
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

/** Enciende o apaga el recordatorio de las 8:00 o el de las 20:00 (SCRUM-126). */
export function cambiarRecordatoriosDelDia(
  cambios: CambiosDeRecordatorios,
): Promise<EstadoDeLasNotificaciones> {
  return llamarALaApi<EstadoDeLasNotificaciones>(`${RUTA}/recordatorios`, {
    metodo: 'PATCH',
    cuerpo: cambios,
  });
}

export function suscribirEsteNavegador(suscripcion: SuscripcionDelNavegador): Promise<void> {
  return llamarALaApi<void>(`${RUTA}/suscripciones`, { metodo: 'POST', cuerpo: suscripcion });
}

/** Con `senal`, la llamada se puede cortar: al cerrar sesion no se espera al servidor mas de lo debido. */
export function soltarEsteNavegadorDelServidor(
  endpoint: string,
  senal?: AbortSignal,
): Promise<void> {
  return llamarALaApi<void>(`${RUTA}/suscripciones`, {
    metodo: 'DELETE',
    cuerpo: { endpoint },
    ...(senal ? { senal } : {}),
  });
}
