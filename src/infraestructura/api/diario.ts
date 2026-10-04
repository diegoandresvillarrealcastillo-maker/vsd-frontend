import { llamarALaApi } from './clienteHttp.ts';
import type { LineaDeAtencion } from './resultados.ts';

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
}

/** Lo que responden escribir y editar: la anotacion y su acompanamiento. */
export interface AnotacionGuardada extends Anotacion {
  readonly sugiereAcompanamiento: boolean;
  readonly lineasDeAtencion: readonly LineaDeAtencion[];
}

export interface AnotacionPorEscribir {
  /** Lo genera el dispositivo: reenviarlo en un reintento no duplica. */
  readonly clientOperationId: string;
  readonly dia: string;
  readonly titulo?: string;
  readonly contenido: NodoDelDocumento;
  readonly adjuntos?: readonly Adjunto[];
}

export interface CambiosDeAnotacion {
  readonly version: number;
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
