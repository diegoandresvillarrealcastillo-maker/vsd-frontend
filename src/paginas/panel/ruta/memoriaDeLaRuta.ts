import type { Modulo } from '../../../infraestructura/api/cuenta.ts';
import { ORDEN } from '../modulos.ts';

/**
 * Cual fue el ultimo modulo que se abrio en la ruta de 365 dias (SCRUM-293).
 *
 * Es una comodidad de este navegador, no un dato de la persona: se guarda una sola palabra por
 * cuenta y no viaja al servidor. El dia en el que va cada modulo **no** se guarda aqui: sale del
 * progreso, que ya tiene copia en este equipo (SCRUM-140), y es lo que lleva la vista al dia activo.
 * Si se pierde, simplemente todos los modulos se ven cerrados.
 */

const PREFIJO = 'vsd-h:ruta-abierta:';

export function rutaAbierta(cuenta: string): Modulo | null {
  try {
    const guardado = localStorage.getItem(`${PREFIJO}${cuenta}`);

    return ORDEN.find((modulo) => modulo === guardado) ?? null;
  } catch {
    // Sin almacenamiento no se puede recordar: todo cerrado, como la primera vez.
    return null;
  }
}

/** `null` cuando se cierra el modulo: no queda nada que recordar. */
export function recordarLaRutaAbierta(cuenta: string, modulo: Modulo | null): void {
  try {
    if (modulo === null) {
      localStorage.removeItem(`${PREFIJO}${cuenta}`);
    } else {
      localStorage.setItem(`${PREFIJO}${cuenta}`, modulo);
    }
  } catch {
    // Sin espacio o sin almacenamiento: no es grave.
  }
}

export function olvidarLaRutaAbierta(cuenta: string): void {
  recordarLaRutaAbierta(cuenta, null);
}
