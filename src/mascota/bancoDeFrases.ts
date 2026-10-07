import { horaLocal } from '../tiempo/zonaHoraria.ts';
import { FRASES_POR_MOMENTO, MOMENTOS, type Momento } from './frasesDeLaMascota.ts';

/**
 * Cual frase dice la mascota, y en que orden (SCRUM-129).
 *
 * ## Orden aleatorio sin repetir
 *
 * Cada vez se elige al azar entre las que **todavia no se han dicho** en ese
 * momento. Hasta no agotarlas todas no se repite ninguna, y al agotarlas
 * empieza otra vuelta, sin repetir justo la ultima que se dijo. Con cincuenta
 * frases por momento y un toque o dos por visita, una persona tarda semanas en
 * ver la misma dos veces.
 *
 * Lo que ya se dijo se guarda en este navegador (`vsd-h:mascota-frases`). No es
 * un dato personal: son frases del banco, sin nada de la persona, y es del mismo
 * tipo que donde deja la mascota. Si el navegador no deja guardar, el orden
 * vale mientras dure la pestana, y no pasa nada mas.
 *
 * Se guarda **lo dicho** y no el orden: si el banco cambia, lo que ya no existe
 * se ignora y lo nuevo cuenta como no dicho, en lugar de dejar indices que
 * apuntan a otra frase.
 */

const CLAVE_DE_LAS_FRASES = 'vsd-h:mascota-frases';

type Dichas = Partial<Record<Momento, readonly string[]>>;

/**
 * Lo dicho en esta sesion, por si el navegador no deja guardarlo. Solo se lee
 * cuando el almacenamiento falla: si funciona, manda lo que haya en el.
 */
let enMemoria: Dichas | null = null;

function esLista(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor) && valor.every((elemento) => typeof elemento === 'string');
}

function leerLoDicho(): Dichas {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(CLAVE_DE_LAS_FRASES) ?? '{}');
    let leido: Dichas = {};

    if (crudo !== null && typeof crudo === 'object') {
      for (const momento of MOMENTOS) {
        const lista = (crudo as Record<string, unknown>)[momento];

        if (esLista(lista)) {
          leido = { ...leido, [momento]: lista };
        }
      }
    }

    return leido;
  } catch {
    // Sin almacenamiento, o con algo que no es nuestro: lo de esta sesion.
    return enMemoria ?? {};
  }
}

function guardarLoDicho(dichas: Dichas): void {
  enMemoria = dichas;

  try {
    localStorage.setItem(CLAVE_DE_LAS_FRASES, JSON.stringify(dichas));
  } catch {
    // Sin almacenamiento, el orden vale mientras dure la pestana.
  }
}

/** Olvida lo dicho. Para las pruebas, y para quien cierre sesion. */
export function reiniciarLasFrases(): void {
  enMemoria = null;

  try {
    localStorage.removeItem(CLAVE_DE_LAS_FRASES);
  } catch {
    // Nada que borrar.
  }
}

/**
 * Las frases que pueden salir en un momento: las suyas, las generales y, solo
 * en el momento general, las propias del personaje.
 *
 * Las del personaje van solo ahi a proposito: son de su manera de hablar, y a
 * las siete de la manana suena mejor una de las del banco.
 */
export function frasesDelMomento(
  momento: Momento,
  propias: readonly string[] = [],
): readonly string[] {
  const generales = FRASES_POR_MOMENTO.general;

  if (momento === 'general') {
    return [...generales, ...propias];
  }

  return [...FRASES_POR_MOMENTO[momento], ...generales];
}

/** Una al azar. `aleatorio` devuelve un numero en [0, 1), como `Math.random`. */
function unaAlAzar(opciones: readonly string[], aleatorio: () => number): string {
  const frase = opciones[Math.min(Math.floor(aleatorio() * opciones.length), opciones.length - 1)];

  // Nunca llega vacio: quien llama garantiza al menos una opcion.
  return frase ?? '';
}

/**
 * Elige la siguiente frase entre las que quedan por decir, y devuelve tambien
 * lo dicho despues de elegirla. Pura: no toca el almacenamiento.
 *
 * `dichas` puede traer frases que ya no estan en `opciones` (de otro personaje,
 * o de una version anterior del banco): se ignoran.
 */
export function elegirFrase(
  opciones: readonly string[],
  dichas: readonly string[],
  aleatorio: () => number,
): { readonly frase: string; readonly dichas: readonly string[] } {
  const vigentes = dichas.filter((frase) => opciones.includes(frase));
  const pendientes = opciones.filter((frase) => !vigentes.includes(frase));

  if (pendientes.length > 0) {
    const frase = unaAlAzar(pendientes, aleatorio);

    return { frase, dichas: [...vigentes, frase] };
  }

  // Se dijeron todas: otra vuelta, sin repetir justo la ultima.
  const ultima = vigentes[vigentes.length - 1];
  const otras = opciones.length > 1 ? opciones.filter((frase) => frase !== ultima) : opciones;
  const frase = unaAlAzar(otras, aleatorio);

  return { frase, dichas: [frase] };
}

/**
 * La frase que toca decir ahora, y se anota como dicha.
 *
 * Devuelve `null` solo si no hay ninguna frase posible, lo que no pasa con el
 * banco que hay.
 */
export function siguienteFrase(
  momento: Momento,
  propias: readonly string[] = [],
  aleatorio: () => number = Math.random,
): string | null {
  const opciones = frasesDelMomento(momento, propias);

  if (opciones.length === 0) {
    return null;
  }

  const todas = leerLoDicho();
  const { frase, dichas } = elegirFrase(opciones, todas[momento] ?? [], aleatorio);

  guardarLoDicho({ ...todas, [momento]: dichas });

  return frase;
}

/**
 * Que momento es, para elegir las frases.
 *
 * Lo que la pantalla pide gana: despues de una actividad, el diario, la racha.
 * Sin nada pedido, manda la hora de la persona en su zona (SCRUM-123): de cinco
 * a doce es la manana, de ocho de la noche a cinco de la madrugada es la noche,
 * y el resto del dia es general.
 */
export function momentoDeLaFrase(pedido: Momento | undefined, ahora: Date): Momento {
  if (pedido !== undefined && pedido !== 'general') {
    return pedido;
  }

  const hora = horaLocal(ahora);

  if (hora >= 5 && hora < 12) {
    return 'manana';
  }

  if (hora >= 20 || hora < 5) {
    return 'noche';
  }

  return 'general';
}
