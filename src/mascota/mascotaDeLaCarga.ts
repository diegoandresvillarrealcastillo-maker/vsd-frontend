import { PERSONAJE_POR_DEFECTO, PERSONAJES_EN_ORDEN, type Personaje } from './personajes.ts';

/**
 * La mascota que corre en la pantalla de carga (SCRUM-283).
 *
 * Esa pantalla sale **antes** que la aplicacion: el `index.html` la pinta con el primer byte, sin
 * esperar al JavaScript ni a la cuenta. Por eso la mascota no puede salir de la cuenta, que todavia
 * no llego: se recuerda aqui, en este navegador, la ultima que se vio.
 *
 * Es una comodidad del navegador, como el tema (`tema/tema.ts`): una sola palabra de las cinco que
 * conocemos, sin datos de la persona. Aun asi se olvida al cerrar la sesion, para que quien use el
 * mismo equipo despues no vea la mascota de la anterior antes de entrar.
 *
 * La clave y la lista de formas estan duplicadas en el script del `index.html` y en sus reglas de
 * estilo, que corren antes de cualquier modulo. Si cambia algo de aqui, cambia alla
 * (`mascotaDeLaCarga.spec.ts` lo comprueba).
 *
 * Quien tiene su propia mascota (un dibujo subido) o una forma que este frontend no conoce ve la
 * de siempre: el dibujo propio se pide al servidor y no esta a tiempo.
 */
export const CLAVE_DE_LA_MASCOTA_DE_LA_CARGA = 'vsd.mascota';

/** Pone la mascota en el elemento raiz, donde la leen las reglas de estilo de la pantalla de carga. */
function ponerEnElDocumento(personaje: Personaje): void {
  document.documentElement.dataset.mascota = personaje;
}

/** Llega la cuenta: se recuerda su mascota para la proxima vez que se abra la aplicacion. */
export function recordarLaMascotaDeLaCarga(forma: string | undefined): void {
  // Lo que se guarda sale de la lista nuestra, nunca de lo que llego: asi el almacenamiento no puede
  // recibir otra cosa que una de las cinco formas.
  const personaje =
    PERSONAJES_EN_ORDEN.find((conocido) => conocido === forma) ?? PERSONAJE_POR_DEFECTO;

  ponerEnElDocumento(personaje);

  try {
    localStorage.setItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA, personaje);
  } catch {
    // Navegacion privada o almacenamiento lleno: la proxima vez sale la de siempre.
  }
}

/** Termina la sesion: la siguiente persona no ve la mascota de esta. */
export function olvidarLaMascotaDeLaCarga(): void {
  ponerEnElDocumento(PERSONAJE_POR_DEFECTO);

  try {
    localStorage.removeItem(CLAVE_DE_LA_MASCOTA_DE_LA_CARGA);
  } catch {
    // Sin almacenamiento no hay nada que olvidar.
  }
}
