import { useReducedMotion } from 'framer-motion';
import { useState, type CSSProperties } from 'react';

import '../estilos/confeti.css';

/**
 * Un chorro corto de confeti para celebrar algo que la persona logro (SCRUM-170).
 *
 * Es suave a proposito: unas treinta piezas, con los colores de la aplicacion, que suben,
 * se abren y caen en un par de segundos. No suena, no tapa nada y no recibe clics.
 *
 * Con `prefers-reduced-motion` no pinta nada: la celebracion sigue estando en el resto de
 * la pantalla (el punto lleno, el mensaje), y quien pidio menos movimiento no tiene que
 * ver piezas volando.
 *
 * Se mueve solo con CSS (`transform` y `opacity`, que van por la tarjeta grafica): sin
 * JavaScript por cuadro. Cada pieza lleva sus numeros en variables (`--dx`, `--alto`...), y
 * `confeti.css` dibuja el vuelo. El padre tiene que ser `position: relative`: el chorro
 * sale de su centro. Al terminar la ultima pieza, el confeti se quita solo del arbol.
 *
 * Las piezas salen de un generador con semilla y no de `Math.random()`: pintar dos veces
 * lo mismo da lo mismo, y las pruebas no dependen del azar.
 */
const COLORES = [
  'var(--app-bienestar-acento, var(--vital))',
  'var(--app-cognicion-acento, var(--dato))',
  'var(--app-emociones-acento, var(--pulso))',
  'var(--app-avatar-tinta, var(--acento-claro))',
  'var(--app-salvia, var(--acento))',
];

const CANTIDAD = 30;

/** Un numero entre 0 y 1 que depende solo de la semilla. */
function azar(semilla: number): number {
  const valor = Math.sin(semilla * 12.9898 + 78.233) * 43758.5453;

  return valor - Math.floor(valor);
}

interface Pieza {
  readonly indice: number;
  readonly color: string;
  readonly redonda: boolean;
  readonly tamano: number;
  readonly dx: number;
  readonly alto: number;
  readonly fin: number;
  readonly giro: number;
  readonly duracion: number;
  readonly retraso: number;
}

function generarLasPiezas(): readonly Pieza[] {
  return Array.from({ length: CANTIDAD }, (_, indice) => {
    const lado = indice % 2 === 0 ? 1 : -1;

    return {
      indice,
      color: COLORES[indice % COLORES.length] ?? COLORES[0] ?? 'currentColor',
      redonda: azar(indice + 1) > 0.5,
      tamano: 6 + Math.round(azar(indice + 2) * 6),
      dx: lado * (30 + azar(indice + 3) * 150),
      alto: -(90 + azar(indice + 4) * 120),
      fin: -(90 + azar(indice + 4) * 120) + 40 + azar(indice + 5) * 120 + 120,
      giro: lado * (180 + azar(indice + 6) * 540),
      duracion: 1.5 + azar(indice + 7) * 0.9,
      retraso: azar(indice + 8) * 0.18,
    };
  });
}

/** Las piezas no cambian: salen siempre del mismo generador. */
const PIEZAS = generarLasPiezas();

/** La que mas tarda avisa de que termino, para quitar el confeti del arbol. */
const ULTIMA = PIEZAS.reduce((mayor, una) =>
  una.duracion + una.retraso > mayor.duracion + mayor.retraso ? una : mayor,
);

export function Confeti() {
  const sinMovimiento = useReducedMotion() ?? false;
  const [terminado, setTerminado] = useState(false);

  if (sinMovimiento || terminado) {
    return null;
  }

  return (
    <span className="confeti" aria-hidden="true">
      {PIEZAS.map((pieza) => (
        <span
          key={pieza.indice}
          className={`confeti__pieza${pieza.redonda ? ' confeti__pieza--redonda' : ''}`}
          style={
            {
              width: pieza.tamano,
              height: pieza.redonda ? pieza.tamano : pieza.tamano * 0.5,
              background: pieza.color,
              '--dx': `${String(pieza.dx)}px`,
              '--alto': `${String(pieza.alto)}px`,
              '--fin': `${String(pieza.fin)}px`,
              '--giro': `${String(pieza.giro)}deg`,
              '--dur': `${String(pieza.duracion)}s`,
              '--retraso': `${String(pieza.retraso)}s`,
            } as CSSProperties
          }
          onAnimationEnd={pieza === ULTIMA ? () => setTerminado(true) : undefined}
        />
      ))}
    </span>
  );
}
