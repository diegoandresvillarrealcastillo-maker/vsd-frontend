import type { AlmacenLocal } from './almacenLocal.ts';
import { clasificarFallo } from './clasificarFallo.ts';
import {
  DIAS_QUE_SE_CONSERVAN_LAS_HECHAS,
  MAXIMO_DE_INTENTOS,
  esperaDeReintento,
  haceCuanto,
  planDeEnvio,
  type Operacion,
  type TipoDeOperacion,
} from './cola.ts';
import {
  EJECUTORES,
  OperacionInvalida,
  comprobarLaOperacion,
  type ContextoDeEjecucion,
  type Ejecutor,
} from './ejecutores.ts';

/**
 * El motor que envia lo guardado cuando se puede (SCRUM-136, HU_MF09_002).
 *
 * Toma las operaciones pendientes de la cola y las manda a la API, en un orden que
 * no rompe nada, sin perder ninguna y sin duplicar ninguna.
 *
 * ## Lo que garantiza
 *
 * - **Orden sobre una misma cosa, libertad entre cosas distintas.** Editar un
 *   pendiente espera a que se cree; una anotacion rechazada no detiene a los
 *   pendientes (`planDeEnvio`).
 * - **Nada se pierde.** Sin red, la operacion queda como estaba. Con la sesion
 *   caducada, el envio se detiene y **la cola se conserva** (criterio 5). Una
 *   operacion no se descarta por fallar: se marca para atencion.
 * - **Nada se duplica.** Se reenvia con el mismo identificador de operacion y la
 *   API devuelve el resultado que ya tenia (criterio 2).
 * - **Un fallo pasajero se reintenta con espera creciente** y no detiene a las
 *   demas (criterio 3). Uno permanente se marca y tampoco las detiene (criterio 4).
 * - **Nunca se envia con la sesion de otra persona.** Cada almacen es de una
 *   persona; si la sesion actual no es esa, no se manda nada.
 * - **Una sola sincronizacion a la vez**, aunque haya varias pestanas abiertas.
 *
 * Quien decide **cuando** sincronizar (al volver la red, al abrir la aplicacion, con
 * un boton) no es este archivo: es SCRUM-137. Aqui esta el **como**.
 */

export type MotivoDeSincronizacion = 'manual' | 'conexion' | 'apertura' | 'programada';

export type EstadoDeLaSincronizacion =
  /** Se hizo lo que habia que hacer (puede quedar algo esperando su turno o su reintento). */
  | 'terminada'
  /** No habia nada pendiente. No se toco la red. */
  | 'nada_que_hacer'
  /** No hay conexion con la API. Nada se toco. */
  | 'sin_conexion'
  /** La sesion no vale. Se detuvo el envio y la cola sigue ahi. */
  | 'sesion_vencida'
  /** No hay sesion: no se manda nada. */
  | 'sin_sesion'
  /** La sesion es de otra persona que la de este almacen: no se manda nada. */
  | 'persona_distinta'
  /** Ya habia otra sincronizacion en marcha (en esta pestana o en otra). */
  | 'ocupada';

export interface ReciboDeEnvio {
  readonly operationId: string;
  readonly tipo: TipoDeOperacion;
  readonly recibo: unknown;
}

export interface ResumenDeSincronizacion {
  /** Las que la API acepto en esta tanda. */
  readonly enviadas: number;
  /** Las que la API rechazo de forma permanente en esta tanda. */
  readonly requierenAtencion: number;
  /** Las que chocaron con un cambio de otro dispositivo en esta tanda. */
  readonly conflictos: number;
  /** Las que siguen pendientes al terminar (esperando turno, reintento o red). */
  readonly pendientes: number;
  /**
   * Lo que respondio la API a cada una de las enviadas: es de donde sale lo que se
   * le ensena a la persona (la orientacion de una actividad hecha sin conexion).
   */
  readonly recibos: readonly ReciboDeEnvio[];
}

export interface ResultadoDeSincronizacion {
  readonly estado: EstadoDeLaSincronizacion;
  readonly resumen: ResumenDeSincronizacion;
}

export type EventoDelMotor =
  | { readonly tipo: 'inicio'; readonly motivo: MotivoDeSincronizacion }
  | { readonly tipo: 'enviada'; readonly operacion: Operacion; readonly recibo: unknown }
  | { readonly tipo: 'fin'; readonly resultado: ResultadoDeSincronizacion };

