import '../../../estilos/figuras.css';
import { Pictograma } from '../pictogramas/Pictograma.tsx';
import { FIGURAS_DE_ESTIRAMIENTO } from './estiramientos.tsx';

/**
 * Una figura de estiramiento (SCRUM-226): el dibujo de un gesto de «Pausa de estiramiento», con la clave
 * `zona:gesto` que la sesion pone en el paso (por ejemplo `cuello:inclinar-der`).
 *
 * Es adorno para quien ve (`aria-hidden`): lo que dice que hacer es el texto del paso (R10). Una clave que no
 * conozca se pinta como una ficha neutra, igual que un pictograma desconocido, y el paso se sigue por su texto.
 */
export function FiguraDeEstiramiento({ clave, tamano = 120 }: { clave: string; tamano?: number }) {
  // Solo lo que esta en la tabla: «constructor» no es una figura, aunque el objeto tenga uno.
  const dibujo = Object.hasOwn(FIGURAS_DE_ESTIRAMIENTO, clave)
    ? FIGURAS_DE_ESTIRAMIENTO[clave]
    : undefined;

  if (dibujo === undefined) {
    return <Pictograma tamano={tamano} />;
  }

  return (
    <svg
      className="figura"
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-figura={clave}
    >
      {dibujo()}
    </svg>
  );
}
