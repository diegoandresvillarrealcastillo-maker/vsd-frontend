import type { ReactElement } from 'react';

import { normalizarElNombre } from './coloresDeCasillas.ts';
import { esUnaFormaConocida, type FormaConocida } from './formasDeCasilla.ts';

/**
 * La forma de una casilla de «Recuerda los colores» (SCRUM-209, ficha COG-01).
 *
 * Lo que distingue una casilla de otra **sin depender del color** (R10): cada una lleva una figura
 * propia, ademas de su nombre escrito. Son las nueve de la ficha. Una forma que no se conozca, o
 * ninguna, se dibuja como una ficha neutra: la casilla se juega igual, por su nombre.
 *
 * Es adorno para quien ve (`aria-hidden`): lo que leen los lectores de pantalla es el nombre.
 * Toma su color del texto que la rodea (`currentColor`), asi que cambia sola con el tema.
 */
const DIBUJOS: Readonly<Record<FormaConocida, ReactElement>> = {
  circulo: <circle cx="12" cy="12" r="9" />,
  cuadrado: <rect x="4" y="4" width="16" height="16" rx="2.5" />,
  triangulo: <polygon points="12,3.5 21.5,20 2.5,20" />,
  rombo: <polygon points="12,2.5 21.5,12 12,21.5 2.5,12" />,
  estrella: (
    <polygon points="12,2.5 14.9,8.7 21.7,9.4 16.6,14 18.1,20.8 12,17.3 5.9,20.8 7.4,14 2.3,9.4 9.1,8.7" />
  ),
  hoja: (
    <path d="M20 4C11 4 5 8.5 5 15c0 1.9.6 3.6 1.6 5C8 14.8 12 11.4 17 9.5c-4.2 3.3-7 6.6-8.4 10.5C15.9 20 20 14.3 20 4z" />
  ),
  gota: <path d="M12 2.5c3 4.2 6.5 7.6 6.5 11.5a6.5 6.5 0 1 1-13 0C5.5 10.1 9 6.7 12 2.5z" />,
  luna: <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z" />,
  nube: <path d="M7 18.5a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.9 9.6 4.5 4.5 0 0 1 17.5 18.5H7z" />,
};

const FICHA = <rect x="3.5" y="6" width="17" height="12" rx="6" />;

export function FormaDeCasilla({ forma, tamano = 40 }: { forma?: string; tamano?: number }) {
  const normal = forma === undefined ? undefined : normalizarElNombre(forma);
  const dibujo = normal !== undefined && esUnaFormaConocida(normal) ? DIBUJOS[normal] : undefined;

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
