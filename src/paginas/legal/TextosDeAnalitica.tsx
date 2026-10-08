import { Link } from 'react-router-dom';

import { useAnalitica } from '../../analitica/useAnalitica.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { PorDefinir } from './PaginaLegal.tsx';

/**
 * Lo que los documentos legales dicen de la analitica (SCRUM-161), en un solo
 * sitio para que el aviso de privacidad y la pagina de cookies no cuenten cosas
 * distintas.
 *
 * Todo esto **solo aparece donde la analitica existe**, es decir, con
 * identificador de medicion. Donde no hay (PRE, desarrollo), los documentos no
 * mencionan una herramienta que no esta: afirmar que se mide cuando no se mide es
 * tan falso como lo contrario.
 *
 * Lo que dice debe ser cierto de `ga4.ts`: si algo cambia alla (que se manda, que
 * cookies pone, cuanto duran), cambia aqui, y sube la version del consentimiento
 * (`VERSION_DEL_CONSENTIMIENTO`) para volver a preguntar.
 */

/** Lo que se cuenta de una visita. */
export const LO_QUE_SE_CUENTA =
  'Una visita por pantalla, con el nombre de la pantalla (por ejemplo «panel» o «actividad») y no con la dirección exacta; el sitio desde el que llegaste, sin la ruta; y lo que cualquier página le da por sí sola a Google: tu navegador, tu dispositivo, tu idioma y tu dirección IP, que Google usa para estimar el país y no guarda.';

/** Lo que no se cuenta. */
export const LO_QUE_NO_SE_CUENTA =
  'Tu cuenta, tu correo, tus respuestas, tus resultados, tu diario ni nada de lo que escribes. Tampoco hay identificador de tu cuenta, ni señales de Google, ni anuncios.';

/** La viñeta de Google Analytics en la lista de proveedores. */
export function ProveedorGoogleAnalytics() {
  const { disponible } = useAnalitica();

  if (!disponible) {
    return null;
  }

  return (
    <li>
      <strong>Google Analytics</strong>: solo si aceptas la analítica, para contar las visitas a las
      pantallas. Lo que cuenta y lo que no está en la{' '}
      <Link to={`${RUTAS.COOKIES}#analitica`}>página de cookies</Link>.
    </li>
  );
}

/** Los datos que la analitica recoge, en la lista de «qué datos». */
export function DatosDeLaAnalitica() {
  const { disponible } = useAnalitica();

  if (!disponible) {
    return null;
  }

  return (
    <>
      <h3>Los de la analítica</h3>
      <p>Solo si lo aceptas en el aviso que te mostramos.</p>
      <ul>
        <li>
          <strong>Lo que cuenta:</strong> {LO_QUE_SE_CUENTA}
        </li>
        <li>
          <strong>Lo que no cuenta:</strong> {LO_QUE_NO_SE_CUENTA}
        </li>
      </ul>
      <p>
        Los recibe Google LLC, que puede tratarlos fuera de Colombia. Puedes retirar el permiso
        cuando quieras desde «Preferencias de analítica», al pie de las pantallas, o desde la página
        de cookies.{' '}
        <PorDefinir que="que la persona revisora confirme esta transferencia internacional (Ley 1581, art. 26) y la retención de 2 meses configurada en Google Analytics" />
      </p>
    </>
  );
}
