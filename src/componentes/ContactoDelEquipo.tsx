import { ACLARACION_DEL_SOPORTE, CORREO_DE_SOPORTE } from '../equipo.ts';

/**
 * El contacto tecnico del equipo de VSD Health (SCRUM-257), en una linea, para el pie de
 * la aplicacion.
 *
 * No usa «Llamar ahora»: ese boton es de las lineas de atencion verificadas. El correo
 * es el canal formal para problemas tecnicos y el texto aclara que no es una linea de ayuda.
 */
export function ContactoDelEquipo() {
  return (
    <p className="pie-de-la-app__texto">
      ¿Algo técnico no funciona? Contacta al equipo de VSD Health en{' '}
      <a className="pie-de-la-app__contacto" href={`mailto:${CORREO_DE_SOPORTE}`}>
        {CORREO_DE_SOPORTE}
      </a>
      . {ACLARACION_DEL_SOPORTE}
    </p>
  );
}
