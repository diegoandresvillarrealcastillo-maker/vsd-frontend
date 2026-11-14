import { llamarALaApi, type ContextoDePeticion } from './clienteHttp.ts';

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

  /**
   * La sesion de la actividad que se hizo (SCRUM-208, ADR 0030): la que el servidor entrego como la
   * de hoy. Con ella el servidor sabe cual le toca despues a la persona, y la exportacion dice cual
   * hizo. Se omite en las actividades que todavia no tienen sesiones. Si no es una sesion de esa
   * actividad, la API responde 400 `LA_SESION_NO_ES_DE_LA_ACTIVIDAD`.
   */
  readonly idSesion?: string;
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

  /**
   * Si conviene acompanar el resultado con recursos de apoyo.
   *
   * Lo marca el nivel o, desde SCRUM-94, una senal de riesgo en el texto
   * libre de `metadata`. Esa deteccion vive solo en el servidor: es la misma
   * lista revisable del asistente, y repetirla aqui seria tener dos.
   */
  readonly sugiereAcompanamiento: boolean;

  /**
   * Las lineas de atencion, ordenadas por alcance: lo nacional primero.
   *
   * Llegan en la misma respuesta cuando `sugiereAcompanamiento` es cierto, y
   * vacias en otro caso. Es opcional porque un servidor anterior a SCRUM-94
   * no las manda.
   */
  readonly lineasDeAtencion?: readonly LineaDeAtencion[];

  readonly metadata: Metadata;
  readonly completedAt: string;
}

/** Un telefono o servicio al que acudir, tal como lo publica la API. */
export interface LineaDeAtencion {
  readonly id: string;
  readonly titulo: string;
  readonly descripcion?: string;
  readonly tipo: string;

  /**
   * Donde sirve: `nacional`, `bogota`, `universidad` o `internacional` (el
   * directorio que recibe quien esta en un lugar sin lineas verificadas).
   * Hay que mostrarlo.
   */
  readonly cobertura?: string;
  readonly enlace?: string;

  /**
   * Lo que marca el boton «Llamar ahora» (SCRUM-257, ADR 0037 del backend): solo
   * cifras, con un `+` delante si lleva prefijo de pais, y solo en una linea ya
   * verificada. Ausente en el directorio internacional y en un servidor anterior:
   * sin telefono no hay boton. Si la linea pide elegir una opcion al contestar,
   * la opcion esta en la descripcion y no se marca sola.
   */
  readonly telefono?: string;
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
  contexto?: ContextoDePeticion,
): Promise<ResultadoRegistrado> {
  return llamarALaApi<ResultadoRegistrado>('/api/resultados', {
    metodo: 'POST',
    cuerpo: resultado,
    contexto,
    ...(senal ? { senal } : {}),
  });
}
