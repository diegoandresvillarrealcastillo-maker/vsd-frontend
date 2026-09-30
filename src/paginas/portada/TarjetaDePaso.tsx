import { motion, useReducedMotion } from 'framer-motion';

import { ACOMPANADO } from '../../estilos/movimiento.ts';

/**
 * Uno de los tres pasos de "Cómo funciona".
 *
 * Reacciona como las tarjetas de métricas, pero con menos recorrido: son más
 * pequeñas y están más juntas, y el mismo desplazamiento que allí se siente
 * bien aquí se sentiría brusco.
 *
 * El número crece un poco más que la tarjeta. Es el ancla visual del paso —lo
 * primero que se mira— y que se adelante medio paso es lo que hace que el
 * conjunto se lea como una pieza con profundidad y no como un rectángulo que
 * escala.
 *
 * La variante se declara en la tarjeta y Framer Motion la propaga al número:
 * por eso el número no necesita saber nada del cursor.
 *
 * Como las tarjetas de métricas, no recibe el foco: no lleva a ningún sitio ni
 * hace nada, y darle una parada de tabulación sería añadir una pausa muda para
 * quien navega con teclado. Nada de lo que dice depende del movimiento.
 */

interface Props {
  readonly numero: number;
  readonly titulo: string;
  readonly texto: string;
}

export function TarjetaDePaso({ numero, titulo, texto }: Props) {
  const quieto = useReducedMotion() ?? false;

  const reaccion = quieto
    ? {}
    : {
        whileHover: 'activa',
        variants: { activa: { y: -5, scale: 1.02 } },
        transition: ACOMPANADO,
      };

  return (
    <motion.article className="paso" {...reaccion}>
      <motion.p className="paso__numero" variants={{ activa: { scale: 1.12 } }}>
        {numero}
      </motion.p>

      <h3 className="paso__titulo">{titulo}</h3>
      <p className="paso__texto">{texto}</p>
    </motion.article>
  );
}
