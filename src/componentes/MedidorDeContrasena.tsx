import { motion, useReducedMotion } from 'framer-motion';

import '../estilos/medidor.css';
import { ACOMPANADO, INMEDIATO } from '../estilos/movimiento.ts';
import { evaluarContrasena, type NivelDeFuerza } from '../sesion/reglaDeContrasena.ts';

interface Props {
  contrasena: string;
  /**
   * El id con el que el campo lo enlaza en `aria-describedby`. Asi, al entrar
   * en el campo, el lector de pantalla lee que se pide y cuanto se cumple.
   */
  id: string;
}

const POSICIONES: readonly NivelDeFuerza[] = [1, 2, 3, 4];

/**
 * Lo que se ve mientras se escribe una contrasena nueva (SCRUM-116).
 *
 * Dos cosas con trabajos distintos. Las cuatro barras dicen **cuanta fuerza
 * tiene** de un vistazo, y se llenan como un liquido en lugar de encenderse de
 * golpe. La lista dice **que falta**, y cada requisito se marca con una
 * verificacion que se traza al cumplirse.
 *
 * Lo que se anuncia no es cada pulsacion: la fuerza vive en una region con
 * `role="status"` cuyo texto solo cambia al cambiar de nivel, asi que el
 * lector de pantalla habla cuando hay algo nuevo y no mientras se teclea.
 *
 * Con "reducir movimiento" las barras y las marcas cambian sin animacion. La
 * informacion es la misma; lo que se quita es el recorrido.
 */
export function MedidorDeContrasena({ contrasena, id }: Props) {
  const sinMovimiento = useReducedMotion();
  const { requisitos, nivel, etiqueta } = evaluarContrasena(contrasena);

  const llenado = sinMovimiento ? { duration: 0 } : ACOMPANADO;
  const trazo = sinMovimiento ? { duration: 0 } : INMEDIATO;

  return (
    <div className="medidor" id={id} data-nivel={nivel}>
      <div className="medidor__barras" aria-hidden="true">
        {POSICIONES.map((posicion) => (
          <span key={posicion} className="medidor__pista">
            <motion.span
              className="medidor__barra"
              initial={false}
              animate={{ scaleX: nivel >= posicion ? 1 : 0 }}
              transition={llenado}
            />
          </span>
        ))}
      </div>

      <p className="medidor__fuerza" role="status">
        {nivel === 0 ? (
          etiqueta
        ) : (
          <>
            Seguridad: <strong>{etiqueta}</strong>
          </>
        )}
      </p>

      <ul className="medidor__lista">
        {requisitos.map((requisito) => (
          <li
            key={requisito.clave}
            className={`medidor__requisito${requisito.cumple ? ' medidor__requisito--cumplido' : ''}`}
          >
            <span className="medidor__marca" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
                <motion.path
                  d="M4 8.4 6.8 11 12 5.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{
                    pathLength: requisito.cumple ? 1 : 0,
                    opacity: requisito.cumple ? 1 : 0,
                  }}
                  transition={trazo}
                />
              </svg>
            </span>
            <span>{requisito.texto}</span>
            <span className="solo-lectores">{requisito.cumple ? ': cumplido' : ': pendiente'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
