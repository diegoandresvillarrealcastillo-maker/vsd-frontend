import { useCallback, useEffect, useRef, useState } from 'react';

import {
  preguntarAlAsistente,
  type RespuestaDelAsistente,
} from '../infraestructura/api/asistente.ts';
import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import { zonaActual } from '../tiempo/zonaHoraria.ts';
import { responderSinConexion, type ResultadoSinConexion } from './reglasLocales.ts';

/**
 * La conversacion con VSD IA (SCRUM-100, SCRUM-141).
 *
 * Vive solo en memoria y solo mientras el asistente esta abierto: al cerrarlo
 * se olvida. Nada de lo escrito va al almacenamiento del navegador, y el
 * servidor tampoco lo guarda.
 *
 * Nunca se queda cargando: sin conexion lo dice al momento, y si el servidor
 * tarda mas de la cuenta se deja de esperar y tambien se dice.
 *
 * ## Sin conexion: un asistente mixto (SCRUM-141)
 *
 * Sin conexion no se intenta preguntar al servidor. Se aplican las reglas que el servidor
 * publico y la aplicacion guardo (`ReglasLocales`), y solo responden **lo basico**: una
 * senal de riesgo (con las lineas de su pais, sin esperar), un saludo, un agradecimiento,
 * una despedida y donde buscar ayuda. **Todo lo demas exige conexion** y se dice, sin
 * inventar nada.
 *
 * Y lo que se escribe sin conexion **no se envia despues**: no entra a ninguna cola. Se
 * queda en la pantalla con su aviso, y es la persona quien decide si lo reenvia
 * (`Reintentar`). Al cerrar el asistente se olvida, como todo lo demas.
 *
 * Con conexion no cambia nada. Solo cuando la peticion no llega (no hay red, o tarda
 * demasiado) se prueba lo mismo antes de rendirse.
 *
 * ## El lenguaje ofensivo y el cierre (SCRUM-192)
 *
 * El servidor no guarda conversaciones, asi que **no cuenta**: solo dice que un mensaje fue
 * ofensivo (`lenguaje_ofensivo`). La cuenta la lleva esta ventana de chat, en memoria:
 *
 * - Cuentan los insultos **seguidos**. Cualquier respuesta que no sea ofensiva reinicia la
 *   cuenta, y un fallo de red ni cuenta ni reinicia.
 * - A los `umbral` seguidos (3, lo que publica el servidor) la conversacion **se cierra**: se
 *   dice, y no se acepta nada mas en esta ventana.
 * - Cerrar **no bloquea a nadie**: `empezarDeNuevo` abre otra, sin nada de la anterior. El riesgo
 *   no queda atrapado en una conversacion cerrada.
 */

export type MotivoDelFallo = 'sin-conexion' | 'exige-conexion' | 'tarda' | 'muchas' | 'otro';

/** A cuantos insultos seguidos se cierra, si el servidor no publico otra cosa. */
const UMBRAL_POR_OMISION = 3;

/** Lo que se dice al cerrar, si el servidor no publico otra cosa (nunca se abrio con conexion). */
const CIERRE_POR_OMISION =
  'Voy a cerrar esta conversación por ahora. Puedes abrir una nueva cuando quieras: aquí voy a estar. Y si quieres hablar con alguien, pregúntame «¿Dónde busco ayuda?» en la conversación nueva.';

const INTENCION_OFENSIVA = 'lenguaje_ofensivo';

export type Mensaje =
  | { readonly id: number; readonly de: 'persona'; readonly texto: string }
  /** El aviso de que esta conversacion se cerro (SCRUM-192). Lo pone la ventana, no el servidor. */
  | { readonly id: number; readonly de: 'cierre'; readonly texto: string }
  | {
      readonly id: number;
      readonly de: 'asistente';
      readonly respuesta: RespuestaDelAsistente;
      /** Cierto si lo respondio este dispositivo, sin preguntar al servidor. */
      readonly sinConexion: boolean;
    }
  | {
      readonly id: number;
      readonly de: 'fallo';
      readonly motivo: MotivoDelFallo;
      /** Lo que no llego a responderse, para poder reintentarlo. */
      readonly pregunta: string;
    };

