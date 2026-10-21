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
export function EscaleraDeHitos({ escalera }: { escalera: readonly HitoDeLaEscalera[] }) {
  if (escalera.length === 0) {
    return null;
  }

  return (
    <ol className="racha-escalera" aria-label="Hitos de tu racha">
      {escalera.map(({ dias, logrado }) => (
        <li
          key={dias}
          className={`racha-escalera__hito racha-escalera__hito--${logrado ? 'logrado' : 'por-lograr'}`}
        >
          <span className="racha-escalera__marca" aria-hidden="true">
            <Icono nombre={logrado ? 'check' : 'lock'} tamano={16} />
          </span>

          <span className="racha-escalera__nombre">
            {nombreDelHito(dias)}
            <span className="racha-escalera__dias">{` · ${String(dias)} días`}</span>
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
      ))}
    </ol>
  );
}
