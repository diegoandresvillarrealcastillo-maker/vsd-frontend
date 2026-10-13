/**
 * Si una cuenta ya vio el tutorial de bienvenida en este equipo (SCRUM-187).
 *
 * Es una comodidad de este navegador, no un dato de la persona: se guarda solo una marca por
 * cuenta y no viaja al servidor. Si se pierde (otro equipo, datos del sitio borrados), el
 * tutorial se vuelve a ofrecer, y siempre se puede omitir.
 *
 * **No se olvida al cerrar la sesion**, a diferencia de la foto o el dato curioso: es lo que
 * evita que el tutorial reaparezca en cada ingreso.
 */

const PREFIJO = 'vsd-h:tutorial-visto:';

export function tutorialVisto(cuenta: string): boolean {
  try {
    return localStorage.getItem(`${PREFIJO}${cuenta}`) === 'si';
  } catch {
    // Sin almacenamiento no se puede recordar: mejor no insistir que repetirlo siempre.
    return true;
  }
}

/** Lo vio completo o lo omitio: en los dos casos no se le vuelve a abrir solo. */
export function marcarElTutorialComoVisto(cuenta: string): void {
  try {
    localStorage.setItem(`${PREFIJO}${cuenta}`, 'si');
  } catch {
    // Sin espacio o sin almacenamiento: no es grave.
  }
}

/** Para repetirlo a voluntad desde el perfil. */
export function volverAVerElTutorial(cuenta: string): void {
  try {
    localStorage.removeItem(`${PREFIJO}${cuenta}`);
  } catch {
    // Nada que olvidar.
  }
}
