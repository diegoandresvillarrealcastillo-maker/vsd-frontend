import { useCallback, useEffect, useRef, useState } from 'react';

import type { ActividadConSuCategoria } from '../../infraestructura/api/catalogo.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import type {
  Metadata,
  ResultadoPorRegistrar,
  ResultadoRegistrado,
} from '../../infraestructura/api/resultados.ts';
import { reintentarCambio } from '../../sincronizacion/acciones.ts';
import { buscarActividadConCopia } from '../../sincronizacion/catalogoLocal.ts';
import { clasificarFallo } from '../../sincronizacion/clasificarFallo.ts';
import { SinAlmacenAbierto, encolar } from '../../sincronizacion/ciclo.ts';
import type { ErrorDeOperacion } from '../../sincronizacion/cola.ts';
import { seguirUnaOperacion, type Seguimiento } from '../../sincronizacion/seguimiento.ts';

/**
 * Lo que produce una actividad al terminarse.
 *
 * Es el contrato entre el motor y cada mecanica. El motor no sabe jugar a nada:
 * sabe cargar la actividad, guardar lo que la mecanica le entregue, y contar
 * como fue. La mecanica no sabe nada de HTTP.
 *
 * El `score` es **crudo**, en la escala de la actividad, y lo calcula la
 * mecanica porque es la unica que sabe sobre cuanto se puntua. El catalogo no
 * publica ese maximo a proposito: si el cliente lo conociera junto con los
 * cortes, podria derivar el nivel por su cuenta y habria dos interpretaciones
 * del mismo dato.
 */
export interface LoQueProduceLaActividad {
  readonly score?: number;
  readonly metadata?: Metadata;
}

/** En que punto esta la actividad. */
export type EstadoDeLaActividad =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'no-existe' }
  | { readonly fase: 'lista'; readonly ficha: ActividadConSuCategoria }
  | { readonly fase: 'enviando'; readonly ficha: ActividadConSuCategoria }
  /**
   * El resultado esta **guardado en este equipo** y todavia no se envio: no hay
   * conexion, o el servidor no respondio y se va a reintentar. La pantalla lo dice
   * asi (SCRUM-138), sin simular que se envio. En cuanto salga, pasa a `hecha`.
   */
  | { readonly fase: 'guardada'; readonly ficha: ActividadConSuCategoria }
  | {
      readonly fase: 'hecha';
      readonly ficha: ActividadConSuCategoria;
      readonly resultado: ResultadoRegistrado;
    }
  | {
      readonly fase: 'error';
      readonly mensaje: string;
      /** Presente cuando ya se habia cargado la actividad y fallo el guardado. */
      readonly ficha?: ActividadConSuCategoria;
    };

/**
 * Lo que se le dice a la persona cuando la API rechazo el resultado.
 *
 * Se decide por el codigo de la API cuando lo hay, y por el estado HTTP cuando
 * no. Nunca por el texto, que puede reescribirse sin avisar.
 */
