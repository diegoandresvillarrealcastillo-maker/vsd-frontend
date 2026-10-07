import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import {
  guardarLaMascotaPropia,
  pedirLaMascotaPropia,
  quitarLaMascotaPropia,
  TIPO_DEL_SVG,
} from '../infraestructura/api/mascotaPropia.ts';
import { crearElAlmacenDeArchivo, type EstadoDelArchivo } from './almacenDeArchivo.ts';

/**
 * La mascota propia de la persona, lista para pintar (SCRUM-122).
 *
 * La mecanica es la de `almacenDeArchivo.ts`, la misma de la foto de perfil.
 * Dos cosas son de aqui:
 *
 * - **Se pinta lo que devuelve el servidor, nunca lo que eligio la persona.** El
 *   servidor reescribe el SVG desde una lista blanca; lo que se ve es eso. Por
 *   eso, a diferencia de la foto, al guardar **no** se usa el archivo elegido:
 *   se pide de vuelta el saneado. Una pantalla de esta aplicacion nunca pinta ni
 *   un byte del SVG original.
 * - **El tipo del archivo se fija a `image/svg+xml`**: una direccion `blob:` de
 *   un SVG sin tipo no se pinta.
 *
 * Y se pinta siempre como `<img>`, nunca incrustado en la pagina: en ese modo el
 * navegador no ejecuta scripts ni carga nada de fuera.
 */

const almacen = crearElAlmacenDeArchivo({
  pedir: () => pedirLaMascotaPropia(),
  tipo: TIPO_DEL_SVG,
});

/** Mira la cuenta que acaba de llegar y deja la mascota propia como corresponde. */
export function sincronizarLaMascotaPropia(cuenta: Pick<Cuenta, 'id' | 'mascotaPropia'>): void {
  almacen.sincronizar(cuenta.id, cuenta.mascotaPropia?.actualizadaEl ?? null);
}

/** Al salir: la mascota propia de esta cuenta no se queda para la siguiente persona. */
export function olvidarLaMascotaPropia(): void {
  almacen.olvidar();
}

/**
 * Guarda el SVG y deja lista para pintar la version que guardo el servidor.
 * Devuelve la cuenta como quedo. Si la API lo rechaza, lanza y lo que se veia se
 * queda como estaba.
 */
export async function subirLaMascotaPropia(svg: Blob): Promise<Cuenta> {
  const cuenta = await guardarLaMascotaPropia(svg);

  sincronizarLaMascotaPropia(cuenta);

  return cuenta;
}

/** La quita y la deja de pintar. Devuelve la cuenta como quedo. */
export async function retirarLaMascotaPropia(): Promise<Cuenta> {
  const cuenta = await quitarLaMascotaPropia();

  sincronizarLaMascotaPropia(cuenta);

  return cuenta;
}

/** La direccion de la mascota propia y si se esta pidiendo. */
export function useMascotaPropia(): Pick<EstadoDelArchivo, 'url' | 'cargando'> {
  const { url, cargando } = almacen.usarElEstado();

  return { url, cargando };
}
