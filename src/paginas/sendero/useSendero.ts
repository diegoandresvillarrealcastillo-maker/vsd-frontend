import { useMemo } from 'react';

import type { Mascota, Modulo } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { useLecturaDelPanel } from '../panel/useLecturaDelPanel.ts';

export type EstadoDelSendero =
  | { readonly fase: 'cargando' }
  | {
      readonly fase: 'listo';
      readonly progreso: ProgresoDelModulo;
      readonly mascota: Mascota | null;
      /** Cuando se guardo la copia que se esta ensenando, o `null` si es lo del servidor. */
      readonly deLaCopia: string | null;
      /** Cuantos resultados hechos sin conexion siguen sin enviarse. */
      readonly sinEnviar: number;
      readonly ahora: Date;
    }
  /** El modulo existe pero la persona no lo tiene activo. */
  | { readonly fase: 'inactivo'; readonly mascota: Mascota | null }
  | { readonly fase: 'error'; readonly mensaje: string };

/**
 * El progreso de un solo modulo.
 *
 * Se pide al montar la pantalla, asi que al volver de una actividad el anillo de hoy ya trae lo
 * que se acaba de hacer, sin recargar. Va precedido del alta por lo mismo que el perfil: alguien
 * puede abrir esta direccion directamente. Lo lee, igual que el panel, con copia en este equipo
 * (SCRUM-140): sin conexion se ve la copia, y lo que se hizo hoy esta hecho.
 */
export function useSendero(modulo: Modulo): {
  readonly estado: EstadoDelSendero;
  readonly reintentar: () => void;
} {
  const { estado: lectura, reintentar } = useLecturaDelPanel();

  const estado = useMemo((): EstadoDelSendero => {
    if (lectura.fase !== 'listo') {
      return lectura;
    }

    const { mascota } = lectura.cuenta;
    const suyo = lectura.progreso.find((uno) => uno.modulo === modulo);

    return suyo === undefined
      ? { fase: 'inactivo', mascota }
      : {
          fase: 'listo',
          progreso: suyo,
          mascota,
          deLaCopia: lectura.deLaCopia,
          sinEnviar: lectura.sinEnviar,
          ahora: lectura.ahora,
        };
  }, [lectura, modulo]);

  return { estado, reintentar };
}
