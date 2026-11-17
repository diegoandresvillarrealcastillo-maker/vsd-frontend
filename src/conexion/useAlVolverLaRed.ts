import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Hace `alVolver` cada vez que el navegador dice que volvio la conexion, mientras `activo`
 * (SCRUM-139, SCRUM-140).
 *
 * Sirve a las pantallas que ensenan la copia de este equipo porque no pudieron leer del
 * servidor: en cuanto vuelve la red, vuelven a preguntar y la copia deja de verse. Cuando no
 * se esta viendo la copia no hace falta preguntar de nuevo, y no se escucha nada.
 *
 * Mantiene un unico listener mientras el componente esta montado. Asi no se pierde un evento
 * `online` entre el cambio de `activo` y el efecto que antes registraba el listener.
 */
export function useAlVolverLaRed(activo: boolean, alVolver: () => void): void {
  const activoActual = useRef(activo);
  const accionActual = useRef(alVolver);

  useLayoutEffect(() => {
    activoActual.current = activo;
    accionActual.current = alVolver;
  }, [activo, alVolver]);

  useEffect(() => {
    const manejarLaVuelta = () => {
      if (activoActual.current) {
        accionActual.current();
      }
    };

    window.addEventListener('online', manejarLaVuelta);

    return () => {
      window.removeEventListener('online', manejarLaVuelta);
    };
  }, []);
}
