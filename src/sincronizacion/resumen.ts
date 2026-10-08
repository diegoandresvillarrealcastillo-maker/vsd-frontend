import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';
import { esAnotacionCopiada } from './anotaciones.ts';
import type { EstadoDeOperacion, ErrorDeOperacion, Operacion, TipoDeOperacion } from './cola.ts';
import type { MotivoDeSincronizacion, ReciboDeEnvio, ResultadoDeSincronizacion } from './motor.ts';

/**
 * Lo que la persona lee sobre lo guardado en su equipo (SCRUM-137): el indicador
 * de la barra, la lista de cambios y el aviso de despues de sincronizar.
 *
 * Todo esto son **funciones puras**: reciben el estado y devuelven texto. Asi se
 * pueden probar sin pantalla, y los textos viven en un solo sitio.
 *
 * ## Lo que NO se dice
 *
 * Nunca el contenido de un cambio. Un cambio guardado es un resultado, una
 * anotacion del diario o un pendiente: se nombra el tipo ("Anotacion del diario"),
 * no lo que dice. Quien mira la pantalla de lado, o la notificacion de un equipo
 * bloqueado, no tiene por que enterarse de nada de salud.
 */

// ---------------------------------------------------------------------------
// Contar y nombrar
// ---------------------------------------------------------------------------

/** "1 cambio", "3 cambios". */
export function cambios(cantidad: number): string {
  return cantidad === 1 ? '1 cambio' : `${String(cantidad)} cambios`;
}

/** "1 cambio guardado", "3 cambios guardados". */
function cambiosGuardados(cantidad: number): string {
  return cantidad === 1 ? '1 cambio guardado' : `${String(cantidad)} cambios guardados`;
}

const DESCRIPCIONES: Readonly<Record<TipoDeOperacion, string>> = {
  'resultado.registrar': 'Resultado de una actividad',
  'diario.escribir': 'Anotación del diario',
  'diario.editar': 'Corrección de una anotación del diario',
  'pendiente.crear': 'Pendiente nuevo',
  'pendiente.editar': 'Cambio en un pendiente',
  'pendiente.borrar': 'Pendiente borrado',
};

export function descripcionDelCambio(tipo: TipoDeOperacion): string {
  return DESCRIPCIONES[tipo];
}

export interface ContadoresDeCambios {
  /** Esperando su turno, su reintento o la conexion, o enviandose. */
  readonly porEnviar: number;
  /** Rechazados, o con los intentos agotados: la persona decide. */
  readonly requierenAtencion: number;
  /** Chocaron con un cambio de otro dispositivo: la persona decide. */
  readonly conflictos: number;
  /** Todo lo que sigue guardado en este equipo sin haberse enviado. */
  readonly total: number;
}

/** Lo que sigue guardado sin enviar. Lo que ya se envio (`hecha`) no cuenta. */
export function contarCambios(operaciones: readonly Operacion[]): ContadoresDeCambios {
  let porEnviar = 0;
  let requierenAtencion = 0;
  let conflictos = 0;

  for (const operacion of operaciones) {
    if (operacion.estado === 'pendiente' || operacion.estado === 'enviando') {
      porEnviar += 1;
    } else if (operacion.estado === 'requiere_atencion') {
      requierenAtencion += 1;
    } else if (operacion.estado === 'conflicto') {
      conflictos += 1;
    }
  }

  return {
    porEnviar,
    requierenAtencion,
    conflictos,
    total: porEnviar + requierenAtencion + conflictos,
  };
}

// ---------------------------------------------------------------------------
// El indicador
// ---------------------------------------------------------------------------

export type EstadoDeLaConexion = 'con_conexion' | 'sin_conexion';

/**
 * - **normal**: nada que hacer.
 * - **aviso**: sin conexion o algo por enviar. Informa, no pide nada.
 * - **atencion**: hay algo que la persona tiene que mirar.
 */
export type TonoDelIndicador = 'normal' | 'aviso' | 'atencion';

export interface Indicador {
  /** Lo que se lee en la barra. */
  readonly texto: string;
  readonly tono: TonoDelIndicador;
  /** Cuantos cambios hay sin enviar, para el numerito del movil. */
  readonly cantidad: number;
}

