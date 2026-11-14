import { motion, useReducedMotion } from 'framer-motion';

import '../../../estilos/viva.css';
import { Icono } from '../../panel/Icono.tsx';

/** Hasta cuantos pasos se marcan con una rayita en la barra; con mas, se vuelve ruido. */
const MAXIMO_DE_CORTES = 12;

/**
 * El avance de la actividad, arriba (SCRUM-173): una barra gruesa que se llena paso a paso,
 * con una rayita por cada paso, «Pregunta 2 de 5» al lado y una estrella por cada paso hecho,
 * para que nadie se pierda ni se pregunte cuanto falta.
 *
 * `paso` es el que se esta haciendo (desde 1) y `hechos` los que ya se completaron: la barra
 * se llena con los hechos, y el texto dice en cual va. Cada vez que se completa uno, la barra
 * suelta un destello y la estrella sube con un rebote.
 *
 * Por defecto las estrellas cuentan pasos hechos, no aciertos: en un cuestionario no hay
 * respuestas buenas ni malas, y ninguna premia una opcion sobre otra. Un juego, donde si hay una
 * respuesta correcta, puede pasar sus aciertos en `estrellas`.
 */
export function BarraDeProgreso({
  paso,
  total,
  hechos,
  etiqueta = 'Paso',
  estrellas = hechos,
}: {
  paso: number;
  total: number;
  hechos: number;
  etiqueta?: string;
  estrellas?: number;
}) {
  const sinMovimiento = useReducedMotion() ?? false;
  const proporcion = total === 0 ? 0 : Math.min(1, hechos / total);
  const cortes = total > 1 && total <= MAXIMO_DE_CORTES ? total - 1 : 0;

  return (
    <div className="viva-progreso">
      <div
        className="viva-progreso__pista"
        role="progressbar"
        aria-label="Avance de la actividad"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={hechos}
      >
        <motion.div
          className="viva-progreso__relleno"
          initial={false}
          animate={{ width: `${String(Math.round(proporcion * 100))}%` }}
          transition={
            sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 18 }
          }
        >
          {hechos > 0 && <span key={hechos} className="viva-progreso__destello" />}
        </motion.div>

        {Array.from({ length: cortes }, (_, indice) => (
          <span
            key={indice}
            className="viva-progreso__corte"
            style={{ left: `${String(((indice + 1) / total) * 100)}%` }}
          />
        ))}
      </div>

      <div className="viva-progreso__pie">
        <p className="viva-progreso__texto">
          {etiqueta} {Math.min(paso, total)} de {total}
        </p>

        <span
          key={estrellas}
          className="viva-progreso__estrellas"
          aria-hidden="true"
          {...(estrellas > 0 ? { 'data-sube': '' } : {})}
        >
          <Icono nombre="star" tamano={15} />
          {/* El numero sale de `data-n` y no es texto: es puro adorno, y asi no se confunde con
              ningun otro numero de la pantalla. El avance lo dice la barra de arriba. */}
          <span className="viva-progreso__cuenta" data-n={estrellas} />
        </span>
      </div>
    </div>
  );
}
