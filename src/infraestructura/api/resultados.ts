import { llamarALaApi } from './clienteHttp.ts';

/**
 * El registro de resultados, por HTTP.
 *
 * Como `cuenta.ts` y `catalogo.ts`, es la copia de este lado del contrato que
 * publica el backend en `openapi.json`.
 */

/** Lo propio de cada tipo de actividad: las horas de sueno, los aciertos. */
export type Metadata = Readonly<Record<string, unknown>>;

/** Lo que el dispositivo manda al terminar una actividad. */
export interface ResultadoPorRegistrar {
  readonly activityId: string;

  /**
   * Lo genera el dispositivo, no el servidor.
   *
   * Es lo que hace que reintentar sea seguro: si la red se corta despues de
   * enviar pero antes de recibir la respuesta, reenviar la misma operacion
   * devuelve el resultado que ya existe en lugar de crear un duplicado.
   *
   * Tiene que ser distinto por cada intento **de verdad** de la persona, y el
   * mismo en cada reintento del mismo intento. De ahi que se genere al empezar
   * la actividad y no al pulsar el boton.
   */
  readonly clientOperationId: string;

  /**
   * Puntaje **crudo**, en la escala de la actividad. No normalizado.
   *
   * Lo calcula quien implementa la mecanica, porque es quien sabe sobre cuanto
   * se puntua: el juego de parejas sabe que tiene veinte. El catalogo no
   * publica ese maximo a proposito, y por eso una actividad generica no puede
   * inventarse un puntaje.
   *
   * Se omite en las actividades que no se valoran. Mandarlo en una de esas es
   * un 400, y esta bien que lo sea: el dato podria ser justo lo que la persona
   * respondio, y descartarlo en silencio seria peor.
   */
  readonly score?: number;

  /** Cuando se termino, en ISO 8601. */
  readonly completedAt: string;

  readonly metadata?: Metadata;
}

/**
 * Lo que la API devuelve de un resultado.
 *
 * Fijate en lo que **no** trae: ni el puntaje ni el maximo de la actividad. El
 * numero vive en la base para calcular tendencias; lo que ve la persona es el
 * nivel. Un "38 sobre 100" en algo relacionado con el animo se lee como una
 * calificacion sobre uno mismo, y esta aplicacion acompana en lugar de
 * calificar.
 */
export interface ResultadoRegistrado {
  readonly id: string;
  readonly activityId: string;

  /** Ausente en las actividades que registran sin valorar. */
  readonly nivelOrientativo?: 'favorable' | 'en_seguimiento' | 'requiere_atencion';

  /** Si conviene acompanar el resultado con recursos de apoyo. */
  readonly sugiereAcompanamiento: boolean;

  readonly metadata: Metadata;
  readonly completedAt: string;
}

/**
 * Registra un resultado.
 *
 * Es idempotente por `clientOperationId`: reenviar la misma operacion devuelve
 * la que ya se guardo. Esa garantia no la da este codigo, la da PostgreSQL con
 * una restriccion de unicidad por persona.
 */
export function registrarResultado(
  resultado: ResultadoPorRegistrar,
  senal?: AbortSignal,
): Promise<ResultadoRegistrado> {
  return llamarALaApi<ResultadoRegistrado>('/api/resultados', {
    metodo: 'POST',
    cuerpo: resultado,
    ...(senal ? { senal } : {}),
  });
}
