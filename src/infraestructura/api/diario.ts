import { llamarALaApi } from './clienteHttp.ts';

/**
 * El diario, por HTTP (SCRUM-95 en el backend, SCRUM-96 aqui).
 *
 * Como `resultados.ts`, es la copia de este lado del contrato que publica el
 * backend en `openapi.json`.
 */

/** Un nodo del documento del editor: la forma JSON de ProseMirror. Nunca HTML. */
export interface NodoDelDocumento {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly NodoDelDocumento[];
  readonly marks?: readonly {
    readonly type: string;
    readonly attrs?: Readonly<Record<string, unknown>>;
  }[];
  readonly text?: string;
}

/** Un diagrama: la escena del editor de diagramas tal cual, en JSON. */
export interface Adjunto {
  readonly id: string;
  readonly tipo: 'diagrama';
  readonly datos: Readonly<Record<string, unknown>>;
}

/** Una anotacion del diario. */
export interface Anotacion {
  readonly id: string;
  /** El dia al que pertenece, en hora de Colombia: AAAA-MM-DD. */
  readonly dia: string;
  readonly titulo: string | null;
  readonly contenido: NodoDelDocumento;
  readonly adjuntos: readonly Adjunto[];
  /** Hay que mandarla al editar. Si ya no coincide, otro dispositivo la cambio. */
  readonly version: number;
  readonly creadaEn: string;
  readonly editadaEn: string;
  /** Una hora despues de escribirla. Despues, lo nuevo va en otra anotacion. */
  readonly editableHasta: string;
  /**
   * Si es una «carta a mi de manana» (SCRUM-230). Opcional: una anotacion guardada antes de
   * que existieran las cartas, o por una version anterior de la API, no lo trae.
   */
  readonly carta?: boolean;
  /**
   * Si es una carta que todavia espera: **titulo, contenido y diagramas vienen vacios** y el
   * texto solo sale al abrirla (`abrirCarta`). Nunca se pinta lo que venga en una sellada.
   */
  readonly sellada?: boolean;
}

/** Una carta que espera ser leida: lo justo para ofrecerla. Sin su texto (SCRUM-230). */
export interface CartaEnEspera {
  readonly id: string;
  /** El dia en que se escribio, en el calendario de la persona: AAAA-MM-DD. */
  readonly dia: string;
}

/**
 * Lo que responden escribir y editar: la anotacion y si conviene acompanarla.
 *
 * **Sin lineas de atencion** (SCRUM-194): el diario no las manda, ni aqui se leen. Con
 * `sugiereAcompanamiento` la mascota ofrece ayuda y, si la persona acepta, abre VSD IA.
 */
export interface AnotacionGuardada extends Anotacion {
  readonly sugiereAcompanamiento: boolean;
}

export interface AnotacionPorEscribir {
  /** Lo genera el dispositivo: reenviarlo en un reintento no duplica. */
  readonly clientOperationId: string;
  readonly dia: string;
  readonly titulo?: string;
  readonly contenido: NodoDelDocumento;
  readonly adjuntos?: readonly Adjunto[];
  /**
   * «Carta a mi de manana» (SCRUM-230): se guarda hoy y su texto no sale de la API hasta que
   * la persona la abre, desde el dia siguiente.
   */
  readonly cartaAManana?: true;
  /**
   * La hora en que el dispositivo la escribio (ISO 8601). Importa cuando se escribe sin
   * conexion y llega despues: la anotacion muestra esta hora y no la de cuando se
   * recibe (ADR 0020). El servidor la acota y, si no sirve, usa la suya.
   */
  readonly escritaEn?: string;
}

export interface CambiosDeAnotacion {
  readonly version: number;
  /**
   * La hora en que el dispositivo hizo la correccion (ISO 8601). El plazo de una hora se
   * mide contra ella, no contra cuando llega la peticion (ADR 0020).
   */
  readonly editadaEn?: string;
  /** `null` quita el titulo. */
  readonly titulo?: string | null;
  readonly contenido?: NodoDelDocumento;
  readonly adjuntos?: readonly Adjunto[] | null;
}

/**
 * Los codigos con los que la API rechaza una edicion sin tocar nada. En los
 * dos casos lo que se traia se guarda como una anotacion nueva (ADR 0009).
 */
export const NO_SE_PUEDE_EDITAR: ReadonlySet<string> = new Set([
  'EDICION_FUERA_DE_PLAZO',
  'VERSION_DESACTUALIZADA',
]);

/** Las anotaciones de un rango de dias, por dia y hora. */
export function consultarElDiario(
  desde: string,
  hasta: string,
  senal?: AbortSignal,
): Promise<readonly Anotacion[]> {
  const consulta = new URLSearchParams({ desde, hasta });

  return llamarALaApi<readonly Anotacion[]>(`/api/diario?${consulta.toString()}`, {
    ...(senal ? { senal } : {}),
  });
}

export function escribirEnElDiario(anotacion: AnotacionPorEscribir): Promise<AnotacionGuardada> {
  return llamarALaApi<AnotacionGuardada>('/api/diario', { metodo: 'POST', cuerpo: anotacion });
}

export function editarAnotacion(
  id: string,
  cambios: CambiosDeAnotacion,
): Promise<AnotacionGuardada> {
  return llamarALaApi<AnotacionGuardada>(`/api/diario/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: cambios,
  });
}

/**
 * Las cartas que la persona se dejo y todavia no abrio ni borro: de un dia que ya paso y
 * dentro de su semana de espera, la mas reciente primero. **Sin su texto** (SCRUM-230).
 */
export function consultarCartasEnEspera(senal?: AbortSignal): Promise<readonly CartaEnEspera[]> {
  return llamarALaApi<readonly CartaEnEspera[]>('/api/diario/cartas-en-espera', {
    ...(senal ? { senal } : {}),
  });
}

/**
 * Abre una carta para leerla: lo unico que entrega su texto. Solo desde el dia siguiente al que se
 * escribio; antes responde 409 `CARTA_PARA_MANANA`. Abrirla otra vez devuelve lo mismo (SCRUM-230).
 */
export function abrirCarta(id: string, senal?: AbortSignal): Promise<Anotacion> {
  return llamarALaApi<Anotacion>(`/api/diario/${encodeURIComponent(id)}/abrir`, {
    metodo: 'POST',
    ...(senal ? { senal } : {}),
  });
}

/**
 * Borra una anotacion propia, la haya leido o no. Idempotente por el identificador: borrar lo que ya no
 * esta responde igual, y por eso se puede reintentar desde la cola (SCRUM-230).
 */
export function borrarAnotacion(id: string): Promise<void> {
  return llamarALaApi<void>(`/api/diario/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
}
