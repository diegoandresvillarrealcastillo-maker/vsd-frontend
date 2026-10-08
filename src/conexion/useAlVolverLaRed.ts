import { useEffect } from 'react';

/**
 * Hace `alVolver` cada vez que el navegador dice que volvio la conexion, mientras `activo`
 * (SCRUM-139, SCRUM-140).
 *
 * Sirve a las pantallas que ensenan la copia de este equipo porque no pudieron leer del
 * servidor: en cuanto vuelve la red, vuelven a preguntar y la copia deja de verse. Cuando no
 * se esta viendo la copia no hace falta preguntar de nuevo, y no se escucha nada.
 *
 * `alVolver` tiene que ser estable (`useCallback`): si cambia en cada pintado, se vuelve a
 * suscribir cada vez.
 */
export function useAlVolverLaRed(activo: boolean, alVolver: () => void): void {
  useEffect(() => {
    if (!activo) {
      return undefined;
    }

    window.addEventListener('online', alVolver);

    return () => {
      window.removeEventListener('online', alVolver);
    };
  }, [activo, alVolver]);
}
