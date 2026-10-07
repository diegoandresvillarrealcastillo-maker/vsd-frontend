import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import { guardarLaFoto, pedirLaFoto, quitarLaFoto } from '../infraestructura/api/foto.ts';
import { crearElAlmacenDeArchivo } from './almacenDeArchivo.ts';

/**
 * La foto de perfil de la persona, lista para pintar (SCRUM-120).
 *
 * La mecanica —pedirla solo cuando cambia su marca, no repetir, descartar lo que
 * llega tarde, soltarla al salir— es la de `almacenDeArchivo.ts`, que comparte
 * con la mascota propia. Aqui solo queda lo que es de la foto: de que cuenta
 * sale su marca y como se pide, se guarda y se quita.
 */

const almacen = crearElAlmacenDeArchivo({ pedir: () => pedirLaFoto() });

/**
 * Mira la cuenta que acaba de llegar y deja la foto como corresponde.
 *
 * @param archivo La foto, si ya se tiene a mano (la que acaba de elegir la
 *   persona). Evita pedirla de vuelta a la API.
 */
export function sincronizarLaFoto(cuenta: Pick<Cuenta, 'id' | 'foto'>, archivo?: Blob): void {
  almacen.sincronizar(cuenta.id, cuenta.foto?.actualizadaEl ?? null, archivo);
}

/** Al salir: la foto de esta cuenta no se queda para la siguiente persona. */
export function olvidarLaFoto(): void {
  almacen.olvidar();
}

/**
 * Guarda la foto y la deja lista para pintar. Devuelve la cuenta como quedo.
 * Si la API la rechaza, lanza y lo que se veia se queda como estaba.
 */
export async function subirLaFoto(foto: Blob): Promise<Cuenta> {
  const cuenta = await guardarLaFoto(foto);

  sincronizarLaFoto(cuenta, foto);

  return cuenta;
}

/** Quita la foto y la deja de pintar. Devuelve la cuenta como quedo. */
export async function retirarLaFoto(): Promise<Cuenta> {
  const cuenta = await quitarLaFoto();

  sincronizarLaFoto(cuenta);

  return cuenta;
}

/** La direccion de la foto de la persona, o `null` si no tiene. */
export function useFotoDePerfil(): string | null {
  return almacen.usarLaDireccion();
}