export function indicadorDe(
  conexion: EstadoDeLaConexion,
  sincronizando: boolean,
  contadores: ContadoresDeCambios,
): Indicador {
  const { total, requierenAtencion, conflictos, porEnviar } = contadores;
  const aAtender = requierenAtencion + conflictos;

  if (conexion === 'sin_conexion') {
    return {
      texto:
        total === 0 ? 'Sin conexión' : `Sin conexión · ${cambiosGuardados(total)} en este equipo`,
      tono: aAtender > 0 ? 'atencion' : 'aviso',
      cantidad: total,
    };
  }

  if (sincronizando) {
    return { texto: 'Sincronizando…', tono: 'aviso', cantidad: total };
  }

  if (aAtender > 0) {
    return {
      texto:
        aAtender === 1
          ? '1 cambio necesita tu atención'
          : `${String(aAtender)} cambios necesitan tu atención`,
      tono: 'atencion',
      cantidad: total,
    };
  }

  if (porEnviar > 0) {
    return { texto: `${cambios(porEnviar)} por enviar`, tono: 'aviso', cantidad: total };
  }

  return { texto: 'Todo enviado', tono: 'normal', cantidad: 0 };
}

// ---------------------------------------------------------------------------
// La lista de cambios
// ---------------------------------------------------------------------------

export interface CambioGuardado {
  readonly operationId: string;
  readonly tipo: TipoDeOperacion;
  readonly descripcion: string;
  /** Cuando se hizo, en ISO 8601. */
  readonly creadaEn: string;
  readonly estado: EstadoDeOperacion;
  /** Que le pasa, en una frase. */
  readonly detalle: string;
  readonly puedeReintentarse: boolean;
  readonly puedeDescartarse: boolean;
}

/** Por que no se pudo enviar, sin repetir nada de lo escrito. */
export function motivoDelFallo(error: ErrorDeOperacion | null): string {
  switch (error?.codigo) {
    case 'SIN_RESPUESTA':
      return 'El servidor no respondió después de varios intentos.';
    case 'PAYLOAD_INVALIDO':
    case 'IDENTIFICADOR_DE_OPERACION_NO_COINCIDE':
      return 'Lo guardado no tiene la forma que se espera.';
    case 'PAYLOAD_VERSION_NO_SOPORTADA':
      return 'Lo guardó una versión más nueva de la aplicación.';
    case 'ALMACEN_ILEGIBLE':
      return 'No se pudo leer lo guardado en este equipo.';
    case 'REFERENCIA_SIN_RESOLVER':
      return 'Depende de algo que no llegó a crearse.';
    case 'VERSION_DESACTUALIZADA':
      return 'Otro dispositivo lo cambió antes. No se pisó nada.';
    case 'EDICION_FUERA_DE_PLAZO':
      return 'Pasó la hora para corregirlo. No se cambió nada.';
    default:
      break;
  }

  if (error?.estado === 404) {
    return 'Ya no existe en el servidor.';
  }

  if (error?.estado === 403) {
    return 'No tienes permiso para este cambio.';
  }

  return 'El servidor no aceptó este cambio.';
}

/**
 * Cuando paso algo, para leerlo: la hora si fue hoy ("2:05 p. m."), o el dia y la
 * hora si fue antes ("7 oct, 2:05 p. m."). En el reloj de este equipo, que es donde
 * se hizo.
 */
export function cuandoFue(iso: string, ahora: Date): string {
  const momento = new Date(iso);
  const mismoDia = momento.toDateString() === ahora.toDateString();

  return mismoDia
    ? momento.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })
    : momento.toLocaleString('es', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
}

/** Una operacion, como la ve la persona. */
export function cambioParaMostrar(operacion: Operacion, ahora: Date): CambioGuardado {
  const base = {
    operationId: operacion.operationId,
    tipo: operacion.tipo,
    descripcion: descripcionDelCambio(operacion.tipo),
    creadaEn: operacion.creadaEn,
    estado: operacion.estado,
  };

  switch (operacion.estado) {
    case 'enviando':
      return { ...base, detalle: 'Enviando…', puedeReintentarse: false, puedeDescartarse: false };

    case 'requiere_atencion':
      return {
        ...base,
        detalle: motivoDelFallo(operacion.error),
        // Lo que no se pudo leer no tiene con que reenviarse: solo se puede tirar.
        puedeReintentarse: operacion.ilegible !== true,
        puedeDescartarse: true,
      };

    case 'conflicto':
      return {
        ...base,
        detalle: motivoDelFallo(operacion.error),
        puedeReintentarse: false,
        puedeDescartarse: true,
      };

    case 'hecha':
      return { ...base, detalle: 'Enviado', puedeReintentarse: false, puedeDescartarse: false };

    case 'pendiente': {
      const esperando =
        operacion.proximoIntento !== null && new Date(operacion.proximoIntento) > ahora;

      return {
        ...base,
        detalle: esperando
          ? `Se volverá a intentar a las ${cuandoFue(operacion.proximoIntento ?? '', ahora)}.`
          : 'Guardado en este equipo. Se enviará solo.',
        puedeReintentarse: false,
        puedeDescartarse: false,
      };
    }
  }
}

