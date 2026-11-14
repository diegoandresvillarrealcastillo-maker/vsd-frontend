/**
 * Las formas de las casillas de «Recuerda los colores» (SCRUM-209, ficha COG-01): las nueve de la
 * ficha, sin tildes. Lo que distingue una casilla de otra sin depender del color (R10).
 *
 * La lista vive aparte del componente que las dibuja (`FormaDeCasilla.tsx`) para que el componente
 * este obligado, por tipos, a dibujar cada una: si se agrega un nombre aqui y falta su dibujo, no
 * compila.
 */
export const FORMAS_DE_CASILLA = [
  'circulo',
  'cuadrado',
  'triangulo',
  'rombo',
  'estrella',
  'hoja',
  'gota',
  'luna',
  'nube',
] as const;

export type FormaConocida = (typeof FORMAS_DE_CASILLA)[number];

export function esUnaFormaConocida(nombre: string): nombre is FormaConocida {
  return (FORMAS_DE_CASILLA as readonly string[]).includes(nombre);
}
