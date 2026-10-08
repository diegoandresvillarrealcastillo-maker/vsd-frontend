import '../estilos/avisos-clinicos.css';
import { EnlacesLegales } from '../paginas/legal/EnlacesLegales.tsx';

/**
 * El pie breve de las pantallas de la aplicacion (L-03 de la auditoria 360).
 *
 * Dice lo que VSD Health no es y para quien es, con el camino a los documentos.
 * Va en el panel y en el perfil, que es donde se pasa mas tiempo: el aviso de la
 * portada se ve una vez, antes de entrar, y despues no volvia a aparecer.
 *
 * Usa los colores de lo que tiene alrededor y no los suyos, por lo mismo que
 * `AvisoOrientativo`.
 */
export function PieDeLaApp() {
  return (
    <footer className="pie-de-la-app">
      <p className="pie-de-la-app__texto">
        VSD Health no diagnostica, no formula medicamentos y no reemplaza a un especialista médico.
        Es solo para mayores de 18 años.
      </p>

      <EnlacesLegales className="pie-de-la-app__enlaces" />
    </footer>
  );
}