// ---------------------------------------------------------------------------
// Una sola a la vez
// ---------------------------------------------------------------------------

/**
 * Ejecuta la tarea solo si nadie mas tiene `nombre`. Si ya esta ocupado, no la
 * ejecuta ni espera: dice `ejecutada: false`.
 */
export type Exclusion = <T>(
  nombre: string,
  tarea: () => Promise<T>,
) => Promise<{ readonly ejecutada: true; readonly valor: T } | { readonly ejecutada: false }>;

/**
 * La exclusion de verdad: Web Locks, que vale entre pestanas del mismo sitio. Dos
 * pestanas abiertas no sincronizan a la vez, que seria lo mismo que enviar todo
 * dos veces. Donde el navegador no tiene Web Locks, vale solo dentro de esta
 * pestana.
 */
export function crearExclusion(): Exclusion {
  const enCurso = new Set<string>();

  return async (nombre, tarea) => {
    const bloqueos = typeof navigator === 'undefined' ? undefined : navigator.locks;

    if (bloqueos !== undefined) {
      return bloqueos.request(nombre, { ifAvailable: true }, async (bloqueo) => {
        if (bloqueo === null) {
          return { ejecutada: false } as const;
        }

        return { ejecutada: true, valor: await tarea() } as const;
      });
    }

    if (enCurso.has(nombre)) {
      return { ejecutada: false };
    }

    enCurso.add(nombre);

    try {
      return { ejecutada: true, valor: await tarea() };
    } finally {
      enCurso.delete(nombre);
    }
  };
}

// ---------------------------------------------------------------------------
// El motor
// ---------------------------------------------------------------------------

export interface DependenciasDelMotor {
  readonly almacen: AlmacenLocal;
  /** Como se envia cada tipo. Por omision, las llamadas de verdad a la API. */
  readonly ejecutores?: Readonly<Record<TipoDeOperacion, Ejecutor>>;
  /** El identificador de la persona que tiene la sesion abierta, o `null`. */
  readonly personaDeLaSesion: () => string | null;
  /** Si de verdad hay conexion con la API (no basta con lo que diga el navegador). */
  readonly confirmarConexion: () => Promise<boolean>;
  readonly reloj?: () => Date;
  /** Un numero en [0, 1): el azar de la espera. Se recibe para poder probarlo. */
  readonly azar?: () => number;
  readonly exclusion?: Exclusion;
}

export interface MotorDeSincronizacion {
  sincronizar(motivo: MotivoDeSincronizacion): Promise<ResultadoDeSincronizacion>;
  /** Si hay una sincronizacion en marcha **en esta pestana**. */
  estaSincronizando(): boolean;
  suscribir(oyente: (evento: EventoDelMotor) => void): () => void;
}

const SIN_NADA: ResumenDeSincronizacion = {
  enviadas: 0,
  requierenAtencion: 0,
  conflictos: 0,
  pendientes: 0,
  recibos: [],
};

/** Lo que se anota de cuando se sincronizo por ultima vez (en `meta`). */
export const META_ULTIMA_SINCRONIZACION = 'ultimaSincronizacion';

