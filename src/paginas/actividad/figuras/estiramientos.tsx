import type { ReactNode } from 'react';

import { arco, flecha, flechaDoble, ondas, trazo, type Punto } from './geometria.ts';
import { frente, marca, perfil, posicionDeLaPierna, rayas, type Pierna } from './cuerpo.tsx';

/**
 * Las 48 figuras de estiramiento (SCRUM-226): seis zonas (cuello, hombros, manos, espalda, piernas y ojos) con
 * ocho gestos cada una, con la clave `zona:gesto` con la que el catalogo de Bienestar nombra el pictograma de
 * cada paso (BIE-02).
 *
 * Cada clave es una funcion que devuelve el dibujo en un lienzo de 64 x 64. Las claves son las mismas que
 * exporta el backend (`pictogramasDeEstiramiento()`, copiadas en `pictogramasDelCatalogo.json`), y una prueba
 * comprueba que estan todas, que ninguna se repite y que ningun par de gestos se dibuja igual.
 *
 * Como en un espejo, la «derecha» es la de la pantalla.
 */

function f(a: Punto, b: Punto, llave: string): ReactNode {
  return marca(flecha(a, b), llave);
}

// ---------------------------------------------------------------------------
// Las manos: dibujos de cerca
// ---------------------------------------------------------------------------

/** Una mano abierta con los dedos hacia arriba; `abre` separa los dedos. */
function mano(cx: number, cy: number, abre = 2.4): ReactNode {
  const dedos = [-1.5, -0.5, 0.5, 1.5].map((lugar, i) => {
    const largo = [9, 12, 12.5, 10][i] ?? 10;
    const base: Punto = [cx + lugar * 3.4, cy - 1];
    const punta: Punto = [cx + lugar * 3.4 + lugar * abre, cy - 1 - largo];

    return <path key={lugar} className="fig-dedo" d={trazo(base, punta)} />;
  });

  return (
    <g key={`mano-${String(cx)}-${String(cy)}`}>
      <rect x={cx - 7.2} y={cy - 2} width="14.4" height="14" rx="5" />
      {dedos}
      <path d={trazo([cx - 7, cy + 8], [cx - 12.5, cy + 2.5])} className="fig-dedo" />
    </g>
  );
}

/** Un puno: un bloque redondeado con los nudillos marcados. */
function puno(cx: number, cy: number): ReactNode {
  return (
    <g key={`puno-${String(cx)}-${String(cy)}`}>
      <rect x={cx - 8} y={cy - 5} width="16" height="16" rx="6" />
      <path d={trazo([cx - 4, cy - 5], [cx - 4, cy + 1])} />
      <path d={trazo([cx, cy - 5], [cx, cy + 1])} />
      <path d={trazo([cx + 4, cy - 5], [cx + 4, cy + 1])} />
    </g>
  );
}

/** Las palmas juntas, de canto. */
function palma(cx: number, cy: number, ancho = 6): ReactNode {
  return (
    <rect
      key={`palma-${String(cx)}`}
      x={cx - ancho / 2}
      y={cy - 14}
      width={ancho}
      height="28"
      rx="3"
    />
  );
}

// ---------------------------------------------------------------------------
// Los ojos: dibujos de cerca
// ---------------------------------------------------------------------------

/** Hacia donde mira el ojo: -1 a 1 en horizontal y en vertical. */
type Mirada = readonly [horizontal: number, vertical: number];

function ojo(
  cx: number,
  cy: number,
  mirada: Mirada = [0, 0],
  estado: 'abierto' | 'cerrado' = 'abierto',
): ReactNode {
  if (estado === 'cerrado') {
    return (
      <g key={`ojo-${String(cx)}`}>
        <path
          d={`M${String(cx - 11)} ${String(cy - 1)} Q${String(cx)} ${String(cy + 8)} ${String(cx + 11)} ${String(cy - 1)}`}
        />
        <path d={trazo([cx - 7, cy + 3], [cx - 9, cy + 7])} />
        <path d={trazo([cx, cy + 5], [cx, cy + 9.5])} />
        <path d={trazo([cx + 7, cy + 3], [cx + 9, cy + 7])} />
      </g>
    );
  }

  return (
    <g key={`ojo-${String(cx)}`}>
      <ellipse cx={cx} cy={cy} rx="11" ry="7" />
      <circle cx={cx + mirada[0] * 4.5} cy={cy + mirada[1] * 3} r="3.6" className="fig-relleno" />
    </g>
  );
}