/**
 * Lo que sigue guardado sin enviar, lo que necesita a la persona primero y el resto
 * en el orden en que se hizo.
 */
export function cambiosParaMostrar(
  operaciones: readonly Operacion[],
  ahora: Date,
): readonly CambioGuardado[] {
  const necesitaALaPersona = (estado: EstadoDeOperacion): boolean =>
    estado === 'requiere_atencion' || estado === 'conflicto';

  return operaciones
    .filter((operacion) => operacion.estado !== 'hecha')
    .sort(
      (uno, otro) =>
        Number(necesitaALaPersona(otro.estado)) - Number(necesitaALaPersona(uno.estado)) ||
        uno.orden - otro.orden,
    )
    .map((operacion) => cambioParaMostrar(operacion, ahora));
}

// ---------------------------------------------------------------------------
// El aviso de despues de sincronizar
// ---------------------------------------------------------------------------

/** Lo que la API orienta de un resultado. Ver `ResultadoRegistrado.nivelOrientativo`. */
export type NivelOrientativo = 'favorable' | 'en_seguimiento' | 'requiere_atencion';

const NIVELES_ORIENTATIVOS: ReadonlySet<unknown> = new Set<NivelOrientativo>([
  'favorable',
  'en_seguimiento',
  'requiere_atencion',
]);

/**
 * La orientacion de una actividad hecha sin conexion, que se ensena **al sincronizar**
 * (decision del equipo): el calculo sigue en un solo lugar, el servidor, y los umbrales
 * no salen de la API. Nunca lleva el puntaje: la API no lo devuelve.
 */
export interface OrientacionDelAviso {
  readonly activityId: string;
  readonly nivelOrientativo: NivelOrientativo;
}

/**
 * Lo que salio en menos de esto desde que se guardo, salio "de inmediato": se hizo con
 * conexion y la pantalla de quien lo hizo ya se lo dijo. Avisarlo otra vez ("Enviamos 1
 * cambio que estaba guardado en este equipo") seria ruido en cada accion.
 */
export const ESPERA_PARA_QUE_CUENTE_COMO_GUARDADO_EN_MS = 30_000;

export interface Aviso {
  readonly texto: string;
  /**
   * "exito" si salio bien, "atencion" si algo no salio, "info" si solo se informa
   * (se perdio la conexion). El color solo no basta: el texto ya lo dice.
   */
  readonly tono: 'exito' | 'atencion' | 'info';
  /** Cuantos cambios se enviaron en esta tanda. */
  readonly enviadas: number;
  /** Si conviene mandar a la persona a mirar la lista. */
  readonly verLista: boolean;
  /** Si la sesion vencio y hay que entrar de nuevo. */
  readonly pedirEntrar: boolean;
  /**
   * Si lo que se envio trae una senal de acompanamiento (por ejemplo, un resultado
   * hecho sin conexion). Se ofrecen las lineas de atencion.
   */
  readonly sugiereAcompanamiento: boolean;
  readonly lineasDeAtencion: readonly LineaDeAtencion[];
  /** La orientacion de los resultados que se enviaron despues de esperar en este equipo. */
  readonly orientaciones: readonly OrientacionDelAviso[];
  /**
   * Cuantas correcciones del diario no se pudieron aplicar y se guardaron como una copia
   * (ADR 0009). Se avisa siempre, hayan esperado o no: es lo unico del diario que la
   * persona no espera encontrar.
   */
  readonly copias: number;
}

