import { useId, type ReactNode } from 'react';

import { useEnLinea } from '../conexion/useEnLinea.ts';
import '../estilos/conexion.css';

/** Lo que se dice donde algo exige conexion y no la hay. */
export const NECESITAS_CONEXION = 'Necesitas conexión para esto.';

/**
 * Lo que solo se puede hacer con conexion (SCRUM-142): sin ella, **se ve pero no se
 * puede usar, y dice por que**.
 *
 * Es lo contrario de simular un exito. Casi todo en VSD Health se guarda en el equipo y se
 * envia despues; lo de aqui no: cambiar la contrasena, el nombre, la foto o los avisos,
 * entrar, registrarse, descargar los datos o borrar la cuenta son cosas que el servidor
 * tiene que decidir en el momento. Guardarlas "para despues" seria decirle a la persona que
 * ya paso algo que no ha pasado (HU_MF09_001, criterio 3).
 *
 * ## Como
 *
 * Con un `<fieldset disabled>`: el navegador deshabilita por si solo todo lo que hay dentro
 * (campos, botones, interruptores, el selector de archivos) y se lo dice a los lectores de
 * pantalla. Nada se desmonta, asi que **lo escrito no se pierde**: al volver la conexion los
 * campos siguen como estaban, y se puede seguir. Los enlaces no son controles de formulario,
 * y siguen funcionando.
 *
 * La explicacion va escrita arriba y no solo en un `title`: un tooltip no se ve en el movil
 * ni lo lee quien navega con teclado. Se anuncia sola (`role="status"`) y es lo que describe
 * el bloque.
 *
 * Solo mira lo que dice el navegador (`navigator.onLine`): si dice que no hay red, es cierto.
 * Si dice que hay y la peticion no llega, cada formulario ya cuenta el fallo como antes.
 */
export function ExigeConexion({ children }: { children: ReactNode }) {
  const enLinea = useEnLinea();
  const idDelAviso = useId();

  return (
    <>
      {!enLinea && (
        <p id={idDelAviso} className="exige-conexion__aviso" role="status">
          {NECESITAS_CONEXION}
        </p>
      )}
      <fieldset
        className="exige-conexion"
        disabled={!enLinea}
        aria-describedby={enLinea ? undefined : idDelAviso}
      >
        {children}
      </fieldset>
    </>
  );
}
