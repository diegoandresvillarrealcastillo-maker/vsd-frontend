import { normalizarElNombre } from '../mecanicas/coloresDeCasillas.ts';
import { DIBUJOS } from './dibujos.tsx';

/** Si la biblioteca tiene un dibujo para esa clave. */
export function existeElPictograma(clave: string): boolean {
  return Object.hasOwn(DIBUJOS, normalizarElNombre(clave));
}
