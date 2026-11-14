import { Link } from 'react-router-dom';

import { useAnalitica } from '../../analitica/useAnalitica.ts';
import '../../estilos/legal.css';
import type { Ruta } from '../../rutas/rutas.ts';
import { DOCUMENTOS_LEGALES } from './datosLegales.ts';

/**
 * Los tres documentos legales, en el pie de la portada, en el de las pantallas de
 * acceso y en el de las propias paginas legales. La lista vive en
 * `datosLegales.ts`: asi un documento nuevo aparece en todos a la vez y ninguno
 * se queda con un enlace de menos.
 *
 * Donde hay analitica (SCRUM-161) se suma «Preferencias de analitica», que vuelve
 * a abrir el banner: cambiar de idea tiene que ser tan facil como la primera vez, y
 * estar siempre a mano. Es un boton y no un enlace, porque no lleva a ninguna parte.
 */

interface Props {
  /** El documento que se esta leyendo, si es uno de ellos: se marca como la pagina actual. */
  actual?: Ruta;
  className?: string;
}

export function EnlacesLegales({ actual, className }: Props) {
  const { disponible, preguntarDeNuevo } = useAnalitica();

  return (
    <nav
      className={className === undefined ? 'enlaces-legales' : `enlaces-legales ${className}`}
      aria-label="Documentos legales"
    >
      <ul className="enlaces-legales__lista">
        {DOCUMENTOS_LEGALES.map((documento) => (
          <li key={documento.ruta}>
            <Link
              className="enlaces-legales__enlace"
              to={documento.ruta}
              {...(documento.ruta === actual ? { 'aria-current': 'page' as const } : {})}
            >
              {documento.nombre}
            </Link>
          </li>
        ))}
        {disponible && (
          <li>
            <button
              type="button"
              className="enlaces-legales__enlace enlaces-legales__boton"
              onClick={preguntarDeNuevo}
            >
              Preferencias de analítica
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
