import type { Cuenta } from './cuenta.ts';
import { llamarALaApi, pedirBytesALaApi } from './clienteHttp.ts';

/**
 * La mascota propia, un SVG, por HTTP (SCRUM-122).
 *
 * Como la foto, **ninguna ruta lleva un identificador de persona**: es siempre
 * la de quien firma el token. Lo que hay aqui es solo la API; quien la guarda
 * para pintarla y la olvida al salir es `foto/mascotaPropia.ts`.
 */

const RUTA = '/api/cuenta/mascota-propia';

export const TIPO_DEL_SVG = 'image/svg+xml';

/**
 * Guarda la mascota y devuelve la cuenta como quedo, con la marca de cuando.
 *
 * Se manda **el archivo mismo**, con su tipo (`image/svg+xml`). El servidor **no
 * guarda lo que llega: lo reescribe** desde una lista blanca y rechaza lo
 * peligroso o lo que no admite, con un codigo por motivo. Por eso lo que despues
 * se pinta es lo que devuelve la API y no este archivo.
 */
export function guardarLaMascotaPropia(svg: Blob, senal?: AbortSignal): Promise<Cuenta> {
  // El tipo se pone aqui y no se deja al que traiga el archivo: un `.svg` suelto
  // llega a veces sin tipo, y la API exige `image/svg+xml`.
  const conTipo = svg.type === TIPO_DEL_SVG ? svg : new Blob([svg], { type: TIPO_DEL_SVG });

  return llamarALaApi<Cuenta>(RUTA, {
    metodo: 'PUT',
    bytes: conTipo,
    ...(senal ? { senal } : {}),
  });
}

/**
 * Quita la mascota propia. Devuelve la cuenta como quedo: si era la elegida, la
 * persona vuelve al personaje de siempre, con el nombre que le habia puesto.
 * Quitar la que no hay no es un error.
 */
export function quitarLaMascotaPropia(senal?: AbortSignal): Promise<Cuenta> {
  return llamarALaApi<Cuenta>(RUTA, { metodo: 'DELETE', ...(senal ? { senal } : {}) });
}

/**
 * La mascota propia, ya saneada por el servidor, como archivo. Falla con
 * `MASCOTA_PROPIA_NO_ENCONTRADA` (404) si no tiene.
 */
export function pedirLaMascotaPropia(senal?: AbortSignal): Promise<Blob> {
  return pedirBytesALaApi(RUTA, { acepta: TIPO_DEL_SVG, ...(senal ? { senal } : {}) });
}
