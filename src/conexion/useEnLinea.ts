import { useSyncExternalStore } from 'react';

function suscribir(avisar: () => void): () => void {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);

  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

/**
 * Si el navegador dice que hay conexion (SCRUM-141), y se entera cuando cambia.
 *
 * `navigator.onLine` solo sirve en un sentido: si dice que **no** hay red, es cierto; si
 * dice que si, solo quiere decir que hay una interfaz de red. Para lo que necesita saber de
 * verdad si llega a la API esta `hayConexionConLaApi`. Esto es para lo que solo quiere
 * mostrar "sin conexion" cuando el navegador ya lo dice, igual que decide la conversacion
 * de VSD IA si intenta o no preguntar.
 */
export function useEnLinea(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  );
}
