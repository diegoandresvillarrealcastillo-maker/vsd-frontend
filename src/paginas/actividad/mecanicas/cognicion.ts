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

export function generarSecuencia(largo: number): string {
  return Array.from({ length: largo }, () => Math.floor(Math.random() * 10)).join('');
}

/** Un acierto alarga la siguiente un digito; un fallo la acorta, sin bajar de tres. */
export function siguienteLargo(largo: number, acerto: boolean): number {
  return acerto ? largo + 1 : Math.max(LARGO_INICIAL, largo - 1);
}

/** Tiempo a la vista: un poco por cada digito, mas un margen para leerla. */
export function tiempoAlaVista(largo: number): number {
  return largo * MS_POR_DIGITO + MS_DE_MARGEN;
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

/** 3×3 las cinco primeras rondas, 4×4 las cinco siguientes y 5×5 las ultimas. */
export function ladoDeLaRonda(ronda: number): number {
  if (ronda <= 5) {
    return 3;
  }

  return ronda <= 10 ? 4 : 5;
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
