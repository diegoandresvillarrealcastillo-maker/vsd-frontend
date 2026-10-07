import { llamarALaApi } from './clienteHttp.ts';

/**
 * El semaforo de pendientes, por HTTP (SCRUM-97 en el backend, SCRUM-98 aqui).
 *
 * Como `diario.ts`, es la copia de este lado del contrato que publica el
 * backend en `openapi.json`.
 */

export type NivelDePendiente = 'urgente' | 'prioridad' | 'aplazable';

export interface Pendiente {
  readonly id: string;
  readonly texto: string;
  readonly nivel: NivelDePendiente;
  readonly hecho: boolean;
  /** Mientras no llegue, no recuerda nada. */
  readonly posponerHasta: string | null;
  /**
   * Dia limite, AAAA-MM-DD, en el calendario de la persona (SCRUM-119). `null`:
   * no vence un dia concreto.
   */
  readonly fechaLimite: string | null;
  /**
   * Empieza en 1 y sube con cada edicion (SCRUM-134). Hay que devolverla al editar
   * para que la API detecte que otro dispositivo lo cambio. Es opcional porque un
   * servidor anterior a ese cambio no la manda.
   */
  readonly version?: number;
  readonly creadoEn: string;
  readonly editadoEn: string;
}

/**
 * El recordatorio de esta visita. `tono` dice como suena: `plazo` cuando se
 * acabo el tiempo que se le dio (urgente, prioridad) y `suave` cuando no es
 * urgente pero conviene que no se acumule (aplazable). El texto lo pone la
 * pantalla.
 */
export interface Recordatorio {
  readonly pendienteId: string;
  readonly nivel: NivelDePendiente;
  /** Dias completos desde que se anoto. */
  readonly dias: number;
  /** El nivel que se sugiere subir, o `null` si ya es urgente. Nunca se aplica solo. */
  readonly nivelSugerido: NivelDePendiente | null;
  readonly tono: 'plazo' | 'suave';
  /** El dia limite que llego, o `null` si el recordatorio es por los dias de su color. */
  readonly fechaLimite: string | null;
}

/** Lo que responde `GET /api/pendientes`. */
export interface Semaforo {
  /** Primero los sin hacer; despues los hechos en los ultimos 7 dias. */
  readonly pendientes: readonly Pendiente[];
  /** Uno como mucho por visita. */
  readonly recordatorio: Recordatorio | null;
}

export interface PendientePorCrear {
  /** Lo genera el dispositivo: reenviarlo en un reintento no duplica. */
  readonly clientOperationId: string;
  readonly texto: string;
  readonly nivel: NivelDePendiente;
  /** AAAA-MM-DD. Opcional: sin ella no vence un dia concreto. */
  readonly fechaLimite?: string;
}

/**
 * Lo que no viene se queda como estaba; `posponerHasta: null` deja de posponer
 * y `fechaLimite: null` quita la fecha limite.
 */
export interface CambiosDePendiente {
  /**
   * La version que se tenia del pendiente (SCRUM-134). Si ya no es la vigente, la
   * API responde 409 `VERSION_DESACTUALIZADA`, salvo que solo se marque como hecho.
   * Sin ella no se comprueba nada.
   */
  readonly version?: number;
  readonly texto?: string;
  readonly nivel?: NivelDePendiente;
  readonly hecho?: boolean;
  readonly posponerHasta?: string | null;
  readonly fechaLimite?: string | null;
}

const RUTA = '/api/pendientes';

export function consultarElSemaforo(senal?: AbortSignal): Promise<Semaforo> {
  return llamarALaApi<Semaforo>(RUTA, senal ? { senal } : {});
}

export function crearPendiente(pendiente: PendientePorCrear): Promise<Pendiente> {
  return llamarALaApi<Pendiente>(RUTA, { metodo: 'POST', cuerpo: pendiente });
}

export function editarPendiente(id: string, cambios: CambiosDePendiente): Promise<Pendiente> {
  return llamarALaApi<Pendiente>(`${RUTA}/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: cambios,
  });
}

export function borrarPendiente(id: string): Promise<void> {
  return llamarALaApi<void>(`${RUTA}/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
}
