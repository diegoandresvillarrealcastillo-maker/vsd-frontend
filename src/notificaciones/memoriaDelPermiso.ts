/**
 * Si ya se le ofrecieron los avisos a una cuenta en este equipo (SCRUM-188).
 *
 * Es una comodidad de este navegador, no un dato de la persona: una marca por cuenta que no
 * viaja al servidor. Con ella la ventana se ofrece **una sola vez**: quien dijo «ahora no» no
 * recibe la misma pregunta en cada ingreso. Los avisos se pueden activar cuando quiera desde
 * Perfil › Avisos, que no depende de esta marca.
 *
 * No se olvida al cerrar la sesion, por lo mismo que la del tutorial.
 */

const PREFIJO = 'vsd-h:avisos-preguntados:';

export function avisosYaPreguntados(cuenta: string): boolean {
  try {
    return localStorage.getItem(`${PREFIJO}${cuenta}`) === 'si';
  } catch {
    // Sin almacenamiento no se puede recordar: mejor no insistir que preguntar siempre.
    return true;
  }
}

export function marcarQueYaSePregunto(cuenta: string): void {
  try {
    localStorage.setItem(`${PREFIJO}${cuenta}`, 'si');
  } catch {
    // Sin espacio o sin almacenamiento: no es grave.
  }
}

/** Solo para las pruebas y para repetir la pregunta a proposito. */
export function olvidarQueYaSePregunto(cuenta: string): void {
  try {
    localStorage.removeItem(`${PREFIJO}${cuenta}`);
  } catch {
    // Nada que olvidar.
  }
}
