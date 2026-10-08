import { useCallback, useEffect, useState } from 'react';

import { useAlVolverLaRed } from '../../conexion/useAlVolverLaRed.ts';
import { consultarLaVersionDelAviso } from '../../infraestructura/api/aviso.ts';
import {
  cambiarPreferencias,
  darDeAltaLaCuenta,
  type CambiosDePreferencias,
  type Cuenta,
} from '../../infraestructura/api/cuenta.ts';
import { clasificarFallo } from '../../sincronizacion/clasificarFallo.ts';
import { leerLaCuentaGuardada } from '../../sincronizacion/panelLocal.ts';
import { explicar } from '../panel/useDatosDelPanel.ts';

export type EstadoDelPerfil =
  | { readonly fase: 'cargando' }
  | {
      readonly fase: 'listo';
      readonly cuenta: Cuenta;
      /** Cuando se guardo la copia que se esta ensenando, o `null` si es lo que dijo la API. */
      readonly deLaCopia: string | null;
      /** El instante en que se leyo, para decir de cuando son los datos. */
      readonly ahora: Date;
      /**
       * Cual lectura de la cuenta trajo esto. Cambia cuando llega algo leido de nuevo, y no al
       * guardar un cambio: sirve para que los apartados que parten del valor de la cuenta
       * empiecen de nuevo cuando llega lo del servidor tras ver la copia, sin perder lo que
       * dicen despues de guardar.
       */
      readonly lectura: number;
    }
  | { readonly fase: 'error'; readonly mensaje: string };

/** La cuenta que llego de la API por un cambio, sin que cuente como una lectura nueva. */
function conLaCuenta(cuenta: Cuenta): (anterior: EstadoDelPerfil) => EstadoDelPerfil {
  return (anterior) => ({
    fase: 'listo',
    cuenta,
    deLaCopia: null,
    ahora: new Date(),
    lectura: anterior.fase === 'listo' ? anterior.lectura : 0,
  });
}

/**
 * Trae la cuenta propia y deja cambiar sus preferencias.
 *
 * Se carga con el alta, igual que el panel, y no con una consulta suelta: si
 * alguien abre `/perfil` directamente justo despues de registrarse, su cuenta
 * todavia no existe en nuestra API, y el alta es idempotente.
 *
 * **Sin conexion se ve la copia de la cuenta que guardo el panel** (SCRUM-142), diciendo de
 * cuando es. No se puede cambiar nada: cada apartado exige conexion y lo dice. Solo se acude
 * a la copia cuando no se pudo llegar a la API (sin red, o un servidor que no responde bien);
 * una respuesta del servidor, aunque sea un error, se cuenta como lo que es. Al volver la
 * conexion se vuelve a preguntar.
 */
export function usePerfil(): {
  readonly estado: EstadoDelPerfil;
  readonly reintentar: () => void;
  readonly guardar: (cambios: CambiosDePreferencias) => Promise<void>;
  /**
   * Pinta una cuenta que ya llego de la API por otro camino —la de la foto
   * (SCRUM-120), que no pasa por las preferencias—. No llama a nada.
   */
  readonly reemplazarCuenta: (cuenta: Cuenta) => void;
} {
  const [estado, setEstado] = useState<EstadoDelPerfil>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => {
    setEstado({ fase: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, []);

  useEffect(() => {
    const control = new AbortController();

    async function cargar(): Promise<void> {
      try {
        const version = await consultarLaVersionDelAviso(control.signal);
        const cuenta = await darDeAltaLaCuenta(version, control.signal);

        if (!control.signal.aborted) {
          setEstado({
            fase: 'listo',
            cuenta,
            deLaCopia: null,
            ahora: new Date(),
            lectura: intento,
          });
        }
      } catch (error) {
        if (control.signal.aborted) {
          return;
        }

        // No se pudo llegar a la API (sin red, o un servidor que no responde bien, como Render
        // despertando): lo ultimo que se supo de la cuenta, si se supo algo. Igual que
        // `leerConCopia`; una respuesta de verdad, aunque sea un error, se respeta.
        const clase = clasificarFallo(error).clase;
        const guardada =
          clase === 'red' || clase === 'temporal' ? await leerLaCuentaGuardada() : null;

        if (control.signal.aborted) {
          return;
        }

        setEstado(
          guardada === null
            ? { fase: 'error', mensaje: explicar(error) }
            : {
                fase: 'listo',
                cuenta: guardada.cuenta,
                deLaCopia: guardada.guardadoEn,
                ahora: new Date(),
                lectura: intento,
              },
        );
      }
    }

    void cargar();

    return () => {
      control.abort();
    };
  }, [intento]);

  /** Guarda y pinta la cuenta como la devolvio la API. Si falla, lanza. */
  const guardar = useCallback(async (cambios: CambiosDePreferencias): Promise<void> => {
    const cuenta = await cambiarPreferencias(cambios);

    setEstado(conLaCuenta(cuenta));
  }, []);

  const reemplazarCuenta = useCallback((cuenta: Cuenta): void => {
    setEstado(conLaCuenta(cuenta));
  }, []);

  // Si lo que se ve es la copia, en cuanto vuelve la conexion se pregunta de nuevo (sin pasar
  // por "cargando": la copia sigue a la vista hasta que llegue lo nuevo).
  const preguntarDeNuevo = useCallback(() => {
    setIntento((anterior) => anterior + 1);
  }, []);

  useAlVolverLaRed(estado.fase === 'listo' && estado.deLaCopia !== null, preguntarDeNuevo);

  return { estado, reintentar, guardar, reemplazarCuenta };
}
