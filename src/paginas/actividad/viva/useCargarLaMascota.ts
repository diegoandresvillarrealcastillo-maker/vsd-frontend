import { useEffect, useState } from 'react';

import { consultarLaCuentaPropia, type Mascota } from '../../../infraestructura/api/cuenta.ts';
import { leerLaCuentaGuardada } from '../../../sincronizacion/panelLocal.ts';

/**
 * Trae la mascota que la persona tiene elegida en su cuenta (SCRUM-173).
 *
 * Dos pasos, el segundo manda:
 *
 * 1. **La copia de este equipo**, que ya esta y no hace ninguna peticion: la mascota aparece de
 *    inmediato y tambien sin conexion.
 * 2. **Lo que dice la cuenta ahora**, si hay conexion: es la que la persona eligio de verdad,
 *    aunque la haya cambiado hace un momento en el perfil o desde otro equipo, que es cuando la
 *    copia se queda atras. Si la peticion falla, se queda la de la copia.
 *
 * Esa misma consulta deja lista la mascota propia (el dibujo hecho con una foto) cuando la
 * persona tiene una, porque `consultarLaCuentaPropia` la sincroniza.
 *
 * Sin copia y sin conexion devuelve `null`, y se pinta la mascota de siempre.
 */
export function useCargarLaMascota(): Mascota | null {
  const [mascota, setMascota] = useState<Mascota | null>(null);

  useEffect(() => {
    const control = new AbortController();
    let llegoLaDeLaCuenta = false;

    leerLaCuentaGuardada()
      .then((guardada) => {
        // La de la copia solo vale mientras no haya llegado la de la cuenta.
        if (!control.signal.aborted && !llegoLaDeLaCuenta && guardada !== null) {
          setMascota(guardada.cuenta.mascota);
        }
      })
      .catch(() => {
        // Sin copia se espera a la cuenta, o se acompana con la de siempre.
      });

    consultarLaCuentaPropia(control.signal)
      .then((cuenta) => {
        if (!control.signal.aborted) {
          llegoLaDeLaCuenta = true;
          setMascota(cuenta.mascota);
        }
      })
      .catch(() => {
        // Sin conexion, o la API no responde: se queda la de la copia.
      });

    return () => {
      control.abort();
    };
  }, []);

  return mascota;
}
