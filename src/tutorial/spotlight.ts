/**
 * Las cuentas del spotlight del tutorial (SCRUM-201).
 *
 * Son funciones pequenas y sin React: reciben rectangulos y devuelven rectangulos, para poder
 * probarlas sin pantalla. Lo unico que leen de la pagina es el rectangulo de un elemento.
 */

/** Un rectangulo en pixeles de la ventana (`position: fixed`). */
export interface Hueco {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface Ventana {
  readonly ancho: number;
  readonly alto: number;
}

/** El aire que se deja alrededor del elemento iluminado. */
export const MARGEN_DEL_HUECO = 8;

/** Un elemento mas alto que esto deja sin sitio a la caja de Fungito: el paso va centrado. */
export const PROPORCION_MAXIMA_DEL_HUECO = 0.6;

/** El alto que necesita la caja de Fungito para leerse sin tapar el elemento. */
export const ALTO_MINIMO_PARA_LA_CAJA = 220;

/** Si el elemento se ve: tiene tamano y no esta oculto. */
function seVe(elemento: HTMLElement): boolean {
  const rect = elemento.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const estilo = getComputedStyle(elemento);

  return estilo.visibility !== 'hidden' && estilo.display !== 'none';
}

/**
 * El primer elemento marcado con ese nombre que **se ve**.
 *
 * Puede haber varios con el mismo nombre —el diario esta en la barra de arriba del escritorio y
 * en el dock del movil, y de los dos solo se ve uno—, y el que no se ve no sirve: se salta. Si
 * ninguno se ve, `null` y el paso va centrado.
 */
export function buscarAncla(nombre: string, raiz: ParentNode = document): HTMLElement | null {
  for (const candidato of raiz.querySelectorAll<HTMLElement>(`[data-tutorial="${nombre}"]`)) {
    if (seVe(candidato)) {
      return candidato;
    }
  }

  return null;
}

/** El rectangulo del elemento con su margen, sin salirse de la ventana. */
export function huecoAlrededorDe(
  rect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  ventana: Ventana,
  margen: number = MARGEN_DEL_HUECO,
): Hueco {
  const x = Math.max(0, rect.left - margen);
  const y = Math.max(0, rect.top - margen);
  const derecha = Math.min(ventana.ancho, rect.left + rect.width + margen);
  const abajo = Math.min(ventana.alto, rect.top + rect.height + margen);

  return { x, y, ancho: derecha - x, alto: abajo - y };
}

/** El sitio libre encima y debajo del hueco. */
function espacios(hueco: Hueco, ventana: Ventana): { arriba: number; abajo: number } {
  return { arriba: hueco.y, abajo: ventana.alto - (hueco.y + hueco.alto) };
}

/** Del lado donde hay mas sitio va la caja de Fungito; en empate, abajo, que se lee mejor. */
export function ladoDeLaCaja(hueco: Hueco, ventana: Ventana): 'arriba' | 'abajo' {
  const { arriba, abajo } = espacios(hueco, ventana);

  return abajo >= arriba ? 'abajo' : 'arriba';
}

/**
 * Si, con ese hueco, la caja de Fungito cabe a un lado sin tapar el elemento. Si no, el paso va
 * centrado y atenuado, como sin spotlight.
 */
export function quedaTodoElHueco(hueco: Hueco, ventana: Ventana): boolean {
  if (hueco.alto > ventana.alto * PROPORCION_MAXIMA_DEL_HUECO) {
    return false;
  }

  const { arriba, abajo } = espacios(hueco, ventana);

  return Math.max(arriba, abajo) >= ALTO_MINIMO_PARA_LA_CAJA;
}
