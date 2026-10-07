/**
 * El cifrado de lo que se guarda en el dispositivo (SCRUM-136).
 *
 * Lo que la cola y las copias de lectura guardan es informacion de salud de una
 * persona. En un equipo compartido (una sala de computo) no puede quedar legible
 * para quien abra las herramientas del navegador despues. Se guarda cifrado con
 * AES-GCM y la clave de cada persona vive aparte (ver `llavero.ts`).
 *
 * ## Lo que esto protege, y lo que no
 *
 * **Protege** contra quien mira el almacen sin la clave: las herramientas del
 * navegador, una copia de la base, otro sitio. Lo guardado es ilegible y, ademas,
 * **no se puede alterar sin que se note**: AES-GCM autentica, y un dato modificado
 * no se descifra. Es lo que cumple "verificar la firma logica del payload" de la
 * HU_MF09_002.
 *
 * **No protege** contra un script que corra en esta misma pagina (por ejemplo, una
 * vulnerabilidad XSS): ese script puede pedirle a la aplicacion que descifre. Ni
 * contra quien tenga la sesion abierta en un equipo desbloqueado: la aplicacion se
 * ve entera por diseno. El cifrado sube el costo de leer los datos a escondidas;
 * no sustituye a cerrar sesion. Esto esta escrito tambien en el ADR 0019.
 *
 * ## Como
 *
 * - **Una clave por persona**, AES-GCM de 256 bits, **no extraible**: el codigo no
 *   puede leer sus bytes, solo usarla.
 * - **Un IV nuevo y aleatorio por cada cifrado.** Repetir un IV con la misma clave
 *   destruye la garantia de AES-GCM.
 * - **Contexto autenticado.** Cada valor se cifra atado a un texto que dice de que
 *   es (`persona|tabla|clave`). Si alguien mueve un registro cifrado a otro sitio
 *   (a la fila de otra operacion, o de otra persona), no se descifra.
 */

/** 96 bits: el tamano que recomienda AES-GCM. */
const LARGO_DEL_IV_EN_BYTES = 12;

/** Lo cifrado: el IV (que no es secreto) y los datos con su etiqueta de autenticacion. */
export interface Sellado {
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly datos: ArrayBuffer;
}

/**
 * No se pudo descifrar: la clave no es la que lo cifro, o el contexto no coincide,
 * o el dato se altero. No se distingue entre las tres a proposito: para quien lo
 * recibe es lo mismo, "esto no se puede leer".
 */
export class DescifradoFallido extends Error {
  constructor() {
    super('No se pudo descifrar lo guardado en este dispositivo.');
    this.name = 'DescifradoFallido';
  }
}

/** Una clave nueva para una persona: AES-GCM de 256 bits, no extraible. */
export function generarLaClave(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function bytesDelContexto(contexto: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(contexto);
}

/**
 * Cifra un valor (cualquier cosa que sea JSON) atado a su contexto.
 *
 * `undefined` se guarda como `null`: JSON no lo representa, y un valor que
 * desaparece al guardarlo seria un error dificil de ver.
 */
export async function sellar(clave: CryptoKey, contexto: string, valor: unknown): Promise<Sellado> {
  const iv = crypto.getRandomValues(new Uint8Array(LARGO_DEL_IV_EN_BYTES));
  const texto = JSON.stringify(valor ?? null);
  const datos = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: bytesDelContexto(contexto) },
    clave,
    new TextEncoder().encode(texto),
  );

  return { iv, datos };
}

/**
 * Descifra lo que `sellar` cifro, con la misma clave y el mismo contexto.
 *
 * @throws {DescifradoFallido} Si no coincide la clave, el contexto, o si se altero.
 */
export async function abrir<T = unknown>(
  clave: CryptoKey,
  contexto: string,
  sellado: Sellado,
): Promise<T> {
  let claro: ArrayBuffer;

  try {
    claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sellado.iv, additionalData: bytesDelContexto(contexto) },
      clave,
      sellado.datos,
    );
  } catch {
    throw new DescifradoFallido();
  }

  try {
    return JSON.parse(new TextDecoder().decode(claro)) as T;
  } catch {
    // Descifro bien pero no es JSON: lo que se guardo no lo escribimos nosotros.
    throw new DescifradoFallido();
  }
}

/**
 * Si algo es de la clase de bytes que se dice, mirando su etiqueta y no su
 * constructor. `instanceof` falla cuando el valor viene de otro "reino" de
 * JavaScript (un iframe, un worker, o lo que devuelve el motor de IndexedDB): es
 * un `ArrayBuffer` de verdad, pero no el de esta pagina.
 */
function esDeClase(
  valor: unknown,
  etiqueta: '[object Uint8Array]' | '[object ArrayBuffer]',
): boolean {
  return Object.prototype.toString.call(valor) === etiqueta;
}

/** Si algo tiene la forma de un `Sellado` (para no fiarse de lo que lea el almacen). */
export function esSellado(valor: unknown): valor is Sellado {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const { iv, datos } = valor as { iv?: unknown; datos?: unknown };

  return (
    esDeClase(iv, '[object Uint8Array]') &&
    (iv as Uint8Array).byteLength === LARGO_DEL_IV_EN_BYTES &&
    esDeClase(datos, '[object ArrayBuffer]')
  );
}
