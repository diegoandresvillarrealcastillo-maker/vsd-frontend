/**
 * La geometria de las figuras de estiramiento (SCRUM-226), sin pantalla.
 *
 * Son funciones puras sobre un lienzo de 64 x 64 con el eje y hacia abajo, como el de cualquier SVG. Se prueban
 * sin dibujar nada: que ninguna devuelva un numero que no sea un numero, y que una flecha apunte hacia donde dice.
 *
 * ## Los dos sistemas de angulos
 *
 * - **Para los miembros** (`desde`): 0 grados es hacia abajo, 90 hacia la derecha de la pantalla, 180 hacia
 *   arriba y -90 hacia la izquierda. Asi un brazo colgando es 0 y uno levantado a un lado es 90 o -90.
 * - **Para los arcos** (`arco`): el de las matematicas con el eje y hacia abajo. 0 es a la derecha, 90 es hacia
 *   abajo, 180 a la izquierda y 270 hacia arriba; crecer es girar como las agujas del reloj.
 */

export type Punto = readonly [number, number];

const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

/** Un decimal: el SVG pesa menos y las pruebas no dependen de los ultimos digitos de un seno. */
export const redondear = (n: number): number => Math.round(n * 10) / 10;

/** El punto que queda a `largo` de `origen`, en la direccion `grados` (0 = abajo, 90 = derecha, 180 = arriba). */
export function desde(origen: Punto, largo: number, grados: number): Punto {
  return [
    redondear(origen[0] + largo * Math.sin(aRadianes(grados))),
    redondear(origen[1] + largo * Math.cos(aRadianes(grados))),
  ];
}

/** Una linea quebrada por los puntos, como el `d` de un `<path>`. */
export function trazo(...puntos: readonly Punto[]): string {
  return puntos
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${String(redondear(x))} ${String(redondear(y))}`)
    .join(' ');
}

/** Un triangulo con la punta en `punta`, mirando hacia donde apunta `direccion` (un vector, no hace falta unitario). */
function puntaDeFlecha(punta: Punto, direccion: Punto, tamano: number): string {
  const largo = Math.hypot(direccion[0], direccion[1]) || 1;
  const ux = direccion[0] / largo;
  const uy = direccion[1] / largo;
  // La base queda detras de la punta, y a cada lado.
  const bx = punta[0] - ux * tamano;
  const by = punta[1] - uy * tamano;
  const px = -uy * (tamano * 0.7);
  const py = ux * (tamano * 0.7);

  return `M${String(redondear(punta[0]))} ${String(redondear(punta[1]))} L${String(redondear(bx + px))} ${String(redondear(by + py))} L${String(redondear(bx - px))} ${String(redondear(by - py))} Z`;
}

export interface TrazoConPunta {
  /** La linea o el arco. */
  readonly d: string;
  /** El triangulo de la punta. */
  readonly punta: string;
}

/** Una flecha recta de `a` a `b`; la punta esta en `b`. */
export function flecha(a: Punto, b: Punto, tamano = 3.4): TrazoConPunta {
  const direccion: Punto = [b[0] - a[0], b[1] - a[1]];
  const largo = Math.hypot(direccion[0], direccion[1]) || 1;
  // El trazo termina donde empieza la punta, para que no sobresalga por delante.
  const fin: Punto = [
    b[0] - (direccion[0] / largo) * tamano * 0.6,
    b[1] - (direccion[1] / largo) * tamano * 0.6,
  ];

  return { d: trazo(a, fin), punta: puntaDeFlecha(b, direccion, tamano) };
}

/** Una flecha de ida y vuelta: dos puntas, una en cada extremo. */
export function flechaDoble(a: Punto, b: Punto, tamano = 3.2): TrazoConPunta {
  const ida = flecha(a, b, tamano);
  const vuelta = puntaDeFlecha(a, [a[0] - b[0], a[1] - b[1]], tamano);

  return { d: trazo(a, b), punta: `${ida.punta} ${vuelta}` };
}

/**
 * Un arco con flecha alrededor de `centro`, de `de` a `hasta` grados (como las agujas del reloj si `hasta` es
 * mayor, al reves si es menor). La punta esta al final.
 */
export function arco(
  centro: Punto,
  radio: number,
  de: number,
  hasta: number,
  tamano = 3.2,
): TrazoConPunta {
  const en = (grados: number): Punto => [
    centro[0] + radio * Math.cos(aRadianes(grados)),
    centro[1] + radio * Math.sin(aRadianes(grados)),
  ];
  const inicio = en(de);
  const fin = en(hasta);
  const horario = hasta > de;
  const grande = Math.abs(hasta - de) > 180 ? 1 : 0;
  // La tangente en el final: hacia donde seguiria el arco.
  const tangente: Punto = horario
    ? [-Math.sin(aRadianes(hasta)), Math.cos(aRadianes(hasta))]
    : [Math.sin(aRadianes(hasta)), -Math.cos(aRadianes(hasta))];

  return {
    d: `M${String(redondear(inicio[0]))} ${String(redondear(inicio[1]))} A${String(radio)} ${String(radio)} 0 ${String(grande)} ${horario ? '1' : '0'} ${String(redondear(fin[0]))} ${String(redondear(fin[1]))}`,
    punta: puntaDeFlecha(fin, tangente, tamano),
  };
}

/** Tres rayitas curvas a cada lado de `centro`: algo que se sacude. */
export function ondas(centro: Punto, ancho = 7): string {
  const [x, y] = centro;
  const lado = (signo: 1 | -1, dy: number): string =>
    `M${String(redondear(x + signo * ancho))} ${String(redondear(y + dy - 2))} Q${String(redondear(x + signo * (ancho + 3)))} ${String(redondear(y + dy))} ${String(redondear(x + signo * ancho))} ${String(redondear(y + dy + 2))}`;

  return [lado(1, -4), lado(1, 4), lado(-1, -4), lado(-1, 4)].join(' ');
}
