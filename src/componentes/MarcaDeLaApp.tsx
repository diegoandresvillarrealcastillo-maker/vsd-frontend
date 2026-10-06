import { Link } from 'react-router-dom';

import '../estilos/marca.css';
import { RUTAS } from '../rutas/rutas.ts';
import { Isotipo } from './Isotipo.tsx';

/**
 * La marca de la aplicacion despues de entrar: el isotipo y el nombre, que
 * llevan al panel (SCRUM-117).
 *
 * La usan la barra de arriba del panel, el perfil, el diario y el sendero, y la
 * barra de las actividades. Antes cada una la dibujaba a su manera, y la de las
 * actividades era la imagen del logotipo completo: dentro de la cuenta la marca
 * se veia distinta segun la pantalla. Aqui hay una sola, y no depende del tema.
 *
 * El nombre accesible empieza por lo que se ve, "VSD-H", para que quien dicta
 * "pulsar VSD-H" lo encuentre.
 */
export function MarcaDeLaApp() {
  return (
    <Link to={RUTAS.PANEL} className="marca" aria-label="VSD-H, inicio">
      <Isotipo />
      <span className="marca__texto">VSD-H</span>
    </Link>
  );
}
