/**
 * La cola de operaciones (SCRUM-136, HU_MF09_001 y HU_MF09_002).
 *
 * Sin conexion, lo que una persona hace no se pierde ni se simula: se guarda en
 * su dispositivo como una **operacion pendiente** y se envia cuando se puede. Una
 * operacion es una cosa que la API ya sabe hacer (registrar un resultado, escribir
 * una anotacion, editar un pendiente), guardada con todo lo necesario para
 * repetirla tal cual.
 *
 * Este archivo solo tiene lo que se puede decidir sin navegador: la forma de una
 * operacion, cuales se pueden enviar ahora y cuanto se espera para reintentar. El
 * almacenamiento esta en `almacenLocal.ts` y el envio en `motor.ts`.
 */

/**
 * Lo que se puede encolar. Cada tipo corresponde a una llamada que la API ya
 * acepta y que es **idempotente** por su identificador de operacion: reenviarla no
 * duplica nada. Un tipo nuevo exige las dos cosas.
 */
export const TIPOS_DE_OPERACION = [
  'resultado.registrar',
  'diario.escribir',
  'diario.editar',
  'pendiente.crear',
  'pendiente.editar',
  'pendiente.borrar',
] as const;

export type TipoDeOperacion = (typeof TIPOS_DE_OPERACION)[number];

export function esTipoDeOperacion(valor: unknown): valor is TipoDeOperacion {
  return typeof valor === 'string' && (TIPOS_DE_OPERACION as readonly string[]).includes(valor);
}

/**
 * - **pendiente**: espera su turno (o su siguiente reintento).
 * - **enviando**: se esta enviando ahora. Si la pagina se cierra a medias, al
 *   volver se trata como pendiente: la API es idempotente, reenviar es seguro.
 * - **hecha**: la API la acepto. Se conserva un tiempo con su recibo, porque otras
 *   operaciones pueden depender de lo que respondio (el identificador nuevo).
 * - **requiere_atencion**: la API la rechazo de forma permanente (o se agotaron los
 *   reintentos). No bloquea a las demas independientes; la persona decide.
 * - **conflicto**: otro dispositivo cambio lo mismo (ADR 0009). No se pisa nada; la
 *   persona decide.
 */
export type EstadoDeOperacion =
  'pendiente' | 'enviando' | 'hecha' | 'requiere_atencion' | 'conflicto';

/** Por que no se pudo, sin repetir lo que se escribio. */
export interface ErrorDeOperacion {
  /** Un codigo estable (el de la API, o uno propio: `PAYLOAD_INVALIDO`). */
  readonly codigo: string;
  /** El estado HTTP, si lo hubo. */
  readonly estado?: number;
  /** Cuando ocurrio, en ISO 8601. */
  readonly momento: string;
}

export interface Operacion {
  /**
   * Identifica la operacion y es **el mismo** `clientOperationId` que viaja a la
   * API: lo que hace seguro reintentar. Se genera en el dispositivo, al crearla.
   */
  readonly operationId: string;
  readonly tipo: TipoDeOperacion;
  /**
   * De que cosa trata, para agrupar y mostrar ("2 cambios en este pendiente"):
   * `pendiente:<id>`, `diario:<id>`, `resultado:<id>`. No decide el orden: eso lo
   * hace `dependeDe`.
   */
  readonly entidad: string;
  /** Lo que se manda a la API. Se guarda cifrado. */
  readonly payload: unknown;
  /**
   * La version de la forma del `payload`. Si algun dia cambia, las operaciones que
   * ya estaban guardadas se siguen entendiendo (o se marcan para atencion; nunca se
   * descartan en silencio).
   */
  readonly payloadVersion: number;
  /** Cuando se creo en el dispositivo, en ISO 8601. */
  readonly creadaEn: string;
  /**
   * Numero de orden de llegada a la cola, asignado por el almacen. Desempata
   * operaciones creadas en el mismo milisegundo.
   */
  readonly orden: number;
  /** Cuantas veces fallo por una causa que pasa (el servidor, no la red). */
  readonly intentos: number;
  /** No se reintenta antes de esta hora (ISO 8601). `null`: cuando toque. */
  readonly proximoIntento: string | null;
  /**
   * La operacion que tiene que terminar antes que esta, o `null`. Es lo que
   * ordena el trabajo sobre una misma cosa: editar un pendiente que todavia no
   * se creo espera a que se cree.
   */
  readonly dependeDe: string | null;
  readonly estado: EstadoDeOperacion;
  /** Lo que respondio la API al aceptarla. Se guarda cifrado. */
  readonly recibo: unknown;
  readonly error: ErrorDeOperacion | null;
  /**
   * El almacen no pudo leer su contenido (cambio la clave, o se altero). No se
   * puede enviar y tampoco se descarta: se marca para atencion.
   */
  readonly ilegible?: boolean;
}

