import type { CSSProperties } from 'react';

import '../estilos/fungito-abogado.css';
import { sprite } from './sprites.ts';

/**
 * Fungito, con traje y gafas oscuras, haciendo de abogado (SCRUM-189).
 *
 * Es para la pantalla de quien resulta menor de 18 años: alguien que quizá buscó ayuda y se
 * encuentra con una regla. Un personaje que explica «es una regla, no un reproche» lo dice con
 * más calidez que un párrafo.
 *
 * ## Cómo está hecho
 *
 * No hay un dibujo nuevo: es **el Fungito de siempre** (`fungito-normal`) con el traje y las
 * gafas dibujados encima, en capas aparte. Así no hay otro archivo que mantener ni que se pueda
 * desfasar del original, y si cambia el Fungito, el abogado lo hace con él.
 *
 * - **Las gafas** van sobre los ojos, en una capa que no se recorta.
 * - **El traje** (saco, camisa y corbata) se pinta **solo donde está Fungito**: el propio sprite
 *   hace de máscara (`mask-image`), así el saco no puede salirse de su silueta.
 *
 * Las coordenadas están en el lienzo de 256 × 256 del sprite. El arte lo aprueba una persona
 * antes de marcar listo el ticket (SCRUM-189): para cambiarlo basta con tocar los trazos de aquí.
 *
 * ## Accesibilidad
 *
 * Es **una sola imagen** con su descripción; las capas son decorativas y no se enfocan.
 */

const MARINO = '#1f2d4d';
const MARINO_CLARO = '#34497d';
const CAMISA = '#f4f1ea';
const CORBATA = '#b5342b';
const CORBATA_SOMBRA = '#8f2620';
const LENTE = '#12131c';
const BRILLO = '#7482a8';

export function FungitoAbogado({ tamano = 168 }: { tamano?: number }) {
  const base = sprite('fungito', 'normal');
  // El sprite, por una variable de CSS: la hoja de estilos lo usa de máscara para el traje.
  const estilo = {
    width: `${String(tamano)}px`,
    '--fungito-sprite': `url("${base}")`,
  } as CSSProperties;

  return (
    <span
      className="fungito-abogado"
      role="img"
      aria-label="Fungito, de traje y con gafas oscuras, haciendo de abogado"
      style={estilo}
    >
      <img className="fungito-abogado__base" src={base} alt="" draggable={false} />

      <span className="fungito-abogado__traje">
        <svg viewBox="0 0 256 256" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          {/* El saco: cubre el cuerpo y los brazos, desde debajo de la boca hasta antes de las patas. */}
          <rect x="56" y="172" width="148" height="56" fill={MARINO} />
          {/* La camisa, en uve, y las solapas. */}
          <polygon points="112,172 144,172 128,212" fill={CAMISA} />
          <polygon points="108,172 116,172 128,200 120,176" fill={MARINO_CLARO} />
          <polygon points="140,172 148,172 136,176 128,200" fill={MARINO_CLARO} />
          {/* La corbata: nudo y cuerpo. */}
          <rect x="123" y="176" width="10" height="8" fill={CORBATA} />
          <polygon points="121,184 135,184 138,208 128,218 118,208" fill={CORBATA} />
          <polygon points="128,184 135,184 138,208 128,218" fill={CORBATA_SOMBRA} />
          {/* Un pañuelo en el bolsillo. */}
          <rect x="164" y="192" width="14" height="5" fill={CAMISA} />
        </svg>
      </span>

      <svg
        className="fungito-abogado__gafas"
        viewBox="0 0 256 256"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        {/* Los dos lentes, con las esquinas escalonadas como el resto del dibujo. */}
        <path d="M94 138h18v4h4v14h-4v4H94v-4h-4v-14h4z" fill={LENTE} />
        <path d="M144 138h18v4h4v14h-4v4h-18v-4h-4v-14h4z" fill={LENTE} />
        {/* El puente y las patillas. */}
        <rect x="116" y="143" width="24" height="5" fill={LENTE} />
        <rect x="82" y="143" width="8" height="4" fill={LENTE} />
        <rect x="166" y="143" width="8" height="4" fill={LENTE} />
        {/* Un brillo en cada lente. */}
        <rect x="97" y="142" width="6" height="4" fill={BRILLO} />
        <rect x="147" y="142" width="6" height="4" fill={BRILLO} />
      </svg>
    </span>
  );
}
