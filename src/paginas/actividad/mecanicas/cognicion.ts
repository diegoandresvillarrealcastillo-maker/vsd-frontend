import type { NombreDeIcono } from '../../panel/Icono.tsx';

/**
 * Las reglas de los tres juegos de Cognicion (SCRUM-84), separadas de las
 * pantallas: son funciones puras que se prueban solas, y cada pantalla solo
 * pinta y reacciona.
 *
 * Los maximos coinciden con los sembrados en el catalogo. El servidor tiene el
 * mismo numero y rechaza con 400 un puntaje que se pase.
 */

export interface Simbolo {
  readonly icono: NombreDeIcono;
  readonly nombre: string;
}

/** El reloj, fuera de los componentes: leerlo no es algo que deba hacer un render. */
export function marcaDeTiempo(): number {
  return Date.now();
}

export function segundosDesde(marca: number): number {
  return Math.round((Date.now() - marca) / 1000);
}

/** Fisher-Yates: cada orden igual de probable. */
export function barajar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const actual = copia[i];
    const otra = copia[j];

    if (actual !== undefined && otra !== undefined) {
      copia[i] = otra;
      copia[j] = actual;
    }
  }

  return copia;
}

// ---------------------------------------------------------------------------
// Cuantas rondas se juegan (SCRUM-288)
// ---------------------------------------------------------------------------

/**
 * Lo que mas se juega en una actividad de rondas. Quince eran demasiadas para quien juega: cansan y la
 * atencion se va. El catalogo no cambia (sigue diciendo doce o quince, que es su **maximo de puntos**): lo
 * que se recorta es cuantas se juegan, aqui, en un solo sitio para todos los juegos.
 */
export const MAXIMO_DE_RONDAS = 7;

/** Las rondas que se juegan de las que declara el catalogo o la sesion. */
export function rondasAJugar(rondasDelCatalogo: number): number {
  return Math.min(rondasDelCatalogo, MAXIMO_DE_RONDAS);
}

/**
 * El puntaje crudo de un juego en el que «un acierto vale un punto», cuando solo se jugaron `jugadas` de las
 * rondas que dan el `maximo`. El servidor divide lo que recibe entre el maximo de la actividad para sacar el
 * nivel: sin reescalar, acertar siete de siete valdria 7/15 y la mejor partida caeria en «seguimiento».
 */
export function puntajeSobreElMaximo(aciertos: number, jugadas: number, maximo: number): number {
  if (jugadas <= 0) {
    return 0;
  }

  return Math.min(Math.round((aciertos / jugadas) * maximo * 100) / 100, maximo);
}

// ---------------------------------------------------------------------------
// Parejas de cartas
// ---------------------------------------------------------------------------

export const MAXIMO_DE_PAREJAS = 20;

export const SIMBOLOS_DE_PAREJAS: readonly Simbolo[] = [
  { icono: 'leaf', nombre: 'hoja' },
  { icono: 'heart', nombre: 'corazón' },
  { icono: 'moon', nombre: 'luna' },
  { icono: 'sparkles', nombre: 'destellos' },
  { icono: 'book', nombre: 'libro' },
  { icono: 'calendar', nombre: 'calendario' },
];

export const PAREJAS = SIMBOLOS_DE_PAREJAS.length;

export interface Carta {
  readonly id: number;
  readonly simbolo: number;
}

/** Las doce cartas en el orden en que quedan en la mesa. */
export function repartir(): readonly Carta[] {
  return barajar(SIMBOLOS_DE_PAREJAS.flatMap((_, simbolo) => [simbolo, simbolo])).map(
    (simbolo, id) => ({ id, simbolo }),
  );
}

/**
 * El puntaje crudo: 20 con un intento por pareja, y proporcionalmente menos
 * cuantos mas intentos hagan falta. Con el doble de intentos, la mitad.
 *
 * Es proporcional y no "un punto menos por fallo" a proposito: restar por
 * fallo llega a cero enseguida y castiga a quien juega por primera vez, cuando
 * fallar al principio es inevitable porque todavia no se ha visto ninguna carta.
 */
export function puntajeDeParejas(intentos: number): number {
  return Math.min(
    MAXIMO_DE_PAREJAS,
    Math.round((MAXIMO_DE_PAREJAS * PAREJAS) / Math.max(intentos, PAREJAS)),
  );
}

// ---------------------------------------------------------------------------
// Secuencia de numeros
// ---------------------------------------------------------------------------

/** El maximo del catalogo: una ronda acertada, un punto. */
export const RONDAS_DE_SECUENCIA = 12;
export const LARGO_INICIAL = 3;
const MS_POR_DIGITO = 700;
const MS_DE_MARGEN = 1000;

