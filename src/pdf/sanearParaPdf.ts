import { sePuedeEscribir } from './documentoPdf.ts';

/**
 * Deja un texto de una persona en lo unico que el escritor de PDF sabe poner (SCRUM-191).
 *
 * El escritor solo conoce WinAnsi (Helvetica, sin incrustar nada) y **un caracter que no este es un
 * error**, no un hueco: sirve para la guia, cuyo texto escribimos nosotros. Pero un diario lo
 * escribe una persona, con emojis, flechas y alfabetos que no son el nuestro, y una exportacion
 * que falla por un corazon seria quitarle a alguien sus datos. Por eso todo texto que viene de la
 * persona pasa por aqui antes del PDF, y el PDF **nunca** se rompe por un caracter.
 *
 * Que se hace con cada caracter, en este orden:
 *
 * 1. Un espacio, un tabulador o un salto de linea es **un espacio** (varios seguidos, uno).
 * 2. Lo que tiene un equivalente comun en ASCII se cambia: `→` por `->`, `€` por `EUR`, `º` por `o`.
 * 3. Lo que WinAnsi ya puede escribir **no se toca**.
 * 4. Un emoji, aunque sea compuesto (con selector, tono de piel o unido por ZWJ) o una bandera,
 *    se dice **una sola vez** como «[emoji]»: no se puede dibujar, pero se sabe que estaba.
 * 5. Los caracteres de control y los invisibles (ancho cero, guion blando, BOM) se quitan.
 * 6. Una letra con una marca que WinAnsi no tiene (`ő`, `č`) vuelve a su letra.
 * 7. Lo que queda (otra escritura, simbolos sin equivalente, UTF-16 roto) se vuelve `?`, uno por
 *    caracter: se ve que habia algo y la linea no se corre.
 *
 * Es idempotente: sanear lo ya saneado no cambia nada.
 */

const MARCA_DE_EMOJI = '[emoji]';

/** Lo que no cabe en WinAnsi pero se dice igual con ASCII. */
const SUSTITUCIONES: Readonly<Record<string, string>> = {
  '\u{feff}': '',
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '€': 'EUR',
  '™': '(TM)',
  '©': '(c)',
  '®': '(R)',
  º: 'o',
  ª: 'a',
  '±': '+/-',
  '÷': '/',
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '−': '-',
  '‚': ',',
  '„': '"',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '―': '-',
  '′': "'",
  '″': '"',
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ø: 'o',
  Ø: 'O',
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
};

const PICTOGRAMA = /\p{Extended_Pictographic}/u;
const MARCA_COMBINABLE = /\p{M}/u;
const CONTROL_O_INVISIBLE = /[\p{Cc}\p{Cf}]/u;
const ESPACIO = /\s/u;

/** Lo que se pega a un emoji sin ser el: selector, tono de piel, ZWJ, cuadro, etiquetas. */
function unePartesDeUnEmoji(codigo: number): boolean {
  return (
    codigo === 0x200d ||
    codigo === 0xfe0e ||
    codigo === 0xfe0f ||
    codigo === 0x20e3 ||
    (codigo >= 0x1f3fb && codigo <= 0x1f3ff) ||
    (codigo >= 0xe0020 && codigo <= 0xe007f)
  );
}

function esBanderaOEmoji(caracter: string, codigo: number): boolean {
  return (codigo >= 0x1f1e6 && codigo <= 0x1f1ff) || PICTOGRAMA.test(caracter);
}

/** El caracter sin sus marcas, si con eso ya se puede escribir entero. */
function sinMarcas(caracter: string): string | null {
  const base = [...caracter.normalize('NFKD')]
    .filter((parte) => !MARCA_COMBINABLE.test(parte))
    .join('');

  return base !== '' && [...base].every((parte) => sePuedeEscribir(parte)) ? base : null;
}

export function sanearParaPdf(texto: string): string {
  let salida = '';
  let enUnEmoji = false;
  let despuesDeUnEspacio = false;

  const poner = (parte: string) => {
    salida += parte;
    enUnEmoji = false;
    despuesDeUnEspacio = false;
  };

  for (const caracter of texto.normalize('NFC')) {
    const codigo = caracter.codePointAt(0) ?? 0;

    if (caracter !== '\u{feff}' && ESPACIO.test(caracter)) {
      if (!despuesDeUnEspacio) {
        salida += ' ';
      }

      enUnEmoji = false;
      despuesDeUnEspacio = true;

      continue;
    }

    const sustituto = SUSTITUCIONES[caracter];

    if (sustituto !== undefined) {
      poner(sustituto);
    } else if (sePuedeEscribir(caracter)) {
      poner(caracter);
    } else if (esBanderaOEmoji(caracter, codigo)) {
      // Los emoji seguidos, o unidos por un ZWJ, son uno solo.
      if (!enUnEmoji) {
        salida += MARCA_DE_EMOJI;
      }

      enUnEmoji = true;
      despuesDeUnEspacio = false;
    } else if (enUnEmoji && unePartesDeUnEmoji(codigo)) {
      // Parte del emoji que ya se dijo: no se dice otra vez.
    } else if (CONTROL_O_INVISIBLE.test(caracter) || MARCA_COMBINABLE.test(caracter)) {
      // Sin efecto en lo que se lee: no deja ni un hueco.
    } else {
      poner(sinMarcas(caracter) ?? '?');
    }
  }

  return salida;
}
