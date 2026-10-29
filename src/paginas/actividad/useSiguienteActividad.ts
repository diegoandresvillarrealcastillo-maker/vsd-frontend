import { useEffect, useState } from 'react';

import { leerElPanelConCopia, leerLosResultadosDeLaCola } from '../../sincronizacion/panelLocal.ts';
import { diaEnLaZona } from '../../tiempo/zonaHoraria.ts';
import { conLoQueEstaEnLaCola } from '../panel/conLoQueEstaEnLaCola.ts';
import { siguienteActividad, type SiguienteActividad } from './siguienteActividad.ts';

/**
 * La siguiente actividad de hoy, para ofrecerla al terminar una (SCRUM-295).
 *
 * Se lee **al terminar** y no antes: el progreso tiene que incluir lo que acaba de hacerse. Con
 * conexion es lo que dice el servidor; sin ella, la copia de este equipo con lo hecho hoy que esta
 * en la cola, igual que el panel (`conLoQueEstaEnLaCola`).
 *
 * Nunca rompe la pantalla: si no se puede leer, no hay siguiente y queda solo «Volver al panel».
 * Lo leido va con la actividad a la que pertenece, para no ensenar la de otra mientras llega.
 */
export function useSiguienteActividad(
  idActual: string | undefined,
  terminada: boolean,
): SiguienteActividad | undefined {
  const [lectura, setLectura] = useState<{
    readonly para: string;
    readonly siguiente: SiguienteActividad | undefined;
  } | null>(null);

  useEffect(() => {
    if (!terminada || idActual === undefined) {
      return;
    }

    const control = new AbortController();

    async function leer(id: string): Promise<void> {
      try {
        const [panel, cola] = await Promise.all([
          leerElPanelConCopia({ senal: control.signal }),
          leerLosResultadosDeLaCola(),
        ]);

        if (control.signal.aborted) {
          return;
        }

        const progreso = conLoQueEstaEnLaCola(
          panel.valor.progreso,
          cola,
          diaEnLaZona(new Date()),
          panel.deLaCopia ? panel.guardadoEn : null,
        );

        setLectura({ para: id, siguiente: siguienteActividad(progreso, id) });
      } catch {
        // Sin lectura no hay boton: la persona siempre puede volver al panel.
      }
    }

    void leer(idActual);

    return () => {
      control.abort();
    };
  }, [idActual, terminada]);

  return lectura?.para === idActual ? lectura?.siguiente : undefined;
}