/**
 * Las reglas de la secuencia **de siempre**: las que usa la pantalla cuando no hay sesion, o la
 * que llega no se entiende (SCRUM-208). Son las mismas que lleva la sesion de la Fase 0.
 */
export const SECUENCIA_DE_SIEMPRE = {
  largoInicial: LARGO_INICIAL,
  rondas: RONDAS_DE_SECUENCIA,
  msPorElemento: MS_POR_DIGITO,
  msDeMargen: MS_DE_MARGEN,
} as const;

export function generarSecuencia(largo: number): string {
  return Array.from({ length: largo }, () => Math.floor(Math.random() * 10)).join('');
}

/**
 * Una secuencia de casillas para `largo` turnos, cada una elegida al azar entre `cuantas` (SCRUM-209).
 * Una casilla se puede repetir: es una secuencia, no una baraja. Devuelve sus posiciones.
 */
export function generarSecuenciaDeCasillas(largo: number, cuantas: number): number[] {
  return Array.from({ length: largo }, () => Math.floor(Math.random() * cuantas));
}

/**
 * Un acierto alarga la siguiente un digito; un fallo la acorta, sin bajar del largo inicial (tres,
 * salvo que la sesion diga otro: SCRUM-208).
 */
export function siguienteLargo(
  largo: number,
  acerto: boolean,
  largoInicial: number = LARGO_INICIAL,
): number {
  return acerto ? largo + 1 : Math.max(largoInicial, largo - 1);
}

/**
 * Tiempo a la vista: un poco por cada digito, mas un margen para leerla. Sin decir nada son los de
 * siempre; con una sesion, los suyos.
 */
export function tiempoAlaVista(
  largo: number,
  msPorElemento: number = MS_POR_DIGITO,
  msDeMargen: number = MS_DE_MARGEN,
): number {
  return largo * msPorElemento + msDeMargen;
}

// ---------------------------------------------------------------------------
// Encuentra la diferencia
// ---------------------------------------------------------------------------

/** El maximo del catalogo: una diferencia encontrada, un punto. */
export const RONDAS_DE_DIFERENCIA = 15;
export const SEGUNDOS_POR_RONDA = 15;

export const SIMBOLOS_DE_DIFERENCIA: readonly Simbolo[] = [
  { icono: 'leaf', nombre: 'hoja' },
  { icono: 'heart', nombre: 'corazón' },
  { icono: 'moon', nombre: 'luna' },
  { icono: 'book', nombre: 'libro' },
  { icono: 'sparkles', nombre: 'destellos' },
];

export interface Tablero {
  readonly lado: number;
  readonly antes: readonly number[];
  readonly ahora: readonly number[];
  /** La casilla que cambio. */
  readonly cambio: number;
}

/** Los tamanos de siempre: 3×3, 4×4 y 5×5. */
export const LADOS_DE_SIEMPRE: readonly number[] = [3, 4, 5];

/** Las reglas de «Encuentra la diferencia» **de siempre** (SCRUM-208): las de la sesion de la Fase 0. */
export const DIFERENCIA_DE_SIEMPRE = {
  rondas: RONDAS_DE_DIFERENCIA,
  segundosPorRonda: SEGUNDOS_POR_RONDA,
  lados: LADOS_DE_SIEMPRE,
} as const;

/**
 * El lado del tablero de una ronda: las rondas se reparten en **tramos iguales** entre los lados
 * (SCRUM-208). Con quince rondas y lados de 3, 4 y 5: 3×3 las cinco primeras, 4×4 las cinco
 * siguientes y 5×5 las ultimas. Una ronda fuera de rango se queda en el primero o en el ultimo.
 */
export function ladoDeLaRondaSegun(
  ronda: number,
  rondas: number,
  lados: readonly number[],
): number {
  const tramo = Math.floor(((ronda - 1) * lados.length) / rondas);
  const indice = Math.min(Math.max(tramo, 0), lados.length - 1);

  return lados[indice] ?? LADOS_DE_SIEMPRE[0] ?? 3;
}

export function generarTablero(lado: number): Tablero {
  const total = lado * lado;
  const cantidad = SIMBOLOS_DE_DIFERENCIA.length;
  const antes = Array.from({ length: total }, () => Math.floor(Math.random() * cantidad));
  const cambio = Math.floor(Math.random() * total);
  // Otro simbolo cualquiera, pero nunca el mismo: si no, no habria diferencia.
  const salto = 1 + Math.floor(Math.random() * (cantidad - 1));
  const ahora = [...antes];

  ahora[cambio] = ((antes[cambio] ?? 0) + salto) % cantidad;

  return { lado, antes, ahora, cambio };
}
