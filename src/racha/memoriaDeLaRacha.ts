import type { Racha } from '../infraestructura/api/racha.ts';

/**
 * Lo ultimo que dijo el servidor de la racha, para no dejar la barra vacia en cada pantalla
 * (SCRUM-186).
 *
 * Vive **en memoria** y con la cuenta a la que pertenece: solo se entrega si es la de ahora, y
 * se olvida al cerrar la sesion, igual que la foto y la mascota. No se guarda nada en este
 * equipo: es un numero que el servidor vuelve a decir en cuanto hay conexion.
 */
let ultima: { readonly cuenta: string; readonly racha: Racha } | null = null;

export function recordarLaRacha(cuenta: string, racha: Racha): void {
  ultima = { cuenta, racha };
}

/** Lo ultimo que se supo de esa cuenta, o `null` si no se sabe nada o era de otra persona. */
export function rachaRecordadaDe(cuenta: string): Racha | null {
  return ultima?.cuenta === cuenta ? ultima.racha : null;
}

/** Termina la sesion: la racha de esa persona no se queda para la siguiente. */
export function olvidarLaRacha(): void {
  ultima = null;
}
