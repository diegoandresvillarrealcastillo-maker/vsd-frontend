import { motion, useReducedMotion } from 'framer-motion';

import { ACOMPANADO } from '../../estilos/movimiento.ts';

/**
 * Tres anillos que se cierran al entrar en pantalla.
 *
 * Cada anillo es una de las tres cosas que se pueden hacer en un dia, y lo
 * que muestra es cuanto se completo de cada una. No es una nota: un anillo a
 * medias significa que quedo algo por hacer, no que el dia estuviera mal.
 *
 * El orden importa. El exterior es el que mas se ve, asi que ahi va lo que
 * cuesta menos y casi siempre se cumple; el interior es el que cuesta mas. Al
 * reves, la tarjeta ensenaria un hueco grande cada vez que se mira.
 */

/**
 * Centro y grosor del lienzo de 160x160.
 *
 * El grosor y los radios se eligen juntos: con el trazo mas ancho los tres
 * anillos se tocaban y el conjunto se leia como un disco de colores en vez de
 * como tres cosas distintas. El hueco entre uno y otro es lo que los separa.
 */
const CENTRO = 80;
const GROSOR = 11;

interface Anillo {
  readonly radio: number;
  readonly color: string;
  readonly parte: number;
  readonly nombre: string;
}

const ANILLOS: readonly Anillo[] = [
  { radio: 64, color: 'var(--pulso)', parte: 1, nombre: 'Contar cómo estás' },
  { radio: 44, color: 'var(--vital)', parte: 0.75, nombre: 'Anotar el descanso' },
  { radio: 24, color: 'var(--dato)', parte: 0.5, nombre: 'Hacer una actividad' },
];

export function AnillosDeConstancia({ activa = false }: { activa?: boolean }) {
  const quieto = useReducedMotion() ?? false;

  /**
   * Con movimiento reducido el anillo nace ya en su sitio: el dato es el
   * mismo, lo unico que se pierde es el recorrido.
   *
   * Se arma el grupo entero de props en vez de anular cada una. Con
   * `exactOptionalPropertyTypes`, pasar `undefined` a una prop opcional no es
   * lo mismo que no pasarla.
   */
  function cerrarse(parte: number) {
    return quieto
      ? ({ initial: { pathLength: parte } } as const)
      : ({
          initial: { pathLength: 0 },
          whileInView: { pathLength: parte },
          viewport: { once: true, amount: 0.6 },
          transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
        } as const);
  }

  return (
    <div className="metrica__lienzo">
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        fill="none"
        role="img"
        aria-label={`Tres anillos de progreso: ${ANILLOS.map(
          (anillo) => `${anillo.nombre}, ${Math.round(anillo.parte * 100)} por ciento`,
        ).join('; ')}.`}
      >
        {/* Se gira el lienzo entero para que los tres empiecen arriba. Girar
            cada circulo por separado obligaria a repetir la transformacion y a
            recordar el centro tres veces. */}
        <g transform={`rotate(-90 ${CENTRO} ${CENTRO})`}>
          {ANILLOS.map((anillo, posicion) => (
            /* Al pasar el cursor los tres se abren un poco y giran, uno
               detrás de otro. El de dentro crece más que el de fuera: si
               crecieran igual, el conjunto se leería como una sola pieza
               escalando, y lo que se busca es que se note que son tres. */
            <motion.g
              key={anillo.nombre}
              style={{ originX: '50%', originY: '50%' }}
              animate={
                quieto
                  ? {}
                  : {
                      scale: activa ? 1.03 + posicion * 0.025 : 1,
                      rotate: activa ? 10 : 0,
                    }
              }
              transition={{ ...ACOMPANADO, delay: activa ? posicion * 0.05 : 0 }}
            >
              {/* El canal por el que corre el anillo. Sin el, un anillo a
                  medias parece un anillo roto. */}
              <circle
                cx={CENTRO}
                cy={CENTRO}
                r={anillo.radio}
                stroke={anillo.color}
                strokeWidth={GROSOR}
                opacity={0.16}
              />

              <motion.circle
                cx={CENTRO}
                cy={CENTRO}
                r={anillo.radio}
                stroke={anillo.color}
                strokeWidth={GROSOR}
                strokeLinecap="round"
                {...cerrarse(anillo.parte)}
              />
            </motion.g>
          ))}
        </g>
      </svg>
    </div>
  );
}
