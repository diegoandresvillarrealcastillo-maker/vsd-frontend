import { EQUIPO, SOLO_PROBLEMAS_TECNICOS } from '../equipo.ts';

/**
 * El contacto tecnico del equipo de VSD Health (SCRUM-257), en una linea, para el pie de
 * la aplicacion.
 *
 * No usa «Llamar ahora»: ese boton es de las lineas de atencion verificadas. Estos son
 * dos personas del equipo y el texto dice, con todas las letras, que son solo para
 * problemas tecnicos y que no son una linea de ayuda.
 */
export function ContactoDelEquipo() {
  return (
    <p className="pie-de-la-app__texto">
      ¿Algo técnico no funciona? Puedes llamar al equipo de VSD Health:{' '}
      {EQUIPO.map((persona, indice) => (
        <span key={persona.telefono}>
          {indice > 0 && ' · '}
          <a
            className="pie-de-la-app__telefono"
            href={`tel:${persona.telefono}`}
            aria-label={`Llamar a ${persona.nombreCorto}, del equipo, por un problema técnico`}
          >
            {persona.nombreCorto} {persona.telefonoEscrito}
          </a>
        </span>
      ))}
      . {SOLO_PROBLEMAS_TECNICOS}
    </p>
  );
}