export function crearMotor(dependencias: DependenciasDelMotor): MotorDeSincronizacion {
  const {
    almacen,
    personaDeLaSesion,
    confirmarConexion,
    ejecutores = EJECUTORES,
    reloj = () => new Date(),
    azar = Math.random,
    exclusion = crearExclusion(),
  } = dependencias;
  const oyentes = new Set<(evento: EventoDelMotor) => void>();
  let sincronizando = false;

  function emitir(evento: EventoDelMotor): void {
    oyentes.forEach((oyente) => {
      try {
        oyente(evento);
      } catch {
        // Quien escucha no puede romper el envio.
      }
    });
  }

  /** Lo que hace una tanda, con la exclusion ya tomada. */
  async function tanda(): Promise<ResultadoDeSincronizacion> {
    const persona = personaDeLaSesion();

    if (persona === null) {
      return { estado: 'sin_sesion', resumen: SIN_NADA };
    }

    if (persona !== almacen.persona) {
      return { estado: 'persona_distinta', resumen: SIN_NADA };
    }

    const operaciones = new Map<string, Operacion>();

    for (const operacion of await almacen.operaciones()) {
      operaciones.set(operacion.operationId, operacion);
    }

    /** Guarda en el almacen y en lo que se tiene en memoria. */
    async function guardar(operacion: Operacion): Promise<Operacion> {
      await almacen.guardarOperacion(operacion);
      operaciones.set(operacion.operationId, operacion);

      return operacion;
    }

    // Lo que quedo a medias en una tanda anterior (la pagina se cerro mientras
    // enviaba) vuelve a estar pendiente. Reenviarla es seguro: la API es
    // idempotente. Lo que no se pudo leer no se envia ni se tira: pide atencion.
    for (const operacion of [...operaciones.values()]) {
      if (operacion.ilegible === true && operacion.estado !== 'requiere_atencion') {
        await guardar({
          ...operacion,
          estado: 'requiere_atencion',
          error: { codigo: 'ALMACEN_ILEGIBLE', momento: reloj().toISOString() },
        });
      } else if (operacion.estado === 'enviando') {
        await guardar({ ...operacion, estado: 'pendiente' });
      }
    }

    // Lo que termino bien hace mas de una semana ya no le sirve a nadie.
    for (const operacion of [...operaciones.values()]) {
      if (
        operacion.estado === 'hecha' &&
        haceCuanto(operacion.creadaEn, reloj()) > DIAS_QUE_SE_CONSERVAN_LAS_HECHAS * 86_400_000
      ) {
        await almacen.quitarOperacion(operacion.operationId);
        operaciones.delete(operacion.operationId);
      }
    }

    const pendientesAlEmpezar = [...operaciones.values()].filter((o) => o.estado === 'pendiente');

    // Sin nada pendiente no se toca la red: abrir la aplicacion no puede costar una
    // peticion por cada vez que no hay nada que enviar.
    if (pendientesAlEmpezar.length === 0) {
      return { estado: 'nada_que_hacer', resumen: SIN_NADA };
    }

    if (!(await confirmarConexion())) {
      return {
        estado: 'sin_conexion',
        resumen: { ...SIN_NADA, pendientes: pendientesAlEmpezar.length },
      };
    }

    const recibos: ReciboDeEnvio[] = [];
    let requierenAtencion = 0;
    let conflictos = 0;
    let corte: 'sin_conexion' | 'sesion_vencida' | 'persona_distinta' | null = null;

    const contexto: ContextoDeEjecucion = {
      reciboDe: (operationId) => {
        const operacion = operaciones.get(operationId);

        return operacion?.estado === 'hecha' ? operacion.recibo : null;
      },
    };

    // Cada vuelta termina una operacion (o la saca de la fila), asi que no puede
    // haber mas vueltas que operaciones. El tope es por si algo se tuerce.
    const tope = operaciones.size * 2 + 2;

    for (let vuelta = 0; vuelta < tope && corte === null; vuelta += 1) {
      const siguiente = planDeEnvio([...operaciones.values()], reloj()).listas[0];

      if (siguiente === undefined) {
        break;
      }

      // La sesion pudo cambiar mientras se enviaba (se cerro, entro otra persona).
      if (personaDeLaSesion() !== almacen.persona) {
        corte = 'persona_distinta';
        break;
      }

      const problema = comprobarLaOperacion(siguiente);

      if (problema !== null) {
        await guardar({
          ...siguiente,
          estado: 'requiere_atencion',
          error: { codigo: problema, momento: reloj().toISOString() },
        });
        requierenAtencion += 1;
        continue;
      }

      await guardar({ ...siguiente, estado: 'enviando' });

      // Solo la llamada a la API va dentro del `try`. Si fallara guardar lo que
      // respondio (el disco lleno), eso no es un fallo de la API ni hay que
      // clasificarlo como tal: la operacion queda "enviando" y, como la API es
      // idempotente, la siguiente tanda la reenvia sin duplicar nada.
      let reciboDeLaApi: unknown;
      let falloDelEnvio: { readonly error: unknown } | null = null;

      try {
        reciboDeLaApi = await ejecutores[siguiente.tipo](siguiente, contexto);
      } catch (error) {
        falloDelEnvio = { error };
      }

      if (falloDelEnvio === null) {
        const hecha = await guardar({
          ...siguiente,
          estado: 'hecha',
          recibo: reciboDeLaApi ?? null,
          error: null,
          proximoIntento: null,
        });

        recibos.push({ operationId: hecha.operationId, tipo: hecha.tipo, recibo: reciboDeLaApi });
        emitir({ tipo: 'enviada', operacion: hecha, recibo: reciboDeLaApi });
      } else {
        const { error } = falloDelEnvio;
        const ahora = reloj();
        const momento = ahora.toISOString();

        // Una operacion que no se pudo ni armar (no esta lo que necesita) es
        // permanente: reintentarla no la arregla.
        if (error instanceof OperacionInvalida) {
          await guardar({
            ...siguiente,
            estado: 'requiere_atencion',
            error: { codigo: error.codigo, momento },
          });
          requierenAtencion += 1;
          continue;
        }

        const fallo = clasificarFallo(error);

        switch (fallo.clase) {
          case 'red':
            // No llego: no es culpa de la operacion. Vuelve a su sitio sin gastar
            // un intento y se detiene todo: la siguiente fallaria igual.
            await guardar({ ...siguiente, estado: 'pendiente' });
            corte = 'sin_conexion';
            break;

          case 'sesion':
            // La sesion no vale. Se detiene y NO se descarta nada.
            await guardar({ ...siguiente, estado: 'pendiente' });
            corte = 'sesion_vencida';
            break;

          case 'temporal': {
            const intentos = siguiente.intentos + 1;
            const registrado = {
              codigo: fallo.codigo,
              ...(fallo.estado === undefined ? {} : { estado: fallo.estado }),
              momento,
            };

            if (intentos >= MAXIMO_DE_INTENTOS) {
              // Lleva demasiado fallando por algo que no cambia: se deja de
              // insistir en silencio y se le dice a la persona.
              await guardar({
                ...siguiente,
                estado: 'requiere_atencion',
                intentos,
                proximoIntento: null,
                error: { ...registrado, codigo: 'SIN_RESPUESTA' },
              });
              requierenAtencion += 1;
              break;
            }

            const espera = esperaDeReintento(intentos, fallo.reintentarEnSegundos, azar());

            await guardar({
              ...siguiente,
              estado: 'pendiente',
              intentos,
              proximoIntento: new Date(ahora.getTime() + espera).toISOString(),
              error: registrado,
            });
            break;
          }

          case 'conflicto':
            await guardar({
              ...siguiente,
              estado: 'conflicto',
              error: { codigo: fallo.codigo, estado: fallo.estado, momento },
            });
            conflictos += 1;
            break;

          case 'permanente':
            await guardar({
              ...siguiente,
              estado: 'requiere_atencion',
              error: {
                codigo: fallo.codigo,
                ...(fallo.estado === undefined ? {} : { estado: fallo.estado }),
                momento,
              },
            });
            requierenAtencion += 1;
            break;
        }
      }
    }

    const pendientes = [...operaciones.values()].filter((o) => o.estado === 'pendiente').length;
    const resumen: ResumenDeSincronizacion = {
      enviadas: recibos.length,
      requierenAtencion,
      conflictos,
      pendientes,
      recibos,
    };

    if (corte !== null) {
      return { estado: corte, resumen };
    }

    await almacen.guardarMeta(META_ULTIMA_SINCRONIZACION, reloj().toISOString());

    return { estado: 'terminada', resumen };
  }

  return {
    async sincronizar(motivo) {
      if (sincronizando) {
        return { estado: 'ocupada', resumen: SIN_NADA };
      }

      sincronizando = true;
      emitir({ tipo: 'inicio', motivo });

      try {
        const salida = await exclusion(`vsd-sincronizacion-${almacen.persona}`, tanda);
        const resultado: ResultadoDeSincronizacion = salida.ejecutada
          ? salida.valor
          : { estado: 'ocupada', resumen: SIN_NADA };

        emitir({ tipo: 'fin', resultado });

        return resultado;
      } finally {
        sincronizando = false;
      }
    },

    estaSincronizando: () => sincronizando,

    suscribir(oyente) {
      oyentes.add(oyente);

      return () => {
        oyentes.delete(oyente);
      };
    },
  };
}
