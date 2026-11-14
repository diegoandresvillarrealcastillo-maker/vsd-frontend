import { useMascotaPropia } from '../../../foto/mascotaPropia.ts';
import type { Mascota } from '../../../infraestructura/api/cuenta.ts';
import { mascotaParaMostrar, type Expresion } from '../../../mascota/personajes.ts';
import { sprite } from '../../../mascota/sprites.ts';

/**
 * El dibujo de la mascota de la persona con la expresion pedida (SCRUM-173): el suyo, si se
 * hizo uno propio con una foto, o el sprite del personaje que eligio. Sin mascota, el de la
 * que se muestra por defecto.
 */
export function useImagenDeLaMascota(mascota: Mascota | null, expresion: Expresion): string {
  const { personaje, propia } = mascotaParaMostrar(mascota);
  const dibujoPropio = useMascotaPropia();

  return propia && dibujoPropio.url !== null ? dibujoPropio.url : sprite(personaje, expresion);
}
