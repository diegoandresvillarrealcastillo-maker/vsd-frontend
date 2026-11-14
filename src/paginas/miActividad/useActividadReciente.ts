import { useCallback, useEffect, useState } from 'react';

import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { consultarElHistorial } from '../../infraestructura/api/historial.ts';
import { clasificarFallo } from '../../sincronizacion/clasificarFallo.ts';
import { explicar } from '../panel/explicar.ts';
import type { HechoConModulo } from './resumenDeActividad.ts';

/**
 * Cuantos hechos se piden por modulo: el maximo que acepta el servidor. Con eso alcanza para contar
 * una semana y para las ultimas cinco.
 *
 * shortcut: una semana con mas de 50 actividades en un solo modulo se cuenta en 50, subir a pedir la
 * pagina siguiente si algun dia se necesita.
 */
const HECHOS_POR_MODULO = 50;

export type ActividadReciente =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'listo'; readonly hechos: readonly HechoConModulo[] }
  | { readonly fase: 'error'; readonly mensaje: string };

/** Sin conexion no hay historial que ensenar (no se guarda en este equipo): se dice sin alarma. */
function explicarElFallo(error: unknown): string {
  return clasificarFallo(error).clase === 'red'
    ? 'Para ver tus últimas actividades hace falta conexión. Lo demás de esta pantalla sigue aquí.'
    : explicar(error);
}

/**
 * Lo ultimo que la persona hizo, de todos sus modulos activos (SCRUM-296).
 *
 * Usa el historial que arma el servidor (SCRUM-184): una peticion por modulo, y aqui solo se juntan. Si
 * una falla, la pantalla dice que no pudo traerlo y deja reintentar; no se ensena a medias, porque un
 * resumen que omite un modulo diria algo que no es cierto. Al salir de la pantalla se cancela lo que
 * este en vuelo.
 */
export function useActividadReciente(modulos: readonly Modulo[]): {
  readonly estado: ActividadReciente;
  readonly reintentar: () => void;
} {
  const [estado, setEstado] = useState<ActividadReciente>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);
  // Una clave y no la lista: el panel entrega una lista nueva cada vez que relee, y no hay por que pedir de nuevo.
  const clave = modulos.join(',');

  useEffect(() => {
    const control = new AbortController();
    const activos = clave === '' ? [] : (clave.split(',') as Modulo[]);

    Promise.all(
      activos.map(async (modulo) => {
        const pagina = await consultarElHistorial(modulo, {
          limite: HECHOS_POR_MODULO,
          senal: control.signal,
        });

        return pagina.hechos.map((hecho): HechoConModulo => ({ ...hecho, modulo }));
      }),
    )
      .then((listas) => {
        if (!control.signal.aborted) {
          setEstado({ fase: 'listo', hechos: listas.flat() });
        }
      })
      .catch((error: unknown) => {
        if (!control.signal.aborted) {
          setEstado({ fase: 'error', mensaje: explicarElFallo(error) });
        }
      });

    return () => {
      control.abort();
    };
  }, [clave, intento]);

  const reintentar = useCallback(() => {
    setEstado({ fase: 'cargando' });
    setIntento((antes) => antes + 1);
  }, []);

  return { estado, reintentar };
}
