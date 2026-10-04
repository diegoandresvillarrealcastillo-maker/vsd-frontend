import { useCallback, useEffect, useRef, useState } from 'react';

import {
  preguntarAlAsistente,
  type RespuestaDelAsistente,
} from '../infraestructura/api/asistente.ts';
import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';

/**
 * La conversacion con VSD IA (SCRUM-100).
 *
 * Vive solo en memoria y solo mientras el asistente esta abierto: al cerrarlo
 * se olvida. Nada de lo escrito va al almacenamiento del navegador, y el
 * servidor tampoco lo guarda.
 *
 * Nunca se queda cargando: sin conexion lo dice al momento, y si el servidor
 * tarda mas de la cuenta se deja de esperar y tambien se dice.
 */

export type MotivoDelFallo = 'sin-conexion' | 'tarda' | 'muchas' | 'otro';

export type Mensaje =
  | { readonly id: number; readonly de: 'persona'; readonly texto: string }
  | { readonly id: number; readonly de: 'asistente'; readonly respuesta: RespuestaDelAsistente }
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

export function useConversacion() {
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

  const enviar = useCallback(
    async (texto: string, { reintento = false }: { reintento?: boolean } = {}) => {
      const pregunta = texto.trim();

      if (pregunta === '' || enCurso.current !== null) {
        return;
      }

      if (!reintento) {
        anadir({ de: 'persona', texto: pregunta });
      }

      // Sin conexion no se intenta: se dice al momento.
      if (!navigator.onLine) {
        anadir({ de: 'fallo', motivo: 'sin-conexion', pregunta });
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

        anadir({ de: 'asistente', respuesta });
      } catch (error) {
        // Abortado por cerrar el asistente: ya no hay a quien contestar.
        if (control.signal.aborted && !porTiempo) {
          return;
        }

        anadir({ de: 'fallo', motivo: motivoDe(error, porTiempo), pregunta });
      } finally {
        clearTimeout(temporizador);
        enCurso.current = null;
        setEsperando(false);
      }
    },
    [anadir],
  );

  return { mensajes, esperando, enviar };
}
