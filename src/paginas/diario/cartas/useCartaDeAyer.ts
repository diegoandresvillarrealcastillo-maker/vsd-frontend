import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorDeLaApi } from '../../../infraestructura/api/clienteHttp.ts';
import {
  abrirCarta,
  type Anotacion,
  type CartaEnEspera,
} from '../../../infraestructura/api/diario.ts';
import { encolar } from '../../../sincronizacion/ciclo.ts';
import {
  leerLasCartasEnEspera,
  quitarLaCartaDeLaCopia,
} from '../../../sincronizacion/cartasLocal.ts';
import { clasificarFallo } from '../../../sincronizacion/clasificarFallo.ts';
import { recordarLaCartaAbierta } from '../../../sincronizacion/diarioLocal.ts';
import { seguirUnaOperacion } from '../../../sincronizacion/seguimiento.ts';

/**
 * Lo que la tarjeta «Ayer te dejaste esto» le muestra a la persona (SCRUM-230).
 *
 * - **oculta**: no hay ninguna carta esperando, o todavia no se sabe. No se pinta nada: ni un hueco ni una
 *   carta inventada.
 * - **oferta**: hay una carta y la persona decide. `aviso` dice, sin alarmar, por que algo no salio.
 * - **leida**: se abrio, y aqui esta su texto.
 * - **borrada**: se mando borrar sin leerla.
 */
export type EstadoDeLaCarta =
  | { readonly tipo: 'oculta' }
  | {
      readonly tipo: 'oferta';
      readonly carta: CartaEnEspera;
      readonly leyendo: boolean;
      readonly aviso: string | null;
    }
  | { readonly tipo: 'leida'; readonly carta: CartaEnEspera; readonly anotacion: Anotacion }
  | { readonly tipo: 'borrada' };

type Fase =
  | { readonly tipo: 'oferta'; readonly leyendo: boolean; readonly aviso: string | null }
  | { readonly tipo: 'leida'; readonly anotacion: Anotacion }
  | { readonly tipo: 'borrada' };

const OFERTA: Fase = { tipo: 'oferta', leyendo: false, aviso: null };

export const SIN_CONEXION_PARA_LEERLA =
  'Para leerla hace falta conexión. Si prefieres, puedes borrarla sin leerla: el borrado queda guardado aquí y sale cuando vuelva la red.';
export const TODAVIA_NO_SE_PUEDE_LEER =
  'Todavía no: esta carta se puede leer desde mañana. Si prefieres, puedes borrarla.';
export const NO_SE_PUDO_ABRIR = 'No se pudo abrir ahora. Inténtalo de nuevo en un momento.';
export const NO_SE_PUDO_BORRAR = 'No pudimos borrarla en este momento. Inténtalo de nuevo.';

/** Por que no se pudo abrir, dicho sin repetir nada de lo que contiene. */
function explicarElFallo(error: unknown): { readonly aviso: string; readonly yaNoEsta: boolean } {
  if (error instanceof ErrorDeLaApi) {
    if (error.codigo === 'CARTA_PARA_MANANA') {
      return { aviso: TODAVIA_NO_SE_PUEDE_LEER, yaNoEsta: false };
    }

    // Se borro desde otro dispositivo, o ya no es una carta: no hay nada que ofrecer.
    if (error.estado === 404) {
      return { aviso: '', yaNoEsta: true };
    }
  }

  return {
    aviso: clasificarFallo(error).clase === 'red' ? SIN_CONEXION_PARA_LEERLA : NO_SE_PUDO_ABRIR,
    yaNoEsta: false,
  };
}

/**
 * La carta que la persona se dejo ayer, si hay una (SCRUM-230, EMO-05).
 *
 * Se ofrece **una a la vez**, la mas reciente. Lo que se sabe sale del servidor y, sin conexion, de la copia
 * de este equipo, para que la tarjeta aparezca y se pueda borrar sin leer tambien sin red. **Leerla si hace
 * falta conexion**, porque el texto no se guarda aqui hasta que la persona lo pide.
 *
 * **Nunca se avisa por notificacion**: la pantalla bloqueada la puede ver otra persona. La carta solo se
 * ofrece aqui, cuando la persona abre la aplicacion.
 */
