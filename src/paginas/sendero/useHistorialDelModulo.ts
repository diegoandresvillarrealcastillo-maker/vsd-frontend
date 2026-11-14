import { useCallback, useEffect, useRef, useState } from 'react';

import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import {
  consultarElHistorial,
  type HechoDelHistorial,
} from '../../infraestructura/api/historial.ts';
import { clasificarFallo } from '../../sincronizacion/clasificarFallo.ts';
import { explicar } from '../panel/useDatosDelPanel.ts';

/** Cuantos hechos se piden por pagina. */
export const HECHOS_POR_PAGINA = 20;

export type FaseDelHistorial =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'listo' }
  | { readonly fase: 'error'; readonly mensaje: string };

/**
 * Lo que se le dice cuando no se pudo traer. Sin conexion no hay historial que ensenar
 * (no se guarda en este equipo), y se dice sin alarma y apuntando a lo que si esta: lo de hoy.
 */
function explicarElFallo(error: unknown): string {
  if (clasificarFallo(error).clase === 'red') {
    return 'Para ver tu historial hace falta conexión. Lo de hoy sigue aquí arriba, en tu sendero.';
  }

  return explicar(error);
}

/**
 * El historial de un modulo, por paginas que arma el servidor (SCRUM-184).
 *
 * - Se pide la primera al abrir la pantalla y se suma la siguiente con «Ver mas», con el
 *   cursor que dio la anterior. Nada se pide por adelantado.
 * - Un hecho que llega dos veces (por una pagina que se pidio de nuevo) no se repite.
 * - Si falla «Ver mas», **lo que ya se veia sigue ahi**: el error se dice aparte.
 * - Al salir de la pantalla se cancela lo que este en vuelo.
 * - **Es de un modulo**: quien lo usa lo monta con `key={modulo}`, asi que cambiar de modulo es
 *   empezar de cero y no hay estado de otro que limpiar a mano.
 */
export function useHistorialDelModulo(modulo: Modulo) {
  const [fase, setFase] = useState<FaseDelHistorial>({ fase: 'cargando' });
  const [hechos, setHechos] = useState<readonly HechoDelHistorial[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorAlCargarMas, setErrorAlCargarMas] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const control = useRef<AbortController | null>(null);

  useEffect(() => {
    const propio = new AbortController();

    control.current = propio;

    consultarElHistorial(modulo, { limite: HECHOS_POR_PAGINA, senal: propio.signal })
      .then((pagina) => {
        if (propio.signal.aborted) {
          return;
        }

        setHechos(pagina.hechos);
        setSiguiente(pagina.siguientePagina);
        setFase({ fase: 'listo' });
      })
      .catch((error: unknown) => {
        if (!propio.signal.aborted) {
          setFase({ fase: 'error', mensaje: explicarElFallo(error) });
        }
      });

    return () => {
      propio.abort();
    };
  }, [modulo, intento]);

  const verMas = useCallback(() => {
    const propio = control.current;

    if (siguiente === null || cargandoMas || propio === null) {
      return;
    }

    setCargandoMas(true);
    setErrorAlCargarMas(null);

    consultarElHistorial(modulo, {
      limite: HECHOS_POR_PAGINA,
      pagina: siguiente,
      senal: propio.signal,
    })
      .then((pagina) => {
        if (propio.signal.aborted) {
          return;
        }

        setHechos((antes) => {
          const vistos = new Set(antes.map((hecho) => hecho.id));

          return [...antes, ...pagina.hechos.filter((hecho) => !vistos.has(hecho.id))];
        });
        setSiguiente(pagina.siguientePagina);
      })
      .catch((error: unknown) => {
        if (!propio.signal.aborted) {
          setErrorAlCargarMas(explicarElFallo(error));
        }
      })
      .finally(() => {
        if (!propio.signal.aborted) {
          setCargandoMas(false);
        }
      });
  }, [modulo, siguiente, cargandoMas]);

  const reintentar = useCallback(() => {
    setFase({ fase: 'cargando' });
    setErrorAlCargarMas(null);
    setIntento((antes) => antes + 1);
  }, []);

  return {
    fase,
    hechos,
    hayMas: siguiente !== null,
    cargandoMas,
    errorAlCargarMas,
    verMas,
    reintentar,
  };
}
