import '../estilos/racha-panel.css';
import type { HitoDeLaEscalera } from '../infraestructura/api/racha.ts';
import { Icono } from '../paginas/panel/Icono.tsx';
import { nombreDelHito, queCambiaEn } from './hitos.ts';

/**
 * La escalera de hitos del panel (SCRUM-243): los que ya se lograron, iluminados, y los que siguen,
 * con candado y lo que cambia en cada uno. Asi la persona ve que hay despues de lo de hoy.
 *
 * Los textos no llevan genero hacia quien lee («Ya llegaste») y lo que antes era color ahora tambien
 * es texto, para el lector de pantalla. Sin escalera (un servidor viejo) no pinta nada.
 */

/** Un hito: su marca, su nombre (con los dias, si el nombre no los dice) y lo que cambia o que ya llego. */
function Hito({ dias, logrado }: HitoDeLaEscalera) {
  const nombre = nombreDelHito(dias);
  // «Cien días» ya dice los dias; «Dos semanas» o «Un mes», no: ahi se suman.
  const diceLosDias = nombre.includes('días');

  return (
    <li
      className={`racha-escalera__hito racha-escalera__hito--${logrado ? 'logrado' : 'por-lograr'}`}
    >
      <span className="racha-escalera__marca" aria-hidden="true">
        <Icono nombre={logrado ? 'check' : 'lock'} tamano={16} />
      </span>

      <span className="racha-escalera__nombre">
        {nombre}
        {!diceLosDias && <span className="racha-escalera__dias">{` · ${String(dias)} días`}</span>}
      </span>

      <span className="racha-escalera__texto">
        {logrado ? (
          'Ya llegaste'
        ) : (
          <>
            <span className="solo-lectores">Por llegar. </span>
            {queCambiaEn(dias)}
          </>
        )}
      </span>
    </li>
  );
}

export function EscaleraDeHitos({
  escalera,
  nombre = 'Hitos de tu racha',
}: {
  escalera: readonly HitoDeLaEscalera[];
  /** El nombre de la lista: cambia cuando hay dos en la misma pantalla (lo que viene y lo logrado). */
  nombre?: string;
}) {
  if (escalera.length === 0) {
    return null;
  }

  return (
    <ol className="racha-escalera" aria-label={nombre}>
      {escalera.map(({ dias, logrado }) => (
        <Hito key={dias} dias={dias} logrado={logrado} />
      ))}
    </ol>
  );
}
