import type { CSSProperties } from 'react';

import '../../../estilos/viva.css';

/**
 * Una docena de chispas que salen disparadas desde el centro de su contenedor y se desvanecen
 * (SCRUM-173). Es el «¡plop!» de elegir una opcion o de dar con una pareja.
 *
 * Es de un solo uso: al montarse se disparan, y al terminar quedan invisibles. Para repetirlas
 * basta con volver a montar el componente (con otra `key`). Las direcciones salen de una tabla
 * fija —no del azar—, asi que pintarlo dos veces dice lo mismo y las pruebas no dependen de la
 * suerte. Todo es CSS: cuesta nada, y con `prefers-reduced-motion` quedan invisibles.
 *
 * El contenedor tiene que ser `position: relative`; las chispas salen de su centro.
 */

const CANTIDAD = 12;

const VECTORES = Array.from({ length: CANTIDAD }, (_, indice) => {
  const angulo = (indice / CANTIDAD) * Math.PI * 2 + 0.3;
  const distancia = 52 + (indice % 3) * 18;

  return {
    dx: Math.round(Math.cos(angulo) * distancia),
    dy: Math.round(Math.sin(angulo) * distancia),
    giro: 90 + (indice % 4) * 70,
  };
});

export function Chispas({ alcance = 1 }: { alcance?: number }) {
  return (
    <span className="viva-chispas" aria-hidden="true">
      {VECTORES.map(({ dx, dy, giro }, indice) => (
        <i
          key={indice}
          style={
            {
              '--dx': `${String(Math.round(dx * alcance))}px`,
              '--dy': `${String(Math.round(dy * alcance))}px`,
              '--giro': `${String(giro)}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