/** Un mensaje antes de numerarlo. Se reparte sobre cada clase de mensaje. */
type SinNumero<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Lo que se espera antes de dar por perdido el intento. */
export const ESPERA_MAXIMA_MS = 20_000;

function motivoDe(error: unknown, porTiempo: boolean): MotivoDelFallo {
  if (porTiempo) {
    return 'tarda';
  }

  if (error instanceof ErrorDeLaApi) {
    return error.estado === 429 ? 'muchas' : 'otro';
  }

  // `fetch` rechaza con un TypeError cuando no llega a haber respuesta.
  return 'sin-conexion';
}

/**
 * Lo que respondio este dispositivo, con la forma de lo que responde el servidor: la
 * pantalla pinta las dos igual. Se guarda para decir de cual de las dos viene.
 */
function comoRespuesta(
  resultado: Exclude<ResultadoSinConexion, { readonly tipo: 'exige-conexion' }>,
): RespuestaDelAsistente {
  switch (resultado.tipo) {
    case 'riesgo':
      return {
        // Como en el servidor: la senal de riesgo siempre es "me siento mal".
        intencion: 'me_siento_mal',
        mensaje: resultado.mensaje,
        recursos: resultado.lineas,
        senalDeRiesgo: true,
        incluyeLineasDeAtencion: true,
      };

    case 'charla':
    case 'ofensivo':
      return {
        intencion: resultado.intencion,
        mensaje: resultado.mensaje,
        recursos: [],
        senalDeRiesgo: false,
        incluyeLineasDeAtencion: false,
      };

    case 'fallback':
      // Sin lineas: sin una senal de riesgo no hay crisis. Con el catalogo de lo que si se atiende.
      return {
        intencion: resultado.intencion,
        mensaje: resultado.mensaje,
        recursos: [],
        senalDeRiesgo: false,
        incluyeLineasDeAtencion: false,
        sugerencias: resultado.sugerencias,
      };

    case 'ayuda':
      return {
        intencion: resultado.intencion,
        mensaje: resultado.mensaje,
        recursos: resultado.lineas,
        senalDeRiesgo: false,
        incluyeLineasDeAtencion: resultado.lineas.some((linea) => linea.tipo === 'contacto'),
      };
  }
}

/**
 * @param reglas Lo que el servidor publico para responder sin conexion, o `null` si no hay
 *   nada guardado (nunca se abrio con conexion): entonces sin conexion no se responde.
 * @param nombreDeLaMascota Para que "hola, Luma" se lea como un saludo.
 */
