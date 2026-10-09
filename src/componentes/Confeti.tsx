import { motion, useReducedMotion } from 'framer-motion';

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
  readonly caida: number;
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
      caida: 40 + azar(indice + 5) * 120,
      giro: lado * (180 + azar(indice + 6) * 540),
      duracion: 1.5 + azar(indice + 7) * 0.9,
      retraso: azar(indice + 8) * 0.18,
    };
  });
}

/** Las piezas no cambian: salen siempre del mismo generador. */
const PIEZAS = generarLasPiezas();

export function Confeti({ alTerminar }: { alTerminar?: () => void }) {
  const sinMovimiento = useReducedMotion() ?? false;

  if (sinMovimiento) {
    return null;
  }

  // La que mas tarda avisa de que termino, para quitar el confeti del arbol.
  const ultima = PIEZAS.reduce((mayor, una) =>
    una.duracion + una.retraso > mayor.duracion + mayor.retraso ? una : mayor,
  );

  return (
    <span className="confeti" aria-hidden="true">
      {PIEZAS.map((pieza) => (
        <motion.span
          key={pieza.indice}
          className={`confeti__pieza${pieza.redonda ? ' confeti__pieza--redonda' : ''}`}
          style={{
            width: pieza.tamano,
            height: pieza.redonda ? pieza.tamano : pieza.tamano * 0.5,
            background: pieza.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{
            x: [0, pieza.dx * 0.7, pieza.dx],
            y: [0, pieza.alto, pieza.alto + pieza.caida + 120],
            opacity: [1, 1, 0],
            rotate: pieza.giro,
            scale: [0.6, 1, 0.9],
          }}
          transition={{
            duration: pieza.duracion,
            delay: pieza.retraso,
            ease: 'easeOut',
            times: [0, 0.45, 1],
          }}
          {...(pieza === ultima && alTerminar !== undefined
            ? { onAnimationComplete: () => alTerminar() }
            : {})}
        />
      ))}
    </span>
  );
}
