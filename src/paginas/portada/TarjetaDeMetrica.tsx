import { motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';

import { ACOMPANADO } from '../../estilos/movimiento.ts';

/**
 * Una de las tres tarjetas de "Lo que ves cada día".
 *
 * ---------------------------------------------------------------------------
 * Por qué la tarjeta sabe si el cursor está encima
 * ---------------------------------------------------------------------------
 *
 * El dibujo de dentro reacciona junto con la tarjeta: la línea del ánimo
 * recorre un pulso, los anillos giran, las barras hacen una ola. Para eso el
 * dibujo tiene que enterarse de algo que ocurre en su contenedor.
 *
 * Se resuelve pasándole el estado como argumento en lugar de con variantes
 * heredadas de Framer Motion. Las variantes se propagan a los hijos, sí, pero
 * estos dibujos ya usan `whileInView` para su entrada, y mezclar las dos cosas
 * deja la animación de entrada a medias en cuanto pasa el cursor.
 *
 * ---------------------------------------------------------------------------
 * Por qué no recibe el foco
 * ---------------------------------------------------------------------------
 *
 * La tarjeta no es un control: no lleva a ningún sitio ni hace nada. Darle un
 * `tabIndex` la convertiría en una parada muda para quien navega con teclado.
 *
 * Que la reacción sea solo de cursor no esconde nada: todo lo que la tarjeta
 * dice está escrito, y el movimiento no añade información.
 */

interface Props {
  readonly etiqueta: string;
  readonly titulo: ReactNode;
  readonly texto: string;
  /** El dibujo. Recibe si el cursor está encima. */
  readonly dibujo: (activa: boolean) => ReactNode;
}

export function TarjetaDeMetrica({ etiqueta, titulo, texto, dibujo }: Props) {
  const quieto = useReducedMotion() ?? false;
  const [activa, setActiva] = useState(false);

  // Con movimiento reducido la tarjeta no se mueve, pero el dibujo sí cambia
  // de estado: lo que se apaga es el desplazamiento, no la reacción.
  const levantarse = quieto
    ? {}
    : {
        animate: { y: activa ? -6 : 0, scale: activa ? 1.015 : 1 },
        transition: ACOMPANADO,
      };

  return (
    <motion.article
      className={activa ? 'metrica metrica--activa' : 'metrica'}
      onHoverStart={() => setActiva(true)}
      onHoverEnd={() => setActiva(false)}
      {...levantarse}
    >
      {dibujo(activa)}

      <p className="metrica__etiqueta">{etiqueta}</p>
      <h3 className="metrica__titulo">{titulo}</h3>
      <p className="metrica__texto">{texto}</p>
    </motion.article>
  );
}
