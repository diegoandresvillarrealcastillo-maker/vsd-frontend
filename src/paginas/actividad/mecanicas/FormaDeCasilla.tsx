import '../../../estilos/pictogramas.css';
import { DIBUJOS } from '../pictogramas/dibujos.tsx';
import { normalizarElNombre } from './coloresDeCasillas.ts';

/**
 * La forma de una casilla de «Recuerda los colores» (SCRUM-209, ficha COG-01): una de las nueve de siempre o,
 * desde SCRUM-225, cualquier pictograma de la biblioteca (frutas, animales, clima...).
 *
 * Lo que distingue una casilla de otra **sin depender del color** (R10): cada una lleva una figura
 * propia, ademas de su nombre escrito. Son las nueve de la ficha. Una forma que no se conozca, o
 * ninguna, se dibuja como una ficha neutra: la casilla se juega igual, por su nombre.
 *
 * Es adorno para quien ve (`aria-hidden`): lo que leen los lectores de pantalla es el nombre.
 * Toma su color del texto que la rodea (`currentColor`), asi que cambia sola con el tema.
 */
const FICHA = <rect x="3.5" y="6" width="17" height="12" rx="6" />;

export function FormaDeCasilla({ forma, tamano = 40 }: { forma?: string; tamano?: number }) {
  const normal = forma === undefined ? undefined : normalizarElNombre(forma);
  // Las nueve de siempre y las 60 de la biblioteca (SCRUM-225): las nueve estan entre las 60.
  const dibujo =
    normal !== undefined && Object.hasOwn(DIBUJOS, normal) ? DIBUJOS[normal] : undefined;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
      data-forma={dibujo === undefined ? 'ficha' : normal}
    >
      {dibujo ?? FICHA}
    </svg>
  );
}
