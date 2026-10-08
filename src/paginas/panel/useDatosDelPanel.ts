import { useCallback } from 'react';

import { cambiarPreferencias, type Modulo } from '../../infraestructura/api/cuenta.ts';
import { consultarElProgreso } from '../../infraestructura/api/progreso.ts';
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

      const cuenta = await cambiarPreferencias({
        modulosActivos: [...estado.cuenta.modulosActivos, modulo],
      });
      const progreso = await consultarElProgreso();

      actualizar({ cuenta, progreso });
    },
    [estado, actualizar],
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
      const cuenta = await cambiarPreferencias({
        ...(nombre === '' ? {} : { nombre }),
        modulosActivos: eleccion.modulos,
      });
      const progreso = await consultarElProgreso();

      actualizar({ cuenta, progreso });
    },
    [actualizar],
  );

  return { estado, reintentar, activarModulo, completarBienvenida };
}
