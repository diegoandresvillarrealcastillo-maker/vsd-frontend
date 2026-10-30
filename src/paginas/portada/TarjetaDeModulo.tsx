import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';

import { ACOMPANADO } from '../../estilos/movimiento.ts';
import type { Modulo } from '../../infraestructura/api/cuenta.ts';
import { Icono } from '../panel/Icono.tsx';
import { MODULOS } from '../panel/modulos.ts';

/**
 * Una de las tres tarjetas de «Qué hace»: un modulo de la aplicacion (SCRUM-313).
 *
 * El nombre, la frase y el icono son los de `MODULOS`, los mismos que ve la persona al elegir sus
 * modulos y en su panel: la portada no tiene palabras propias para describirlos, y asi no se separa
 * de lo que la aplicacion hace.
 *
 * ---------------------------------------------------------------------------
 * Por que la tarjeta sabe si el cursor esta encima
 * ---------------------------------------------------------------------------
 *
 * Se levanta un poco al pasar el cursor y toma el color de su modulo en el borde. El estado va en
 * React y no en variantes heredadas de Framer Motion porque la entrada de cada bloque ya usa
 * `whileInView`, y mezclar las dos cosas deja la animacion de entrada a medias.
 *
 * ---------------------------------------------------------------------------
 * Por que no recibe el foco
 * ---------------------------------------------------------------------------
 *
 * La tarjeta no es un control: no lleva a ningun sitio ni hace nada. Darle un `tabIndex` la
 * convertiria en una parada muda para quien navega con teclado. Todo lo que dice esta escrito; el
 * movimiento no anade informacion.
 */

interface Props {
  readonly modulo: Modulo;
  /** Nombres de actividades del catalogo publicado. */
  readonly actividades: readonly string[];
}

export function TarjetaDeModulo({ modulo, actividades }: Props) {
  const quieto = useReducedMotion() ?? false;
  const [activa, setActiva] = useState(false);
  const datos = MODULOS[modulo];

  // Con movimiento reducido la tarjeta no se mueve, pero el borde sí cambia de color.
  const levantarse = quieto
    ? {}
    : {
        animate: { y: activa ? -6 : 0, scale: activa ? 1.015 : 1 },
        transition: ACOMPANADO,
      };

  return (
    <motion.article
      className={`modulo-portada modulo-portada--${modulo}${activa ? ' modulo-portada--activa' : ''}`}
      onHoverStart={() => setActiva(true)}
      onHoverEnd={() => setActiva(false)}
      {...levantarse}
    >
      <span className="modulo-portada__icono">
        <Icono nombre={datos.icono} tamano={24} />
      </span>

      <h3 className="modulo-portada__titulo">{datos.titulo}</h3>
      <p className="modulo-portada__texto">{datos.descripcion}</p>

      <ul className="modulo-portada__actividades">
        {actividades.map((actividad) => (
          <li key={actividad}>{actividad}</li>
        ))}
      </ul>
    </motion.article>
  );
}
