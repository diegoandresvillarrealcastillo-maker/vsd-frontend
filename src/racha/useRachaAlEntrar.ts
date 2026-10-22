import { useContext, useEffect } from 'react';

import { SesionContexto } from '../sesion/SesionContexto.ts';
import { refrescarLaRacha } from './refrescarLaRacha.ts';

/**
 * Pide la racha al entrar en una pantalla donde se va a poder celebrar (SCRUM-243).
 *
 * La celebracion compara «lo que se sabia» con «lo que dice ahora el servidor». Lo que se sabia puede
 * ser de hace horas: una PWA que se reanuda sin volver a montarse sigue recordando el dia de ayer como
 * «ya hecho hoy», y una actividad hecha en otro equipo tambien lo deja viejo. Sin esto, la primera
 * actividad del dia no celebraria, y la segunda si. Al entrar se pide, y asi lo recordado es de hace
 * unos minutos —los de la actividad—.
 *
 * No devuelve nada: lo que llega queda recordado (`refrescarLaRacha`) y la llama de la barra lo lee.
 * Si no hay sesion o no se puede pedir, no pasa nada: se queda lo que habia.
 */
export function useRachaAlEntrar(): void {
  const sesion = useContext(SesionContexto);
  const cuenta = sesion?.sesion?.user.id ?? null;

  useEffect(() => {
    if (cuenta === null) {
      return undefined;
    }

    const control = new AbortController();

    refrescarLaRacha(cuenta, control.signal).catch(() => {
      // Sin conexion o sin cuenta todavia: se queda lo que habia.
    });

    return () => {
      control.abort();
    };
  }, [cuenta]);
}
