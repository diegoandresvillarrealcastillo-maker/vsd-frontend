import { useCallback, useEffect, useRef } from 'react';

import {
  cambiarPreferencias,
  type CambiosDePreferencias,
  type Modulo,
} from '../../infraestructura/api/cuenta.ts';
import { consultarElProgreso } from '../../infraestructura/api/progreso.ts';
import { iniciarUnaOperacionDeLaSesion } from '../../sincronizacion/ciclo.ts';
import { useLecturaDelPanel, type LecturaDelPanel } from './useLecturaDelPanel.ts';

export { explicar } from './explicar.ts';

/**
 * En que punto esta la carga del panel.
 *
 * Se modela como tres casos excluyentes y no como tres banderas sueltas (`cargando`, `error`,
 * `datos`). Con banderas existen combinaciones que no significan nada —cargando y con error a la
 * vez— y tarde o temprano alguien pinta una de ellas. Cuando es la copia de este equipo, `listo`
 * lo dice (`deLaCopia`).
 */
export type EstadoDelPanel = LecturaDelPanel;

/**
 * Trae lo que el panel necesita: la cuenta y el progreso de cada modulo, con copia en este
 * equipo (SCRUM-140). Ver `useLecturaDelPanel`.
 *
 * El alta de cuenta va en esa lectura y no en el inicio de sesion a proposito. Supabase
 * autentica, pero la cuenta de VSD Health es una entidad propia que alguien tiene que crear, y
 * hacerlo al entrar al panel tiene dos ventajas: ocurre tambien cuando la sesion se restaura al
 * recargar la pagina, y ocurre una sola vez por pantalla en lugar de repartido entre tres
 * formularios.
 *
 * Que la llamada sea idempotente en el servidor es lo que lo hace seguro: entrar diez veces no
 * crea diez cuentas ni sobrescribe el consentimiento.
 *
 * El progreso va **despues** del alta, en serie y no en paralelo: es una ruta con cuenta, y la
 * primera vez que alguien entra esa cuenta todavia no existe hasta que el alta termina.
 *
 * Cambiar la cuenta (activar un modulo, la bienvenida) **si necesita conexion**: lo que
 * responde el servidor se muestra y se deja guardado como la copia nueva.
 */
export function useDatosDelPanel(): {
  readonly estado: EstadoDelPanel;
  readonly reintentar: () => void;
  readonly activarModulo: (modulo: Modulo) => Promise<void>;
  readonly completarBienvenida: (eleccion: {
    nombre: string;
    modulos: readonly Modulo[];
  }) => Promise<void>;
} {
  const { estado, reintentar, actualizar } = useLecturaDelPanel();
  const pendientes = useRef(new Set<AbortController>());

  // Al salir de la pantalla se cancela lo que siga en camino: nadie espera ya el resultado.
  useEffect(() => {
    const enCamino = pendientes.current;

    return () => {
      enCamino.forEach((control) => {
        control.abort();
      });
      enCamino.clear();
    };
  }, []);

  /**
   * Cambia las preferencias y vuelve a pedir el progreso, como una sola operacion **de quien tiene la
   * sesion al empezar** (SCRUM-315): se anota antes del primer `await`, viaja a las dos peticiones
   * y se comprueba despues de cada espera. Si la sesion cambio o la pantalla se fue, el resultado no
   * se muestra, no se guarda y no se pide nada mas con la sesion de quien llego despues.
   *
   * Eso no es un fallo que contar: nadie espera ya la respuesta. Un fallo de verdad sale tal cual.
   */
  const cambiarYActualizar = useCallback(
    async (cambios: CambiosDePreferencias): Promise<void> => {
      const control = new AbortController();

      pendientes.current.add(control);

      const operacion = iniciarUnaOperacionDeLaSesion(control.signal);

      try {
        const cuenta = await cambiarPreferencias(cambios, control.signal, operacion?.peticion);

        operacion?.exigir();

        const progreso = await consultarElProgreso(control.signal, operacion?.peticion);

        // `actualizar` comprueba una vez mas que la operacion sigue vigente antes de mostrar y guardar.
        actualizar({ cuenta, progreso }, operacion);
      } catch (error) {
        if (operacion !== null && !operacion.vigente()) {
          return;
        }

        throw error;
      } finally {
        pendientes.current.delete(control);
      }
    },
    [actualizar],
  );

  /**
   * Activa un modulo mas y vuelve a pedir el progreso.
   *
   * Se pide de nuevo en lugar de inventar el del modulo nuevo aqui: lo que le toca hoy lo decide
   * el servidor, y adivinarlo en el cliente daria una pantalla que cambia al recargar.
   *
   * Si falla, lanza: quien pulso el boton es quien tiene que contarlo.
   */
  const activarModulo = useCallback(
    async (modulo: Modulo): Promise<void> => {
      if (estado.fase !== 'listo') {
        return;
      }

      await cambiarYActualizar({ modulosActivos: [...estado.cuenta.modulosActivos, modulo] });
    },
    [estado, cambiarYActualizar],
  );

  /**
   * Guarda lo que la persona eligio en la bienvenida y pasa al dashboard.
   *
   * El nombre va solo si escribio uno: dejarlo vacio no borra el que hubiera. Si falla, lanza,
   * para que la bienvenida lo cuente y deje reintentar.
   */
  const completarBienvenida = useCallback(
    async (eleccion: { nombre: string; modulos: readonly Modulo[] }): Promise<void> => {
      const nombre = eleccion.nombre.trim();

      await cambiarYActualizar({
        ...(nombre === '' ? {} : { nombre }),
        modulosActivos: eleccion.modulos,
      });
    },
    [cambiarYActualizar],
  );

  return { estado, reintentar, activarModulo, completarBienvenida };
}
