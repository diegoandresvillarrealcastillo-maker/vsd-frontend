import type { Cuenta } from './cuenta.ts';
import { llamarALaApi, pedirBytesALaApi } from './clienteHttp.ts';

/**
 * La foto de perfil, por HTTP (SCRUM-120).
 *
 * Ninguna ruta lleva un identificador de persona, y no podria: la foto es
 * siempre la de quien firma el token. Lo que hay aqui es solo la API; quien
 * guarda la foto para pintarla y la olvida al salir es `foto/fotoDePerfil.ts`.
 */

const RUTA = '/api/cuenta/foto';

/**
 * Guarda la foto y devuelve la cuenta como quedo, con la marca de cuando.
 *
 * Se manda **el archivo mismo**, con su tipo (`image/jpeg`), y no un JSON ni un
 * formulario: es lo que el navegador ya tiene despues de recortarla y
 * comprimirla. La API la comprueba otra vez —tipo, peso, que sea de verdad una
 * imagen y su tamano en pixeles— sin fiarse de que este lado lo haya hecho bien.
 */
export function guardarLaFoto(foto: Blob, senal?: AbortSignal): Promise<Cuenta> {
  return llamarALaApi<Cuenta>(RUTA, { metodo: 'PUT', bytes: foto, ...(senal ? { senal } : {}) });
}

/** Quita la foto. Devuelve la cuenta como quedo; quitar la que no hay no es un error. */
export function quitarLaFoto(senal?: AbortSignal): Promise<Cuenta> {
  return llamarALaApi<Cuenta>(RUTA, { metodo: 'DELETE', ...(senal ? { senal } : {}) });
}

/**
 * La foto propia, como archivo. Falla con `FOTO_NO_ENCONTRADA` (404) si no
 * tiene.
 */
export function pedirLaFoto(senal?: AbortSignal): Promise<Blob> {
  return pedirBytesALaApi(RUTA, senal ? { senal } : {});
}