export function useConversacion(reglas: ReglasLocales | null, nombreDeLaMascota: string) {
  const [mensajes, setMensajes] = useState<readonly Mensaje[]>([]);
  const [esperando, setEsperando] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const siguienteId = useRef(0);
  const enCurso = useRef<AbortController | null>(null);
  /** Cuantos insultos seguidos lleva esta ventana. Una referencia: no pinta nada por si sola. */
  const ofensasSeguidas = useRef(0);
  /** Lo mismo que `cerrada`, para leerlo dentro de `enviar` sin esperar a un nuevo pintado. */
  const cerradaAhora = useRef(false);
  const umbral = reglas?.ofensivo?.umbral ?? UMBRAL_POR_OMISION;
  const textoDelCierre = reglas?.ofensivo?.mensajeAlCerrar ?? CIERRE_POR_OMISION;

  // Al cerrar el asistente no se espera ninguna respuesta.
  useEffect(() => () => enCurso.current?.abort(), []);

  const anadir = useCallback((mensaje: SinNumero<Mensaje>) => {
    const id = siguienteId.current;

    siguienteId.current += 1;
    setMensajes((antes) => [...antes, { ...mensaje, id }]);
  }, []);

  /**
   * Anota lo que respondio el asistente y lleva la cuenta de los insultos seguidos (SCRUM-192).
   * A la `umbral`-esima seguida, cierra la conversacion con su aviso.
   */
  const anotarRespuesta = useCallback(
    (respuesta: RespuestaDelAsistente, sinConexion: boolean) => {
      anadir({ de: 'asistente', respuesta, sinConexion });

      if (respuesta.intencion !== INTENCION_OFENSIVA) {
        ofensasSeguidas.current = 0;

        return;
      }

      ofensasSeguidas.current += 1;

      if (ofensasSeguidas.current >= umbral) {
        cerradaAhora.current = true;
        setCerrada(true);
        anadir({ de: 'cierre', texto: textoDelCierre });
      }
    },
    [anadir, umbral, textoDelCierre],
  );

  /**
   * Responde con lo que hay en este dispositivo. Devuelve cierto si respondio algo, y falso
   * si no habia reglas o la pregunta exige conexion: quien llama dice entonces lo que toca.
   */
  const responderEnElDispositivo = useCallback(
    (pregunta: string): boolean => {
      if (reglas === null) {
        return false;
      }

      const resultado = responderSinConexion(reglas, {
        texto: pregunta,
        zona: zonaActual(),
        mascota: nombreDeLaMascota,
      });

      if (resultado.tipo === 'exige-conexion') {
        return false;
      }

      anotarRespuesta(comoRespuesta(resultado), true);

      return true;
    },
    [reglas, anotarRespuesta, nombreDeLaMascota],
  );

  /** No se pudo responder sin conexion: lo que se dice depende de si habia con que. */
  const decirQueExigeConexion = useCallback(
    (pregunta: string) => {
      anadir({
        de: 'fallo',
        // Con reglas, se sabe que esto exige conexion; sin ellas, solo que no hay.
        motivo: reglas === null ? 'sin-conexion' : 'exige-conexion',
        pregunta,
      });
    },
    [reglas, anadir],
  );

  const enviar = useCallback(
    async (texto: string, { reintento = false }: { reintento?: boolean } = {}) => {
      const pregunta = texto.trim();

      // Cerrada, no se acepta nada mas en esta ventana: hay que abrir otra.
      if (pregunta === '' || enCurso.current !== null || cerradaAhora.current) {
        return;
      }

      if (!reintento) {
        anadir({ de: 'persona', texto: pregunta });
      }

      // Sin conexion no se intenta: se responde lo basico, o se dice que hace falta.
      if (!navigator.onLine) {
        if (!responderEnElDispositivo(pregunta)) {
          decirQueExigeConexion(pregunta);
        }

        return;
      }

      const control = new AbortController();
      let porTiempo = false;
      const temporizador = setTimeout(() => {
        porTiempo = true;
        control.abort();
      }, ESPERA_MAXIMA_MS);

      enCurso.current = control;
      setEsperando(true);

      try {
        const respuesta = await preguntarAlAsistente(pregunta, control.signal);

        anotarRespuesta(respuesta, false);
      } catch (error) {
        // Abortado por cerrar el asistente: ya no hay a quien contestar.
        if (control.signal.aborted && !porTiempo) {
          return;
        }

        const motivo = motivoDe(error, porTiempo);

        // La peticion no llego (no hay red, o tardo demasiado): se prueba lo basico antes
        // de rendirse. Una respuesta del servidor, aunque sea un error, se respeta tal cual.
        if (motivo === 'sin-conexion' || motivo === 'tarda') {
          if (responderEnElDispositivo(pregunta)) {
            return;
          }

          if (motivo === 'sin-conexion') {
            decirQueExigeConexion(pregunta);

            return;
          }
        }

        anadir({ de: 'fallo', motivo, pregunta });
      } finally {
        clearTimeout(temporizador);
        enCurso.current = null;
        setEsperando(false);
      }
    },
    [anadir, anotarRespuesta, responderEnElDispositivo, decirQueExigeConexion],
  );

  /** Abre otra conversacion: sin nada de la anterior y sin ningun bloqueo (SCRUM-192). */
  const empezarDeNuevo = useCallback(() => {
    enCurso.current?.abort();
    ofensasSeguidas.current = 0;
    cerradaAhora.current = false;
    setCerrada(false);
    setMensajes([]);
  }, []);

  return { mensajes, esperando, cerrada, enviar, empezarDeNuevo };
}