function explicarElRechazo(error: ErrorDeOperacion | null): string {
  switch (error?.codigo) {
    case 'ACTIVIDAD_NO_ENCONTRADA':
      return 'Esa actividad ya no está disponible.';

    case 'PUNTAJE_FUERA_DE_RANGO':
      return 'El resultado quedó fuera de lo que esta actividad admite. Vuelve a intentarlo.';

    case 'PUNTAJE_NO_APLICABLE':
      return 'Esta actividad registra lo que haces, no lo califica.';

    case 'CUENTA_NO_REGISTRADA':
      return 'Todavía no tienes una cuenta de VSD Health. Vuelve al panel para crearla.';

    case 'FECHA_EN_EL_FUTURO':
      return 'La fecha de la actividad no puede estar en el futuro. Revisa la hora de tu dispositivo.';

    case 'SIN_RESPUESTA':
      return 'El servidor no responde. Tu resultado sigue guardado en este equipo: puedes reintentar en un momento.';

    default:
      break;
  }

  if (error?.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  if (error?.estado !== undefined) {
    return `No se pudo guardar (error ${String(error.estado)}). Vuelve a intentarlo en un momento.`;
  }

  return 'No se pudo guardar este resultado. Vuelve a intentarlo.';
}

/**
 * Lo que se le dice cuando falla **cargar** la actividad.
 *
 * Sin conexion y sin copia, no hay actividad que abrir: se dice que hace falta
 * conexion **la primera vez**, y que despues ya no (SCRUM-138). No se inventa nada.
 */
function explicarLaCarga(error: unknown): string {
  // Solo cuando no se pudo llegar a la API. Un servidor que responde con un error no es
  // "falta de conexion": decirlo asi mandaria a revisar lo que esta bien.
  if (clasificarFallo(error).clase === 'red') {
    return 'Esta actividad necesita conexión la primera vez que se abre. Conéctate y vuelve a intentarlo: después podrás hacerla sin conexión.';
  }

  if (error instanceof ErrorDeLaApi && error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar.';
  }

  return 'No se pudo cargar la actividad. Vuelve a intentarlo en un momento.';
}

/** Lo que dice la pantalla cuando no hay donde guardar. */
const SIN_DONDE_GUARDAR =
  'No se pudo guardar tu resultado en este equipo. Vuelve a entrar y hazla otra vez.';

/**
 * Lo que se le muestra a la persona segun lo que paso con lo guardado.
 *
 * `guardada` no es el final: el resultado sigue en este equipo y se espera, sin
 * limite, a que salga o la API lo rechace. Cuando pasa, la pantalla cambia sola.
 */
export function mostrarLoQuePaso(
  seguimiento: Seguimiento,
  ficha: ActividadConSuCategoria,
  senal: AbortSignal,
  operacion: string,
  poner: (estado: EstadoDeLaActividad) => void,
): void {
  if (senal.aborted) {
    return;
  }

  switch (seguimiento.tipo) {
    case 'enviada':
      // Lo que respondio la API: la orientacion y, si corresponde, las lineas.
      poner({ fase: 'hecha', ficha, resultado: seguimiento.recibo as ResultadoRegistrado });
      break;

    case 'rechazada':
      poner({ fase: 'error', mensaje: explicarElRechazo(seguimiento.error), ficha });
      break;

    case 'sin_almacen':
      poner({ fase: 'error', mensaje: SIN_DONDE_GUARDAR, ficha });
      break;

    case 'guardada':
      poner({ fase: 'guardada', ficha });
      void seguirUnaOperacion(operacion, { esperaMaximaEnMs: null, senal }).then((despues) => {
        if (despues.tipo !== 'guardada') {
          mostrarLoQuePaso(despues, ficha, senal, operacion, poner);
        }
      });
      break;
  }
}

/**
 * El motor: carga una actividad, recibe lo que produjo y lo guarda en la cola.
 *
 * ## Siempre por la cola (SCRUM-138)
 *
 * El resultado **no se envia desde aqui**: se guarda en la cola de este equipo y la
 * sincronizacion lo envia. Con conexion sale en el acto y la pantalla ensena lo que
 * respondio la API; sin ella, queda guardado y la pantalla lo dice, y sale cuando
 * vuelva la conexion. Es el mismo camino en los dos casos, asi que no hay uno que se
 * pruebe y otro que no.
 *
 * ## El identificador de operacion se genera al empezar, no al enviar
 *
 * Es lo que hace segura la repeticion. Si la red se corta despues de enviar
 * pero antes de que llegue la respuesta, el resultado puede haberse guardado y
 * la persona no lo sabe. Al reenviar se manda **el mismo** identificador, y
 * el servidor devuelve lo que ya existe en lugar de crear un duplicado.
 *
 * Si se generara al pulsar el boton, cada reintento seria una operacion nueva y
 * un intento se registraria tres veces.
 *
 * Se renueva solo cuando la persona empieza otra vez de cero: dos intentos distintos
 * nunca se mezclan.
 */
export function useCompletarActividad(id: string | undefined): {
  readonly estado: EstadoDeLaActividad;
  readonly completar: (produjo: LoQueProduceLaActividad) => void;
  readonly reintentar: () => void;
  readonly empezarDeNuevo: () => void;
} {
  // El estado inicial se deriva aqui y no dentro del efecto. Sin `id` no hay
  // nada que cargar, y decirlo en el primer render evita pintar "cargando" un
  // instante para una actividad que no va a llegar nunca.
  const [estado, setEstado] = useState<EstadoDeLaActividad>(
    id === undefined ? { fase: 'no-existe' } : { fase: 'cargando' },
  );
  const [intento, setIntento] = useState(0);
  const [operacion, setOperacion] = useState(() => globalThis.crypto.randomUUID());

  // Lo ultimo que produjo la mecanica, para poder reintentar el guardado sin
  // pedirle a la persona que lo repita.
  const [ultimo, setUltimo] = useState<LoQueProduceLaActividad | null>(null);

  /** Cancela los seguimientos de lo guardado cuando la pantalla se cierra o se empieza de nuevo. */
  const seguimientos = useRef<AbortController>(new AbortController());

  useEffect(() => {
    const control = new AbortController();

    seguimientos.current = control;

    return () => {
      control.abort();
    };
  }, []);

  useEffect(() => {
    if (id === undefined) {
      return;
    }

    const control = new AbortController();

    // Recibe el identificador por parametro en lugar de tomarlo del entorno.
    // TypeScript no estrecha una variable capturada dentro de una funcion
    // declarada, y pasarlo se lee mejor que convencer al compilador.
    async function cargar(idActividad: string): Promise<void> {
      try {
        const ficha = await buscarActividadConCopia(idActividad, control.signal);

        if (control.signal.aborted) {
          return;
        }

        setEstado(ficha === null ? { fase: 'no-existe' } : { fase: 'lista', ficha });
      } catch (error) {
        if (control.signal.aborted) {
          return;
        }

        setEstado({ fase: 'error', mensaje: explicarLaCarga(error) });
      }
    }

    void cargar(id);

    return () => {
      control.abort();
    };
  }, [id, intento]);

  const guardar = useCallback(
    async (produjo: LoQueProduceLaActividad, ficha: ActividadConSuCategoria) => {
      const senal = seguimientos.current.signal;
      const resultado: ResultadoPorRegistrar = {
        activityId: ficha.actividad.id,
        clientOperationId: operacion,
        // Se toma aqui y no en el servidor porque es cuando la persona
        // termino de verdad. Sin conexion, la diferencia entre las dos puede ser
        // de horas.
        completedAt: new Date().toISOString(),
        ...(produjo.score === undefined ? {} : { score: produjo.score }),
        ...(produjo.metadata === undefined ? {} : { metadata: produjo.metadata }),
      };

      setUltimo(produjo);
      setEstado({ fase: 'enviando', ficha });

      try {
        // Es idempotente por `operationId`: guardar lo mismo dos veces no duplica.
        await encolar({
          operationId: operacion,
          tipo: 'resultado.registrar',
          entidad: `resultado:${operacion}`,
          payload: resultado,
        });
      } catch (error) {
        if (!senal.aborted) {
          setEstado({
            fase: 'error',
            mensaje:
              error instanceof SinAlmacenAbierto ? SIN_DONDE_GUARDAR : explicarElRechazo(null),
            ficha,
          });
        }

        return;
      }

      mostrarLoQuePaso(
        await seguirUnaOperacion(operacion, { sincronizarYa: true, senal }),
        ficha,
        senal,
        operacion,
        setEstado,
      );
    },
    [operacion],
  );

  const completar = useCallback(
    (produjo: LoQueProduceLaActividad) => {
      const ficha =
        estado.fase === 'lista' || estado.fase === 'error' || estado.fase === 'enviando'
          ? estado.ficha
          : undefined;

      if (ficha === undefined) {
        return;
      }

      void guardar(produjo, ficha);
    },
    [estado, guardar],
  );

  const reintentar = useCallback(() => {
    if (estado.fase !== 'error') {
      return;
    }

    // Dos fallos distintos. Si ya habia ficha, fallo el guardado o el envio y se repite
    // con el MISMO identificador de operacion. Si no, fallo la carga y lo que hay que
    // repetir es traerla.
    if (estado.ficha !== undefined && ultimo !== null) {
      const { ficha } = estado;

      // Si la API la rechazo, vuelve a la cola; si ya no esta, `guardar` la agrega otra
      // vez con el mismo identificador. En los dos casos, una sola operacion.
      void reintentarCambio(operacion).then(() => guardar(ultimo, ficha));

      return;
    }

    setEstado({ fase: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, [estado, ultimo, operacion, guardar]);

  const empezarDeNuevo = useCallback(() => {
    // Otro intento de verdad, asi que otra operacion. Sin esto, el servidor
    // devolveria el resultado anterior y pareceria que no se guardo nada. Lo que se
    // estaba esperando del intento anterior ya no le toca a esta pantalla.
    seguimientos.current.abort();
    seguimientos.current = new AbortController();
    setOperacion(globalThis.crypto.randomUUID());
    setUltimo(null);
    setEstado({ fase: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, []);

  return { estado, completar, reintentar, empezarDeNuevo };
}
