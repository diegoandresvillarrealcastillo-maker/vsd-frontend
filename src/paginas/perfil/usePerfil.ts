import { useCallback, useEffect, useState } from 'react';

import { consultarLaVersionDelAviso } from '../../infraestructura/api/aviso.ts';
import {
  cambiarPreferencias,
  darDeAltaLaCuenta,
  type CambiosDePreferencias,
  type Cuenta,
} from '../../infraestructura/api/cuenta.ts';
import { explicar } from '../panel/useDatosDelPanel.ts';

export type EstadoDelPerfil =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'listo'; readonly cuenta: Cuenta }
  | { readonly fase: 'error'; readonly mensaje: string };

/**
 * Trae la cuenta propia y deja cambiar sus preferencias.
 *
 * Se carga con el alta, igual que el panel, y no con una consulta suelta: si
 * alguien abre `/perfil` directamente justo despues de registrarse, su cuenta
 * todavia no existe en nuestra API, y el alta es idempotente.
 */
export function usePerfil(): {
  readonly estado: EstadoDelPerfil;
  readonly reintentar: () => void;
  readonly guardar: (cambios: CambiosDePreferencias) => Promise<void>;
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
          setEstado({ fase: 'listo', cuenta });
        }
      } catch (error) {
        if (!control.signal.aborted) {
          setEstado({ fase: 'error', mensaje: explicar(error) });
        }
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

    setEstado({ fase: 'listo', cuenta });
  }, []);

  return { estado, reintentar, guardar };
}
