import type { CSSProperties } from 'react';

import '../estilos/racha-celebracion.css';

/**
 * Los adornos de la celebracion de la racha (SCRUM-243): chispas, fuegos artificiales, una lluvia de
 * estrellas, la orbita de la llama y la estrella dorada.
 *
 * Todos son decorativos (`aria-hidden`) y se dibujan con CSS: solo mueven `transform` y `opacity`.
 * Las posiciones salen de tablas fijas y no de `Math.random()`, asi pintar dos veces lo mismo da lo
 * mismo y las pruebas no dependen del azar.
 */

type ConVariables = CSSProperties & Record<`--${string}`, string | number>;

/**
 * Un estallido de chispas que sale del centro de su contenedor y se abre en todas direcciones.
 * `alcance` escala hasta donde llegan; `retraso`, cuando salen (en segundos).
 */
export function Estallido({
  cantidad = 14,
  alcance = 1,
  retraso = 0,
  posicion,
}: {
  cantidad?: number;
  alcance?: number;
  retraso?: number;
  /** Donde sale, si no es el centro del contenedor: porcentajes. */
  posicion?: { x: number; y: number };
}) {
  const estilo: ConVariables = { '--retraso': `${String(retraso)}s` };

  if (posicion !== undefined) {
    estilo.left = `${String(posicion.x)}%`;
    estilo.top = `${String(posicion.y)}%`;
  }

  return (
    <span className="racha-celebracion__estallido" aria-hidden="true" style={estilo}>
      {Array.from({ length: cantidad }, (_, indice) => {
        const angulo = (indice / cantidad) * Math.PI * 2 + 0.3;
        const distancia = (54 + (indice % 3) * 20) * alcance;
        const particula: ConVariables = {
          '--dx': `${String(Math.round(Math.cos(angulo) * distancia))}px`,
          '--dy': `${String(Math.round(Math.sin(angulo) * distancia))}px`,
          '--giro': `${String(90 + (indice % 4) * 70)}deg`,
        };

        return <i key={indice} style={particula} />;
      })}
    </span>
  );
}

/** Donde y cuando sale cada fuego artificial: arriba, a los lados del titulo, a destiempo. */
const FUEGOS = [
  { x: 18, y: 16, retraso: 1.6 },
  { x: 82, y: 22, retraso: 2.3 },
  { x: 50, y: 8, retraso: 3.1 },
] as const;

/** Fuegos artificiales que se repiten con calma mientras la celebracion esta abierta. */
export function FuegosArtificiales() {
  return (
    <span className="racha-celebracion__fuegos" aria-hidden="true">
      {FUEGOS.map(({ x, y, retraso }) => (
        <Estallido key={x} cantidad={16} alcance={1.5} retraso={retraso} posicion={{ x, y }} />
      ))}
    </span>
  );
}

/** De donde cae cada estrella de la lluvia, y a que ritmo. */
const ESTRELLAS = [
  { x: 6, tam: 12, dur: 7.2, ret: 0.4 },
  { x: 14, tam: 9, dur: 8.4, ret: 3.1 },
  { x: 23, tam: 14, dur: 6.8, ret: 1.2 },
  { x: 31, tam: 10, dur: 9.0, ret: 4.6 },
  { x: 40, tam: 13, dur: 7.6, ret: 2.2 },
  { x: 48, tam: 9, dur: 8.8, ret: 5.4 },
  { x: 57, tam: 12, dur: 7.0, ret: 0.9 },
  { x: 64, tam: 15, dur: 8.2, ret: 3.8 },
  { x: 72, tam: 10, dur: 6.6, ret: 1.7 },
  { x: 80, tam: 13, dur: 9.2, ret: 4.1 },
  { x: 88, tam: 9, dur: 7.4, ret: 2.7 },
  { x: 95, tam: 12, dur: 8.0, ret: 5.0 },
] as const;

/** Una lluvia de estrellitas doradas que cae despacio por detras de todo. */
export function LluviaDeChispas() {
  return (
    <span className="racha-celebracion__lluvia" aria-hidden="true">
      {ESTRELLAS.map(({ x, tam, dur, ret }) => {
        const estrella: ConVariables = {
          '--x': `${String(x)}%`,
          '--tam': `${String(tam)}px`,
          '--dur': `${String(dur)}s`,
          '--ret': `${String(ret)}s`,
        };

        return <i key={x} style={estrella} />;
      })}
    </span>
  );
}

/** Tres puntos de luz que giran alrededor de la llama. */
export function OrbitaDeChispas() {
  return (
    <span className="racha-celebracion__orbita" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** La estrella dorada del ano: cuatro puntas que giran muy despacio y respiran. */
export function EstrellaDorada() {
  return (
    <svg
      className="racha-celebracion__estrella"
      viewBox="0 0 24 24"
      width="56"
      height="56"
      aria-hidden="true"
    >
      <path d="m12 0 2.2 8.1L22 10.2l-7.8 2.1L12 24l-2.2-11.7L2 10.2l7.8-2.1Z" />
    </svg>
  );
}
