import '../../../estilos/pictogramas.css';
import { normalizarElNombre } from '../mecanicas/coloresDeCasillas.ts';
import { DIBUJOS } from './dibujos.tsx';

/**
 * Una figura de la biblioteca de pictogramas (SCRUM-225): un dibujo sencillo con el color del texto que lo rodea.
 *
 * Es adorno para quien ve (`aria-hidden`): lo que lee un lector de pantalla es el nombre escrito que
 * acompana a cada figura en la sesion (R10). Una clave que la biblioteca no conozca, o ninguna, se dibuja
 * como una ficha neutra: el juego se juega igual, por el nombre.
 */
const FICHA = <rect x="3.500" y="6" width="17" height="12" rx="6" />;

export function Pictograma({
  clave,
  tamano = 40,
}: {
  clave?: string | undefined;
  tamano?: number;
}) {
  const normal = clave === undefined ? undefined : normalizarElNombre(clave);
  // Solo lo que esta en la tabla: «constructor» no es un pictograma, aunque el objeto tenga uno.
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
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      data-forma={dibujo === undefined ? 'ficha' : normal}
    >
      {dibujo ?? FICHA}
    </svg>
  );
}
