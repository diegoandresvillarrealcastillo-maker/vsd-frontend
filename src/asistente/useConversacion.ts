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
 */

export type MotivoDelFallo = 'sin-conexion' | 'exige-conexion' | 'tarda' | 'muchas' | 'otro';

export type Mensaje =
  | { readonly id: number; readonly de: 'persona'; readonly texto: string }
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
      return {
        intencion: resultado.intencion,
        mensaje: resultado.mensaje,
        recursos: [],
        senalDeRiesgo: false,
        incluyeLineasDeAtencion: false,
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
  const siguienteId = useRef(0);
  const enCurso = useRef<AbortController | null>(null);

  // Al cerrar el asistente no se espera ninguna respuesta.
  useEffect(() => () => enCurso.current?.abort(), []);

  const anadir = useCallback((mensaje: SinNumero<Mensaje>) => {
    const id = siguienteId.current;

    siguienteId.current += 1;
    setMensajes((antes) => [...antes, { ...mensaje, id }]);
  }, []);

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

      anadir({ de: 'asistente', respuesta: comoRespuesta(resultado), sinConexion: true });

      return true;
    },
    [reglas, anadir, nombreDeLaMascota],
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

      if (pregunta === '' || enCurso.current !== null) {
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

        anadir({ de: 'asistente', respuesta, sinConexion: false });
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
    [anadir, responderEnElDispositivo, decirQueExigeConexion],
  );

  return { mensajes, esperando, enviar };
}