/** La forma que se entiende hoy. */
export const VERSION_ACTUAL_DEL_PAYLOAD = 1;

export interface DatosDeOperacionNueva {
  /** El mismo `clientOperationId` del payload, o uno propio para las que no lo llevan. */
  readonly operationId: string;
  readonly tipo: TipoDeOperacion;
  readonly entidad: string;
  readonly payload: unknown;
  readonly dependeDe?: string | null;
}

/** Una operacion recien creada: pendiente, sin intentos y todavia sin turno. */
export function nuevaOperacion(datos: DatosDeOperacionNueva, ahora: Date): Operacion {
  return {
    operationId: datos.operationId,
    tipo: datos.tipo,
    entidad: datos.entidad,
    payload: datos.payload,
    payloadVersion: VERSION_ACTUAL_DEL_PAYLOAD,
    creadaEn: ahora.toISOString(),
    orden: 0,
    intentos: 0,
    proximoIntento: null,
    dependeDe: datos.dependeDe ?? null,
    estado: 'pendiente',
    recibo: null,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Que se puede enviar ahora
// ---------------------------------------------------------------------------

export interface PlanDeEnvio {
  /** Las que se pueden enviar ya, en orden. */
  readonly listas: readonly Operacion[];
  /**
   * Las pendientes que esperan a otra que todavia no termino. Se desbloquean
   * solas cuando esa termine bien.
   */
  readonly esperandoTurno: readonly Operacion[];
  /**
   * Las pendientes que dependen de una que fallo (requiere atencion o conflicto).
   * No se envian mientras la persona no resuelva la que fallo: mandarlas
   * pondria a la API a editar algo que nunca se creo.
   */
  readonly bloqueadas: readonly Operacion[];
  /** Las que esperan su proximo reintento. */
  readonly esperandoReintento: readonly Operacion[];
}

function estaBienResuelta(operacion: Operacion | undefined): boolean {
  // Una dependencia que ya no esta en la cola (se limpio al pasar el tiempo) se
  // dio por buena: solo se limpian las que terminaron bien.
  return operacion === undefined || operacion.estado === 'hecha';
}

function haFallado(operacion: Operacion | undefined): boolean {
  return operacion?.estado === 'requiere_atencion' || operacion?.estado === 'conflicto';
}

/**
 * Reparte las operaciones segun lo que se puede hacer con cada una ahora.
 *
 * Es el corazon del orden: **dentro de una misma cosa se respeta el orden**
 * (por `dependeDe`) y **entre cosas distintas no se espera**. Una anotacion
 * rechazada no detiene el envio de los pendientes.
 */
export function planDeEnvio(operaciones: readonly Operacion[], ahora: Date): PlanDeEnvio {
  const porId = new Map(operaciones.map((operacion) => [operacion.operationId, operacion]));
  const listas: Operacion[] = [];
  const esperandoTurno: Operacion[] = [];
  const bloqueadas: Operacion[] = [];
  const esperandoReintento: Operacion[] = [];

  const ordenadas = [...operaciones].sort(
    (uno, otro) => uno.orden - otro.orden || uno.creadaEn.localeCompare(otro.creadaEn),
  );

  for (const operacion of ordenadas) {
    if (operacion.estado !== 'pendiente') {
      continue;
    }

    const dependencia = operacion.dependeDe === null ? undefined : porId.get(operacion.dependeDe);

    if (
      haFallado(dependencia) ||
      (dependencia !== undefined && estaBloqueada(dependencia, porId))
    ) {
      bloqueadas.push(operacion);
      continue;
    }

    if (!estaBienResuelta(dependencia)) {
      esperandoTurno.push(operacion);
      continue;
    }

    if (operacion.proximoIntento !== null && new Date(operacion.proximoIntento) > ahora) {
      esperandoReintento.push(operacion);
      continue;
    }

    listas.push(operacion);
  }

  return { listas, esperandoTurno, bloqueadas, esperandoReintento };
}

/**
 * Si una dependencia, aunque ella misma no haya fallado, depende a su vez de algo
 * que si fallo: la cadena entera esta detenida.
 */
function estaBloqueada(
  operacion: Operacion,
  porId: ReadonlyMap<string, Operacion>,
  vistas: ReadonlySet<string> = new Set(),
): boolean {
  if (operacion.dependeDe === null || vistas.has(operacion.operationId)) {
    return false;
  }

  const siguiente = porId.get(operacion.dependeDe);

  if (siguiente === undefined) {
    return false;
  }

  return (
    haFallado(siguiente) ||
    estaBloqueada(siguiente, porId, new Set([...vistas, operacion.operationId]))
  );
}

/**
 * Las operaciones que dependen de `operationId`, directa o indirectamente.
 *
 * Sirve para descartar: si se tira una que fallo, las que esperaban su resultado
 * (editar algo que nunca se creo) no tienen a que aplicarse y quedarian detenidas
 * para siempre. No incluye a la propia `operationId`.
 */
export function dependientesDe(
  operaciones: readonly Operacion[],
  operationId: string,
): readonly Operacion[] {
  const dependientes: Operacion[] = [];
  const vistas = new Set<string>([operationId]);
  let pendientes = [operationId];

  while (pendientes.length > 0) {
    const siguientes: string[] = [];

    for (const operacion of operaciones) {
      if (
        operacion.dependeDe !== null &&
        pendientes.includes(operacion.dependeDe) &&
        !vistas.has(operacion.operationId)
      ) {
        vistas.add(operacion.operationId);
        dependientes.push(operacion);
        siguientes.push(operacion.operationId);
      }
    }

    pendientes = siguientes;
  }

  return dependientes;
}

/** La ultima operacion de una cosa que sigue sin terminar, o `undefined`. */
export function ultimaPendienteDe(
  operaciones: readonly Operacion[],
  entidad: string,
): Operacion | undefined {
  return [...operaciones]
    .filter((operacion) => operacion.entidad === entidad && operacion.estado !== 'hecha')
    .sort((uno, otro) => uno.orden - otro.orden)
    .at(-1);
}

// ---------------------------------------------------------------------------
// Cuanto se espera para reintentar
// ---------------------------------------------------------------------------

/** La primera espera. Cada intento fallido la duplica. */
export const ESPERA_BASE_EN_MS = 5_000;

/** La espera nunca pasa de aqui: a los 15 minutos ya no crece. */
export const ESPERA_MAXIMA_EN_MS = 15 * 60 * 1000;

/** Lo mas que se acepta esperar cuando es el servidor quien pide cuanto (`Retry-After`). */
export const ESPERA_MAXIMA_DEL_SERVIDOR_EN_MS = 60 * 60 * 1000;

/**
 * Cuantas veces se reintenta una operacion que falla por una causa pasajera antes
 * de darla por atascada y pedirle atencion a la persona. Con la espera creciente
 * son poco mas de una hora: lo bastante para un servidor que se recupera, y no tanto
 * como para que algo roto reintente para siempre sin que nadie lo sepa.
 */
export const MAXIMO_DE_INTENTOS = 12;

/**
 * Cuanto esperar antes del proximo intento, en milisegundos.
 *
 * - **Crece al doble** con cada intento fallido (5 s, 10 s, 20 s...) hasta 15 min:
 *   un servidor caido no se martillea.
 * - **Con un poco de azar** (±20 %): si cien dispositivos fallaron a la vez, no
 *   vuelven todos en el mismo segundo.
 * - **Respeta lo que pida el servidor** (`Retry-After`): nunca menos de eso, y
 *   nunca mas de una hora aunque pida un siglo.
 *
 * @param intentos Cuantos fallos lleva ya, contando el de ahora (1 la primera vez).
 * @param segundosQuePideElServidor El `Retry-After`, si lo hubo.
 * @param azar Un numero en [0, 1). Se recibe para poder probarlo.
 */
export function esperaDeReintento(
  intentos: number,
  segundosQuePideElServidor: number | undefined,
  azar: number,
): number {
  const exponente = Math.max(0, intentos - 1);
  const sinAzar = Math.min(ESPERA_BASE_EN_MS * 2 ** exponente, ESPERA_MAXIMA_EN_MS);
  const conAzar = sinAzar * (0.8 + 0.4 * azar);

  if (segundosQuePideElServidor === undefined || !Number.isFinite(segundosQuePideElServidor)) {
    return Math.round(conAzar);
  }

  const pedido = Math.min(
    Math.max(0, segundosQuePideElServidor) * 1000,
    ESPERA_MAXIMA_DEL_SERVIDOR_EN_MS,
  );

  return Math.round(Math.max(conAzar, pedido));
}

/** Cuanto hace que `momento` (ISO) paso, en milisegundos. */
export function haceCuanto(momento: string, ahora: Date): number {
  return ahora.getTime() - new Date(momento).getTime();
}

/** Las que terminaron bien se conservan una semana, para que otras puedan usar su recibo. */
export const DIAS_QUE_SE_CONSERVAN_LAS_HECHAS = 7;
