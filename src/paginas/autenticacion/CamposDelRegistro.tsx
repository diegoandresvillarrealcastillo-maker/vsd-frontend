import { Campo } from '../../componentes/Campo.tsx';
import { Casilla } from '../../componentes/Casilla.tsx';
import { RUTAS } from '../../rutas/rutas.ts';
import { fechaMaximaDelCampo, fechaMinimaDelCampo } from '../../sesion/edad.ts';
import { Aparece } from './LienzoDeAcceso.tsx';

interface Props {
  fecha: string;
  alCambiarLaFecha: (fecha: string) => void;
  /** Lo que esta mal de la fecha, si algo. */
  errorDeLaFecha?: string | undefined;
  avisoAceptado: boolean;
  alCambiarElAviso: (aceptado: boolean) => void;
  terminosAceptados: boolean;
  alCambiarLosTerminos: (aceptados: boolean) => void;
  disabled?: boolean;
}

/** El enlace a un documento: en otra pestana, para no perder lo que se lleva escrito. */
function EnlaceAlDocumento({ ruta, children }: { ruta: string; children: string }) {
  return (
    <a
      className="acceso__enlace"
      href={ruta}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${children} (se abre en otra pestaña)`}
    >
      {children}
    </a>
  );
}

/**
 * Lo que se le pide a una persona para quedar registrada: su fecha de nacimiento
 * y que acepte, con una casilla cada uno, el aviso de privacidad y los terminos.
 *
 * Lo comparten el registro con correo y la pantalla «Completa tu registro»
 * (T-03 de la auditoria 360), porque tiene que ser **lo mismo** en los dos: lo que
 * se acepta no puede depender de por donde se entro.
 *
 * ## Las casillas no vienen marcadas, y cada una dice a que se acepta
 *
 * Son dos, porque son dos documentos que cambian por su lado, y cada una enlaza al
 * suyo. Los enlaces abren otra pestana: un registro a medio escribir que se pierde
 * al leer el aviso desanima a leerlo.
 *
 * ## La fecha
 *
 * Es un campo de fecha del propio navegador, que da teclado numerico en el movil y
 * un selector en el escritorio. Los limites (hace 120 anos, ayer) son una ayuda: la
 * comprobacion que vale es la de la API.
 */
export function CamposDelRegistro({
  fecha,
  alCambiarLaFecha,
  errorDeLaFecha,
  avisoAceptado,
  alCambiarElAviso,
  terminosAceptados,
  alCambiarLosTerminos,
  disabled,
}: Props) {
  return (
    <>
      <Aparece>
        <Campo
          etiqueta="Fecha de nacimiento"
          type="date"
          name="bday"
          autoComplete="bday"
          required
          min={fechaMinimaDelCampo()}
          max={fechaMaximaDelCampo()}
          ayuda="VSD Health es solo para personas mayores de 18 años. La usamos únicamente para comprobarlo."
          error={errorDeLaFecha}
          value={fecha}
          disabled={disabled}
          onChange={(e) => alCambiarLaFecha(e.target.value)}
        />
      </Aparece>

      <Aparece>
        <Casilla
          etiqueta="Acepto el aviso de privacidad y el tratamiento de mis datos"
          nota={
            <>
              VSD Health maneja información relacionada con tu bienestar, que la ley considera
              sensible.{' '}
              <EnlaceAlDocumento ruta={RUTAS.PRIVACIDAD}>
                Leer el aviso de privacidad
              </EnlaceAlDocumento>
            </>
          }
          marcada={avisoAceptado}
          disabled={disabled === true}
          onChange={alCambiarElAviso}
        />
      </Aparece>

      <Aparece>
        <Casilla
          etiqueta="Acepto los términos y condiciones"
          nota={
            <>
              VSD Health no formula, no diagnostica y no reemplaza a un especialista médico.{' '}
              <EnlaceAlDocumento ruta={RUTAS.TERMINOS}>Leer los términos</EnlaceAlDocumento>
            </>
          }
          marcada={terminosAceptados}
          disabled={disabled === true}
          onChange={alCambiarLosTerminos}
        />
      </Aparece>
    </>
  );
}
