import { useCallback, useEffect, useState } from 'react';

import { consultarLaVersionDelAviso } from '../../infraestructura/api/aviso.ts';
import { darDeAltaLaCuenta, type Mascota, type Modulo } from '../../infraestructura/api/cuenta.ts';
import { consultarElProgreso, type ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { explicar } from '../panel/useDatosDelPanel.ts';

export type EstadoDelSendero =
  | { readonly fase: 'cargando' }
  | {
      readonly fase: 'listo';
      readonly progreso: ProgresoDelModulo;
      readonly mascota: Mascota | null;
    }
  /** El modulo existe pero la persona no lo tiene activo. */
  | { readonly fase: 'inactivo'; readonly mascota: Mascota | null }
  | { readonly fase: 'error'; readonly mensaje: string };

/**
 * El progreso de un solo modulo.
 *
 * Se pide al montar la pantalla, asi que al volver de una actividad el anillo
 * de hoy ya trae lo que se acaba de hacer, sin recargar. Va precedido del alta
 * por lo mismo que el perfil: alguien puede abrir esta direccion directamente.
 */
export function useSendero(modulo: Modulo): {
  readonly estado: EstadoDelSendero;
  readonly reintentar: () => void;
} {
  const [estado, setEstado] = useState<EstadoDelSendero>({ fase: 'cargando' });
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
        const { mascota } = await darDeAltaLaCuenta(version, control.signal);
        const progreso = await consultarElProgreso(control.signal);

        if (control.signal.aborted) {
          return;
        }

        const suyo = progreso.find((uno) => uno.modulo === modulo);

        setEstado(
          suyo === undefined
            ? { fase: 'inactivo', mascota }
            : { fase: 'listo', progreso: suyo, mascota },
        );
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
  }, [modulo, intento]);

  return { estado, reintentar };
}
