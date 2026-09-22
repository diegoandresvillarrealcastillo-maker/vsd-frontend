import { motion, useReducedMotion } from 'framer-motion';

/**
 * Las horas de sueno de la ultima semana, que crecen desde abajo.
 *
 * Crecen desde la base y no aparecen de golpe porque una barra que sube se
 * lee como una cantidad que se acumula. Una que aparece entera es solo un
 * rectangulo de color.
 *
 * Los datos son de ejemplo y estan escritos a mano: esto es la portada, no el
 * panel de nadie. Se eligieron irregulares a proposito —hay una noche mala—
 * porque una semana perfecta no se parece a ninguna semana real y quien la ve
 * lo nota.
 */

interface Noche {
  readonly dia: string;
  readonly horas: number;
}

const SEMANA: readonly Noche[] = [
  { dia: 'lunes', horas: 6.5 },
  { dia: 'martes', horas: 7.2 },
  { dia: 'miércoles', horas: 8.1 },
  { dia: 'jueves', horas: 5.4 },
  { dia: 'viernes', horas: 7.6 },
  { dia: 'sábado', horas: 8.4 },
  { dia: 'domingo', horas: 7.3 },
];

/** La barra mas alta llega al techo; el resto se mide contra ella. */
const TECHO = 9;

/**
 * La media de la semana, calculada y no escrita a mano.
 *
 * La tarjeta que rodea a este grafico ensena la cifra al lado. Si se
 * escribiera aparte, bastaria con cambiar una noche para que el texto dijera
 * una cosa y las barras otra, y nadie lo notaria hasta que alguien sumara.
 */
export const MEDIA_DE_SUENO = SEMANA.reduce((suma, noche) => suma + noche.horas, 0) / SEMANA.length;

export function BarrasDeSueno({ activa = false }: { activa?: boolean }) {
  const quieto = useReducedMotion() ?? false;

  /**
   * Se arma el grupo entero de props en vez de anular cada una. Con
   * `exactOptionalPropertyTypes`, pasar `undefined` a una prop opcional no es
   * lo mismo que no pasarla.
   */
  function crecer(posicion: number) {
    if (quieto) {
      return { initial: { scaleY: 1 } } as const;
    }

    // Con el cursor encima recorre una ola: cada barra se estira un poco y
    // vuelve, una detras de otra. Es el mismo gesto de la entrada, repetido,
    // asi que la semana se vuelve a leer de izquierda a derecha.
    // Sin `as const` aqui: los fotogramas tienen que quedar como un arreglo
    // normal, porque Framer Motion los recorre y no acepta uno de solo
    // lectura. Solo la curva se fija como literal.
    if (activa) {
      return {
        initial: { scaleY: 0 },
        animate: { scaleY: [1, 1.14, 1] },
        transition: {
          duration: 1.1,
          repeat: Infinity,
          repeatDelay: 0.35,
          ease: 'easeInOut' as const,
          delay: posicion * 0.07,
        },
      };
    }

    return {
      initial: { scaleY: 0 },
      whileInView: { scaleY: 1 },
      viewport: { once: true, amount: 0.6 },
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 26,
        // Una detras de otra, muy justo: lo que se busca es que la semana
        // se lea de izquierda a derecha, no siete animaciones seguidas.
        delay: posicion * 0.06,
      },
    } as const;
  }

  return (
    <div className="metrica__lienzo">
      <div
        className="sueno"
        role="img"
        aria-label={`Horas de sueño de la semana: ${SEMANA.map(
          (noche) => `${noche.dia}, ${noche.horas.toFixed(1)} horas`,
        ).join('; ')}. Media de ${MEDIA_DE_SUENO.toFixed(1)} horas.`}
      >
        {SEMANA.map((noche, posicion) => (
          <motion.span
            key={noche.dia}
            className="sueno__barra"
            style={{ height: `${(noche.horas / TECHO) * 100}%` }}
            {...crecer(posicion)}
          />
        ))}
      </div>
    </div>
  );
}