const MONTANA = 'M22 14 L29 5 L33 10 L36 7 L42 14 Z';

// ---------------------------------------------------------------------------
// Las 48
// ---------------------------------------------------------------------------

const unidos = (...partes: ReactNode[]): ReactNode => <g>{partes}</g>;

export const FIGURAS_DE_ESTIRAMIENTO: Readonly<Record<string, () => ReactNode>> = {
  // --- Cuello ---------------------------------------------------------------
  'cuello:inclinar-der': () =>
    frente({ cabeza: { inclina: 24 }, marcas: [marca(arco([32, 11], 11, 255, 305), 'a')] }),
  'cuello:inclinar-izq': () =>
    frente({ cabeza: { inclina: -24 }, marcas: [marca(arco([32, 11], 11, 285, 235), 'a')] }),
  'cuello:girar-der': () => frente({ cabeza: { gira: 1 }, marcas: [f([42, 10], [54, 10], 'a')] }),
  'cuello:girar-izq': () => frente({ cabeza: { gira: -1 }, marcas: [f([22, 10], [10, 10], 'a')] }),
  'cuello:bajar': () => frente({ cabeza: { baja: 1 }, marcas: [f([48, 6], [48, 16], 'a')] }),
  'cuello:alargar': () =>
    frente({
      cabeza: { sube: 2 },
      marcas: [f([48, 18], [48, 5], 'a'), f([16, 18], [16, 5], 'b')],
    }),
  'cuello:soltar': () =>
    frente({
      cabeza: { baja: 0.6 },
      hombros: { i: 2, d: 2 },
      marcas: [f([13, 20], [13, 29], 'a'), f([51, 20], [51, 29], 'b')],
    }),
  'cuello:respirar': () =>
    frente({
      marcas: [marca(arco([32, 31], 7, 205, 335), 'a'), marca(arco([32, 31], 12, 210, 330), 'b')],
    }),

  // --- Hombros --------------------------------------------------------------
  'hombros:subir': () =>
    frente({
      hombros: { i: -4, d: -4 },
      marcas: [f([15, 17], [15, 9], 'a'), f([49, 17], [49, 9], 'b')],
    }),
  'hombros:circulo-atras': () =>
    frente({
      hombros: { i: -1, d: -1 },
      marcas: [marca(arco([48, 18], 6, 40, -270), 'a'), marca(arco([16, 18], 6, 140, 450), 'b')],
    }),
  'hombros:circulo-adelante': () =>
    frente({
      hombros: { i: -1, d: -1 },
      marcas: [marca(arco([48, 18], 6, -130, 180), 'a'), marca(arco([16, 18], 6, 310, 0), 'b')],
    }),
  'hombros:juntar': () =>
    frente({
      brazoI: [-75, -175],
      brazoD: [75, 175],
      marcas: [f([6, 28], [16, 28], 'a'), f([58, 28], [48, 28], 'b')],
    }),
  'hombros:abrazo': () =>
    frente({
      brazoI: [28, 72],
      brazoD: [-28, -72],
      marcas: [f([11, 34], [19, 34], 'a'), f([53, 34], [45, 34], 'b')],
    }),
  'hombros:cruzar-der': () =>
    frente({
      brazoD: [-48, -82],
      brazoI: [35, 140],
      marcas: [f([52, 32], [43, 32], 'a')],
    }),
  'hombros:cruzar-izq': () =>
    frente({
      brazoI: [48, 82],
      brazoD: [-35, -140],
      marcas: [f([12, 32], [21, 32], 'a')],
    }),
  'hombros:abrir': () =>
    frente({
      brazoI: [-82, -82],
      brazoD: [82, 82],
      marcas: [f([22, 30], [12, 30], 'a'), f([42, 30], [52, 30], 'b')],
    }),

  // --- Manos ----------------------------------------------------------------
  'manos:circulo': () => unidos(mano(32, 30), marca(arco([32, 44], 10, 20, 330), 'a')),
  'manos:palma-arriba': () =>
    unidos(
      <g key="m" transform="rotate(90 32 36)">
        {mano(32, 36)}
      </g>,
      f([30, 30], [30, 16], 'a'),
    ),
  'manos:palma-abajo': () =>
    unidos(
      <g key="m" transform="rotate(90 32 28)">
        {mano(32, 28)}
      </g>,
      f([34, 40], [34, 54], 'a'),
    ),
  'manos:abrir-cerrar': () =>
    unidos(mano(18, 32), puno(46, 30), marca(flechaDoble([20, 54], [44, 54]), 'a')),
  'manos:dedos': () =>
    unidos(
      mano(32, 42, 5),
      f([32, 24], [32, 14], 'a'),
      f([22, 28], [16, 20], 'b'),
      f([42, 28], [48, 20], 'c'),
    ),
  'manos:oracion': () =>
    unidos(palma(29, 32), palma(35, 32), f([12, 36], [24, 36], 'a'), f([52, 36], [40, 36], 'b')),
  'manos:sacudir': () => unidos(mano(32, 36), rayas(ondas([32, 34], 14), 'a')),
  'manos:presionar': () =>
    unidos(
      palma(23, 34, 8),
      palma(41, 34, 8),
      f([6, 34], [18, 34], 'a'),
      f([58, 34], [46, 34], 'b'),
    ),

  // --- Espalda --------------------------------------------------------------
  'espalda:alargar': () => perfil({ brazoA: [165, 172], marcas: [f([46, 16], [46, 3], 'a')] }),
  'espalda:torcer-der': () =>
    frente({
      torso: { gira: 1 },
      cabeza: { gira: 1 },
      brazoD: [40, 120],
      marcas: [marca(arco([32, 34], 13, 205, 340), 'a')],
    }),
  'espalda:torcer-izq': () =>
    frente({
      torso: { gira: 1 },
      cabeza: { gira: -1 },
      brazoI: [-40, -120],
      marcas: [marca(arco([32, 34], 13, 335, 200), 'a')],
    }),
  'espalda:redondear': () =>
    perfil({
      torso: { inclina: 16, curva: -7 },
      cabeza: 30,
      brazoA: [55, 85],
      marcas: [f([20, 26], [9, 26], 'a')],
    }),
  'espalda:arco': () =>
    perfil({
      torso: { inclina: -6, curva: 6 },
      cabeza: -14,
      brazoA: [-25, -70],
      marcas: [f([32, 28], [43, 28], 'a')],
    }),
  'espalda:inclinar-der': () =>
    frente({
      torso: { inclina: 16 },
      brazoI: [168, 174],
      brazoD: [10, 4],
      marcas: [f([42, 8], [54, 14], 'a')],
    }),
  'espalda:inclinar-izq': () =>
    frente({
      torso: { inclina: -16 },
      brazoD: [-168, -174],
      brazoI: [-10, -4],
      marcas: [f([22, 8], [10, 14], 'a')],
    }),
  'espalda:adelante': () =>
    perfil({
      torso: { inclina: 52 },
      cabeza: 24,
      brazoA: [18, 0],
      marcas: [f([36, 24], [44, 34], 'a')],
    }),

  // --- Piernas --------------------------------------------------------------
  'piernas:tobillos': () => {
    const pierna: Pierna = [88, 35, 20];
    const { tobillo } = posicionDeLaPierna(pierna);

    return perfil({
      piernaA: pierna,
      marcas: [marca(arco([tobillo[0] + 5, tobillo[1] + 2], 5.5, 30, 340), 'a')],
    });
  },
  'piernas:estirar': () => perfil({ piernaA: [90, 88, 55], marcas: [f([50, 40], [60, 40], 'a')] }),
  'piernas:punta-talon': () =>
    perfil({
      piernaA: [90, 0, 45],
      piernaB: [90, 0, -45],
      marcas: [marca(flechaDoble([38, 58], [50, 58]), 'a')],
    }),
  'piernas:marchar': () =>
    perfil({
      piernaA: [112, 12, 0],
      piernaB: [90, 0, 0],
      marcas: [f([40, 34], [40, 24], 'a')],
    }),
  'piernas:empujar': () =>
    perfil({
      piernaA: [90, 0, 0],
      marcas: [f([46, 44], [46, 54], 'a'), f([52, 44], [52, 54], 'b')],
    }),
  'piernas:cruzar': () =>
    perfil({
      piernaA: [100, -55, 20],
      piernaB: [90, 0, 0],
      marcas: [f([36, 30], [36, 40], 'a')],
    }),
  'piernas:pantorrillas': () =>
    perfil({
      piernaA: [90, 0, -70],
      piernaB: [90, 0, -70],
      marcas: [f([38, 54], [38, 46], 'a')],
    }),
  'piernas:sacudir': () => {
    const pierna: Pierna = [90, 55, 0];
    const { tobillo } = posicionDeLaPierna(pierna);

    return perfil({
      piernaA: pierna,
      marcas: [rayas(ondas([tobillo[0] + 3, tobillo[1] + 1], 5), 'a')],
    });
  },

  // --- Ojos -----------------------------------------------------------------
  'ojos:lejos': () =>
    unidos(<path key="m" d={MONTANA} />, ojo(17, 38), ojo(47, 38), f([32, 34], [32, 22], 'a')),
  'ojos:cerca-lejos': () =>
    unidos(
      <path key="m" d={MONTANA} transform="translate(-4 0)" />,
      ojo(15, 32),
      ojo(41, 32),
      <path key="d" d={trazo([28, 60], [28, 49])} />,
      <circle key="p" cx="28" cy="47" r="2.6" className="fig-relleno" />,
      marca(flechaDoble([58, 46], [58, 16]), 'a'),
    ),
  'ojos:parpadear': () =>
    unidos(
      ojo(17, 30, [0, 0], 'cerrado'),
      ojo(47, 30, [0, 0], 'cerrado'),
      rayas('M30 10 h6 M33 7 v6 M8 50 h5 M10.500 47.500 v5 M52 52 h5 M54.500 49.500 v5', 'a'),
    ),
  'ojos:arriba-abajo': () =>
    unidos(ojo(17, 32, [0, -1]), ojo(47, 32, [0, -1]), marca(flechaDoble([32, 12], [32, 52]), 'a')),
  'ojos:der-izq': () =>
    unidos(ojo(17, 28, [1, 0]), ojo(47, 28, [1, 0]), marca(flechaDoble([8, 50], [56, 50]), 'a')),
  'ojos:palmas': () =>
    unidos(
      <g key="i">
        <rect x="5" y="20" width="24" height="26" rx="11" />
        <path d={trazo([11, 21], [11, 14])} />
        <path d={trazo([17, 20], [17, 12])} />
        <path d={trazo([23, 21], [23, 14])} />
      </g>,
      <g key="d">
        <rect x="35" y="20" width="24" height="26" rx="11" />
        <path d={trazo([41, 21], [41, 14])} />
        <path d={trazo([47, 20], [47, 12])} />
        <path d={trazo([53, 21], [53, 14])} />
      </g>,
      rayas('M28 52 Q32 55 36 52', 'a'),
    ),
  'ojos:circulo': () =>
    unidos(
      ojo(17, 32, [1, -1]),
      ojo(47, 32, [1, -1]),
      marca(arco([17, 32], 14, 30, 330), 'a'),
      marca(arco([47, 32], 14, 30, 330), 'b'),
    ),
  'ojos:cerrar': () =>
    unidos(
      ojo(17, 34, [0, 0], 'cerrado'),
      ojo(47, 34, [0, 0], 'cerrado'),
      f([17, 12], [17, 22], 'a'),
      f([47, 12], [47, 22], 'b'),
    ),
};

/** Las claves, en el orden en que se declaran (zona por zona). */
export const CLAVES_DE_ESTIRAMIENTO: readonly string[] = Object.keys(FIGURAS_DE_ESTIRAMIENTO);

/** Si hay una figura de estiramiento con esa clave. */
export function existeLaFigura(clave: string): boolean {
  return Object.hasOwn(FIGURAS_DE_ESTIRAMIENTO, clave);
}