export interface EntradaDelAviso {
  readonly resultado: ResultadoDeSincronizacion;
  readonly motivo: MotivoDeSincronizacion;
  /** Si se supo que no habia conexion desde el ultimo aviso. */
  readonly estabaSinConexion: boolean;
  /** El momento en que termino la tanda. Por omision, ahora. */
  readonly ahora?: Date;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lo que de verdad espero en este equipo antes de salir: no salio de inmediato. */
function losQueEsperaron(recibos: readonly ReciboDeEnvio[], ahora: Date): readonly ReciboDeEnvio[] {
  return recibos.filter(
    (recibo) =>
      ahora.getTime() - new Date(recibo.creadaEn).getTime() >=
      ESPERA_PARA_QUE_CUENTE_COMO_GUARDADO_EN_MS,
  );
}

/**
 * La orientacion de los resultados enviados: la actividad y el nivel. Lo que no tiene
 * la forma esperada se salta.
 */
function orientacionesDe(recibos: readonly ReciboDeEnvio[]): readonly OrientacionDelAviso[] {
  const orientaciones: OrientacionDelAviso[] = [];

  for (const { tipo, recibo } of recibos) {
    if (
      tipo === 'resultado.registrar' &&
      esObjeto(recibo) &&
      typeof recibo.activityId === 'string' &&
      recibo.activityId !== '' &&
      NIVELES_ORIENTATIVOS.has(recibo.nivelOrientativo)
    ) {
      orientaciones.push({
        activityId: recibo.activityId,
        nivelOrientativo: recibo.nivelOrientativo as NivelOrientativo,
      });
    }
  }

  return orientaciones;
}

/**
 * Lo que la API respondio a lo enviado que pide acompanar, con sus lineas. Se
 * quitan repetidas: dos resultados seguidos devuelven las mismas.
 */
function acompanamientoDe(recibos: readonly ReciboDeEnvio[]): {
  readonly sugiere: boolean;
  readonly lineas: readonly LineaDeAtencion[];
} {
  const lineas = new Map<string, LineaDeAtencion>();
  let sugiere = false;

  for (const { recibo } of recibos) {
    if (!esObjeto(recibo) || recibo.sugiereAcompanamiento !== true) {
      continue;
    }

    sugiere = true;

    if (Array.isArray(recibo.lineasDeAtencion)) {
      for (const linea of recibo.lineasDeAtencion as unknown[]) {
        if (esObjeto(linea) && typeof linea.id === 'string') {
          lineas.set(linea.id, linea as unknown as LineaDeAtencion);
        }
      }
    }
  }

  return { sugiere, lineas: [...lineas.values()] };
}

/** Cuantas de las correcciones enviadas se guardaron aparte como una copia. */
function copiasDe(recibos: readonly ReciboDeEnvio[]): number {
  return recibos.filter(({ recibo }) => esAnotacionCopiada(recibo)).length;
}

function fraseDeLasCopias(copias: number): string {
  return copias === 1
    ? 'Una corrección de tu diario no se pudo aplicar a la anotación original, así que se guardó como una copia. No se perdió nada.'
    : `${String(copias)} correcciones de tu diario no se pudieron aplicar a las anotaciones originales, así que se guardaron como copias. No se perdió nada.`;
}

/**
 * El aviso de que se perdio la conexion. Tranquiliza: lo que se haga no se pierde.
 */
export function avisoDeSinConexion(): Aviso {
  return {
    texto:
      'Sin conexión. Lo que hagas se guarda en este equipo y se envía cuando vuelva la conexión.',
    tono: 'info',
    enviadas: 0,
    verLista: false,
    pedirEntrar: false,
    sugiereAcompanamiento: false,
    lineasDeAtencion: [],
    orientaciones: [],
    copias: 0,
  };
}

/**
 * El aviso de una tanda de sincronizacion, o `null` si no hay nada que decir.
 *
 * **Uno por tanda, no uno por cambio.** Cinco cosas enviadas de golpe son un
 * aviso: "Enviamos 5 cambios".
 *
 * Callar tambien es una decision:
 *
 * - Una tanda que no pudo empezar porque no hay conexion no avisa: el indicador ya lo
 *   dice.
 * - Una que no tenia nada que enviar tampoco, salvo que la persona la haya pedido
 *   ("Sincronizar ahora" tiene que contestar algo) o que acabe de volver la conexion.
 * - **Lo que salio de inmediato, tampoco.** Con conexion, todo pasa por la cola y sale
 *   en el acto; la pantalla de quien lo hizo ya se lo dijo, y avisarlo en cada accion
 *   seria ruido. Solo se avisa lo que **espero** en este equipo.
 */
export function construirAviso(entrada: EntradaDelAviso): Aviso | null {
  const { resultado, motivo, estabaSinConexion, ahora = new Date() } = entrada;
  const { resumen } = resultado;
  const volvioLaConexion = estabaSinConexion && motivo !== 'manual';
  const esperaron = losQueEsperaron(resumen.recibos, ahora);
  const base = {
    enviadas: resumen.enviadas,
    verLista: false,
    pedirEntrar: false,
    sugiereAcompanamiento: false,
    lineasDeAtencion: [] as readonly LineaDeAtencion[],
    orientaciones: [] as readonly OrientacionDelAviso[],
    copias: 0,
  };

  if (resultado.estado === 'sesion_vencida') {
    const sinEnviar = resumen.pendientes;

    return sinEnviar === 0 && resumen.enviadas === 0
      ? null
      : {
          ...base,
          tono: 'atencion',
          pedirEntrar: true,
          texto:
            sinEnviar === 0
              ? 'Tu sesión venció. Entra de nuevo para seguir.'
              : `Tu sesión venció. Entra de nuevo para enviar ${cambiosGuardados(sinEnviar)} en este equipo.`,
        };
  }

  // La persona pidio enviar y no hay con que: tiene que enterarse. Por su cuenta, el
  // indicador ya lo dice y no se repite en cada intento.
  if (resultado.estado === 'sin_conexion') {
    return motivo === 'manual'
      ? {
          ...base,
          tono: 'info',
          texto: 'Sigues sin conexión. Tus cambios siguen guardados en este equipo.',
        }
      : null;
  }

  if (resultado.estado === 'nada_que_hacer') {
    if (motivo === 'manual') {
      return { ...base, tono: 'exito', texto: 'No hay cambios por enviar.' };
    }

    return volvioLaConexion
      ? { ...base, tono: 'exito', texto: 'Volviste a tener conexión.' }
      : null;
  }

  if (resultado.estado !== 'terminada') {
    return null;
  }

  const { enviadas, requierenAtencion, conflictos, pendientes } = resumen;
  const problemas = requierenAtencion + conflictos;
  // El acompanamiento y la orientacion son de lo que espero: lo que salio de inmediato lo
  // ensena la pantalla de quien lo hizo.
  const acompanamiento = acompanamientoDe(esperaron);
  const copias = copiasDe(resumen.recibos);
  const extra = {
    sugiereAcompanamiento: acompanamiento.sugiere,
    lineasDeAtencion: acompanamiento.lineas,
    orientaciones: orientacionesDe(esperaron),
    copias,
  };

  if (enviadas === 0 && problemas === 0 && pendientes === 0) {
    if (motivo === 'manual') {
      return { ...base, tono: 'exito', texto: 'No hay cambios por enviar.' };
    }

    return volvioLaConexion
      ? { ...base, tono: 'exito', texto: 'Volviste a tener conexión.' }
      : null;
  }

  // Todo salio bien.
  if (problemas === 0 && pendientes === 0) {
    // Si todo salio de inmediato y nadie lo pidio, la pantalla ya lo dijo. Salvo una copia:
    // eso la persona no lo espera, y puede haber salido de la pantalla que lo habria dicho.
    if (esperaron.length === 0 && motivo !== 'manual' && !volvioLaConexion) {
      return copias === 0
        ? null
        : { ...base, ...extra, tono: 'info', texto: fraseDeLasCopias(copias) };
    }

    const cuantos = esperaron.length > 0 ? esperaron.length : enviadas;
    const guardados = `${cambios(cuantos)} que ${cuantos === 1 ? 'estaba guardado' : 'estaban guardados'} en este equipo`;
    const principal = volvioLaConexion
      ? `Volviste a tener conexión. Enviamos ${guardados}.`
      : motivo === 'manual'
        ? `Listo. Enviamos ${guardados}.`
        : `Enviamos ${guardados}.`;

    return {
      ...base,
      ...extra,
      tono: 'exito',
      texto: copias === 0 ? principal : `${principal} ${fraseDeLasCopias(copias)}`,
    };
  }

  // Algo no salio. Se dice lo que si, lo que no y que hacer.
  const partes: string[] = [];

  if (volvioLaConexion) {
    partes.push('Volviste a tener conexión.');
  }

  if (enviadas > 0) {
    partes.push(`Enviamos ${cambios(enviadas)}.`);
  }

  if (problemas > 0) {
    partes.push(
      problemas === 1
        ? '1 cambio necesita tu atención.'
        : `${String(problemas)} cambios necesitan tu atención.`,
    );
  }

  if (pendientes > 0) {
    partes.push(
      pendientes === 1
        ? '1 cambio sigue guardado en este equipo y se volverá a intentar.'
        : `${String(pendientes)} cambios siguen guardados en este equipo y se volverán a intentar.`,
    );
  }

  if (copias > 0) {
    partes.push(fraseDeLasCopias(copias));
  }

  // Una tanda que solo encontro al servidor sin responder, ya avisada o no pedida,
  // se calla: avisar en cada reintento seria ruido.
  if (enviadas === 0 && problemas === 0 && motivo !== 'manual' && !volvioLaConexion) {
    return null;
  }

  return {
    ...base,
    ...extra,
    tono: 'atencion',
    verLista: problemas > 0 || pendientes > 0,
    texto: partes.join(' '),
  };
}
