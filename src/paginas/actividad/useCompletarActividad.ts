import { useCallback, useEffect, useState } from 'react';

import {
  buscarActividad,
  type ActividadConSuCategoria,
} from '../../infraestructura/api/catalogo.ts';
import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import {
  registrarResultado,
  type Metadata,
  type ResultadoRegistrado,
} from '../../infraestructura/api/resultados.ts';

/**
 * Lo que produce una actividad al terminarse.
 *
 * Es el contrato entre el motor y cada mecanica. El motor no sabe jugar a nada:
 * sabe cargar la actividad, enviar lo que la mecanica le entregue, y contar
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
  | {
      readonly fase: 'hecha';
      readonly ficha: ActividadConSuCategoria;
      readonly resultado: ResultadoRegistrado;
    }
  | {
      readonly fase: 'error';
      readonly mensaje: string;
      /** Presente cuando ya se habia cargado la actividad y fallo el envio. */
      readonly ficha?: ActividadConSuCategoria;
    };

/**
 * Convierte el fallo en algo que se pueda leer.
 *
 * Se decide por el codigo de la API cuando lo hay, y por el estado HTTP cuando
 * no. Nunca por el texto, que puede reescribirse sin avisar.
 */
function explicar(error: unknown): string {
  if (!(error instanceof ErrorDeLaApi)) {
    return 'No se pudo guardar. Revisa tu conexión y vuelve a intentarlo: lo que hiciste no se ha perdido.';
  }

  switch (error.codigo) {
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

    default:
      break;
  }

  if (error.estado === 401) {
    return 'Tu sesión caducó. Vuelve a entrar; lo que hiciste no se ha guardado.';
  }

  if (error.estado === 429) {
    return 'Hiciste muchas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
  }

  return `No se pudo guardar (error ${error.estado}). Vuelve a intentarlo en un momento.`;
}

/**
 * El motor: carga una actividad, recibe lo que produjo y lo registra.
 *
 * ## El identificador de operacion se genera al empezar, no al enviar
 *
 * Es lo que hace segura la repeticion. Si la red se corta despues de enviar
 * pero antes de que llegue la respuesta, el resultado puede haberse guardado y
 * la persona no lo sabe. Al reintentar se manda **el mismo** identificador, y
 * el servidor devuelve lo que ya existe en lugar de crear un duplicado.
 *
 * Si se generara al pulsar el boton, cada reintento seria una operacion nueva y
 * un intento se registraria tres veces.
 *
 * Se renueva solo cuando la persona empieza otra vez de cero.
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

  // Lo ultimo que produjo la mecanica, para poder reintentar el envio sin
  // pedirle a la persona que lo repita.
  const [ultimo, setUltimo] = useState<LoQueProduceLaActividad | null>(null);

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
        const ficha = await buscarActividad(idActividad, control.signal);

        if (control.signal.aborted) {
          return;
        }

        setEstado(ficha === null ? { fase: 'no-existe' } : { fase: 'lista', ficha });
      } catch (error) {
        if (control.signal.aborted) {
          return;
        }

        setEstado({ fase: 'error', mensaje: explicar(error) });
      }
    }

    void cargar(id);

    return () => {
      control.abort();
    };
  }, [id, intento]);

  const enviar = useCallback(
    (produjo: LoQueProduceLaActividad, ficha: ActividadConSuCategoria) => {
      setUltimo(produjo);
      setEstado({ fase: 'enviando', ficha });

      registrarResultado({
        activityId: ficha.actividad.id,
        clientOperationId: operacion,
        // Se toma aqui y no en el servidor porque es cuando la persona
        // termino de verdad. Con sincronizacion sin conexion, la diferencia
        // entre las dos puede ser de horas.
        completedAt: new Date().toISOString(),
        ...(produjo.score === undefined ? {} : { score: produjo.score }),
        ...(produjo.metadata === undefined ? {} : { metadata: produjo.metadata }),
      })
        .then((resultado) => {
          setEstado({ fase: 'hecha', ficha, resultado });
        })
        .catch((error: unknown) => {
          // La ficha viaja con el error para que la pantalla siga sabiendo de
          // que actividad hablamos, y para poder reintentar sin recargar.
          setEstado({ fase: 'error', mensaje: explicar(error), ficha });
        });
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

      enviar(produjo, ficha);
    },
    [estado, enviar],
  );

  const reintentar = useCallback(() => {
    if (estado.fase !== 'error') {
      return;
    }

    // Dos fallos distintos. Si ya habia ficha, fallo el envio y se repite con
    // el MISMO identificador de operacion. Si no, fallo la carga y lo que hay
    // que repetir es traerla.
    if (estado.ficha !== undefined && ultimo !== null) {
      enviar(ultimo, estado.ficha);

      return;
    }

    setEstado({ fase: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, [estado, ultimo, enviar]);

  const empezarDeNuevo = useCallback(() => {
    // Otro intento de verdad, asi que otra operacion. Sin esto, el servidor
    // devolveria el resultado anterior y pareceria que no se guardo nada.
    setOperacion(globalThis.crypto.randomUUID());
    setUltimo(null);
    setEstado({ fase: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, []);

  return { estado, completar, reintentar, empezarDeNuevo };
}