export function useCartaDeAyer(): {
  readonly estado: EstadoDeLaCarta;
  readonly leer: () => void;
  readonly borrar: () => Promise<void>;
  /** Cierra la carta ya leida o el aviso del borrado, y ofrece la siguiente si la hay. */
  readonly cerrar: () => void;
} {
  const [cartas, setCartas] = useState<readonly CartaEnEspera[]>([]);
  const [fase, setFase] = useState<Fase>(OFERTA);
  /** Cancela lo que se espera de lo guardado cuando la pantalla se cierra. */
  const seguimientos = useRef<AbortController>(new AbortController());

  useEffect(() => {
    const control = new AbortController();

    seguimientos.current = control;

    leerLasCartasEnEspera(control.signal)
      .then((lectura) => {
        if (!control.signal.aborted) {
          setCartas(lectura.valor);
        }
      })
      .catch(() => {
        // Sin conexion y sin copia, o sin cuenta todavia: no hay nada que ofrecer, y no es un error que
        // la persona deba ver.
      });

    return () => {
      control.abort();
    };
  }, []);

  const carta = cartas[0];

  const leer = useCallback(() => {
    if (carta === undefined) {
      return;
    }

    setFase({ tipo: 'oferta', leyendo: true, aviso: null });

    void abrirCarta(carta.id, seguimientos.current.signal)
      .then(async (anotacion) => {
        // Deja de ser una carta que espera, y en la copia del diario ya no esta sellada.
        await Promise.all([quitarLaCartaDeLaCopia(carta.id), recordarLaCartaAbierta(anotacion)]);
        setFase({ tipo: 'leida', anotacion });
      })
      .catch((error: unknown) => {
        if (seguimientos.current.signal.aborted) {
          return;
        }

        const { aviso, yaNoEsta } = explicarElFallo(error);

        if (yaNoEsta) {
          void quitarLaCartaDeLaCopia(carta.id);
          setCartas((antes) => antes.filter((una) => una.id !== carta.id));
          setFase(OFERTA);

          return;
        }

        setFase({ tipo: 'oferta', leyendo: false, aviso });
      });
  }, [carta]);

  const borrar = useCallback(async (): Promise<void> => {
    if (carta === undefined) {
      return;
    }

    const operationId = globalThis.crypto.randomUUID();

    try {
      await encolar({
        operationId,
        tipo: 'diario.borrar',
        entidad: `diario:${carta.id}`,
        payload: { id: carta.id },
      });
    } catch {
      setFase({ tipo: 'oferta', leyendo: false, aviso: NO_SE_PUDO_BORRAR });

      return;
    }

    // Ya esta guardado el borrado en este equipo: la carta no se vuelve a ofrecer, haya o no conexion.
    await quitarLaCartaDeLaCopia(carta.id);
    setCartas((antes) => antes.filter((una) => una.id !== carta.id));
    setFase({ tipo: 'borrada' });
    // Pide enviarlo ya; si no sale, el motor lo manda cuando pueda. No se espera a que salga.
    void seguirUnaOperacion(operationId, {
      sincronizarYa: true,
      senal: seguimientos.current.signal,
    });
  }, [carta]);

  const cerrar = useCallback(() => {
    // La leida sigue en el diario; la borrada ya salio de la lista. Lo que se quita es la tarjeta.
    setCartas((antes) => (fase.tipo === 'leida' ? antes.slice(1) : antes));
    setFase(OFERTA);
  }, [fase.tipo]);

  if (fase.tipo === 'borrada') {
    return { estado: { tipo: 'borrada' }, leer, borrar, cerrar };
  }

  if (carta === undefined) {
    return { estado: { tipo: 'oculta' }, leer, borrar, cerrar };
  }

  if (fase.tipo === 'leida') {
    return { estado: { tipo: 'leida', carta, anotacion: fase.anotacion }, leer, borrar, cerrar };
  }

  return {
    estado: { tipo: 'oferta', carta, leyendo: fase.leyendo, aviso: fase.aviso },
    leer,
    borrar,
    cerrar,
  };
}
