import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAlVolverLaRed } from '../../conexion/useAlVolverLaRed.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { clasificarFallo } from '../../sincronizacion/clasificarFallo.ts';
import type { Operacion } from '../../sincronizacion/cola.ts';
import {
  cuantosResultadosSinEnviar,
  guardarElPanel,
  leerElPanelConCopia,
  leerLosResultadosDeLaCola,
  type DatosDelPanel,
} from '../../sincronizacion/panelLocal.ts';
import { suscribirAlProgreso } from '../../sincronizacion/progreso.ts';
import { diaEnLaZona } from '../../tiempo/zonaHoraria.ts';
import { conLoQueEstaEnLaCola } from './conLoQueEstaEnLaCola.ts';
import { explicar } from './explicar.ts';

/**
 * Lo que leen en comun el panel y el sendero (SCRUM-140): la cuenta y el progreso, con copia
 * en este equipo.
 *
 * Se leen juntos y se guardan juntos (ver `panelLocal.ts`). Sin conexion se ve la copia, y la
 * pantalla dice de cuando es (`deLaCopia`) y cuanto de lo hecho sin conexion sigue sin
 * enviarse (`sinEnviar`). Encima de la copia solo se pone una cosa: que lo que la persona hizo
 * hoy esta hecho. En cuanto vuelve la red, se vuelve a leer.
 */
export type LecturaDelPanel =
  | { readonly fase: 'cargando' }
  | { readonly fase: 'error'; readonly mensaje: string }
  | {
      readonly fase: 'listo';
      readonly cuenta: Cuenta;
      readonly progreso: readonly ProgresoDelModulo[];
      /** Cuando se guardo la copia que se esta ensenando, o `null` si es lo del servidor. */
      readonly deLaCopia: string | null;
      /** Cuantos resultados hechos sin conexion siguen sin enviarse. */
      readonly sinEnviar: number;
      /** El instante de la ultima lectura de lo guardado en este equipo. */
      readonly ahora: Date;
    };

export const SIN_COPIA_DEL_PANEL =
  'Todavía no hay una copia de tu panel en este equipo. Conéctate una vez para guardarla y podrás verlo sin conexión.';

/** Lo que se le dice a la persona cuando no se pudo leer: sin red y sin copia, que hace falta una vez. */
function explicarLaLectura(error: unknown): string {
  return clasificarFallo(error).clase === 'red' ? SIN_COPIA_DEL_PANEL : explicar(error);
}

export function useLecturaDelPanel(): {
  readonly estado: LecturaDelPanel;
  readonly reintentar: () => void;
  /** Lo que la persona cambio y el servidor confirmo: se muestra y se deja guardado. */
  readonly actualizar: (datos: DatosDelPanel) => void;
} {
  const [fase, setFase] = useState<'cargando' | 'listo' | { readonly error: string }>('cargando');
  const [datos, setDatos] = useState<DatosDelPanel | null>(null);
  const [deLaCopia, setDeLaCopia] = useState<string | null>(null);
  const [resultados, setResultados] = useState<readonly Operacion[]>([]);
  const [ahora, setAhora] = useState(() => new Date());
  const [intento, setIntento] = useState(0);

  const lecturaMasReciente = useRef(0);

  /** Vuelve a leer lo que la persona hizo y esta en la cola. */
  const releerLaCola = useCallback(async () => {
    lecturaMasReciente.current += 1;

    const esta = lecturaMasReciente.current;
    const leidos = await leerLosResultadosDeLaCola();

    // Si mientras se leia llego otro aviso, esta lectura ya es vieja.
    if (esta === lecturaMasReciente.current) {
      setResultados(leidos);
      setAhora(new Date());
    }
  }, []);

  useEffect(
    () =>
      suscribirAlProgreso(() => {
        void releerLaCola();
      }),
    [releerLaCola],
  );

  useEffect(() => {
    const control = new AbortController();
    const { signal: senal } = control;

    async function cargar(): Promise<void> {
      try {
        // El alta de cuenta va aqui y no en el inicio de sesion a proposito (ver
        // `useDatosDelPanel`): ocurre tambien cuando la sesion se restaura al recargar.
        const lectura = await leerElPanelConCopia({ senal, darDeAlta: true });

        if (senal.aborted) {
          return;
        }

        setDatos(lectura.valor);
        setDeLaCopia(lectura.deLaCopia ? lectura.guardadoEn : null);

        await releerLaCola();

        if (!senal.aborted) {
          setFase('listo');
        }
      } catch (error) {
        // Abortar es lo que pasa al desmontar, y no es un fallo que contar.
        if (!senal.aborted) {
          setFase({ error: explicarLaLectura(error) });
        }
      }
    }

    void cargar();

    return () => {
      control.abort();
    };
  }, [intento, releerLaCola]);

  const reintentar = useCallback(() => {
    setFase('cargando');
    setIntento((antes) => antes + 1);
  }, []);

  // Si lo que se ve es la copia, en cuanto vuelve la conexion se pregunta de nuevo.
  const preguntarDeNuevo = useCallback(() => {
    setIntento((antes) => antes + 1);
  }, []);

  useAlVolverLaRed(deLaCopia !== null, preguntarDeNuevo);

  const actualizar = useCallback((nuevos: DatosDelPanel) => {
    setDatos(nuevos);
    setDeLaCopia(null);
    void guardarElPanel(nuevos);
  }, []);

  const progreso = useMemo(
    () =>
      datos === null
        ? []
        : conLoQueEstaEnLaCola(datos.progreso, resultados, diaEnLaZona(ahora), deLaCopia),
    [datos, resultados, ahora, deLaCopia],
  );

  const estado = useMemo((): LecturaDelPanel => {
    if (typeof fase === 'object') {
      return { fase: 'error', mensaje: fase.error };
    }

    if (fase === 'cargando' || datos === null) {
      return { fase: 'cargando' };
    }

    return {
      fase: 'listo',
      cuenta: datos.cuenta,
      progreso,
      deLaCopia,
      sinEnviar: cuantosResultadosSinEnviar(resultados),
      ahora,
    };
  }, [fase, datos, progreso, deLaCopia, resultados, ahora]);

  return { estado, reintentar, actualizar };
}
