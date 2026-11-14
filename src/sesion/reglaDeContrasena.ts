/**
 * La regla de la contrasena, en un solo sitio (SCRUM-116).
 *
 * La usan el registro, la pantalla de contrasena nueva y el cambio desde el
 * perfil. Si cada una llevara su propia copia, bastaria un descuido para que
 * una aceptara lo que otra rechaza.
 *
 * ---------------------------------------------------------------------------
 * Por que esta alineada con Supabase y no con una lista propia
 * ---------------------------------------------------------------------------
 *
 * Esto es comodidad, no el control: quien llame directo a Supabase se salta
 * esta pantalla. Por eso la misma regla se activa tambien en Auth (Ajustes de
 * Authentication, "Password requirements", minimo 8 y "mayusculas,
 * minusculas, digitos y simbolos"). Para que ninguna de las dos rechace lo que
 * la otra acepta, las letras son las del alfabeto ASCII y los simbolos son
 * exactamente los que Supabase reconoce. Una contrasena con solo una `ñ` o
 * una `€` como "simbolo" pasaria aqui y la rechazaria el servidor.
 *
 * Los simbolos no se limitan a `@$!%*?&`: se acepta cualquiera de la lista.
 * Cerrar el conjunto dejaria fuera contrasenas igual de buenas, como las que
 * llevan `#`, `_` o `.`, y empujaria a escribir una predecible para cumplir.
 */

export const MINIMO_DE_CONTRASENA = 8;

/** Desde esta longitud, una contrasena que cumple todo se considera fuerte. */
export const LONGITUD_FUERTE = 12;

/** Los simbolos que Supabase reconoce como tales. */
const SIMBOLOS = '!@#$%^&*()_+-=[]{};\':"\\|<>?,./`~';

export type ClaveDeRequisito = 'longitud' | 'mayuscula' | 'minuscula' | 'numero' | 'simbolo';

export interface Requisito {
  readonly clave: ClaveDeRequisito;
  /** Como se escribe en la lista que ve la persona. */
  readonly texto: string;
  /** Como se une a la frase de lo que falta: "necesita {falta}". */
  readonly falta: string;
  readonly cumple: boolean;
}

/** De 0 (sin escribir) a 4 (fuerte). */
export type NivelDeFuerza = 0 | 1 | 2 | 3 | 4;

export interface Evaluacion {
  readonly requisitos: readonly Requisito[];
  readonly cumplidos: number;
  /** Si cumple todo lo que se exige. */
  readonly valida: boolean;
  readonly nivel: NivelDeFuerza;
  readonly etiqueta: string;
}

const ETIQUETAS: Readonly<Record<NivelDeFuerza, string>> = {
  0: 'Escribe tu contraseña',
  1: 'Débil',
  2: 'Regular',
  3: 'Buena',
  4: 'Fuerte',
};

function tieneSimbolo(contrasena: string): boolean {
  return [...contrasena].some((caracter) => SIMBOLOS.includes(caracter));
}

/**
 * El nivel sale de cuantos requisitos se cumplen, no de adivinar si la
 * contrasena es "dificil de romper". Eso ultimo no se puede saber sin un
 * diccionario de contrasenas filtradas, y fingirlo daria una seguridad falsa:
 * `Contrasena1!` cumple todo y es de las primeras que se prueban.
 *
 * - 0 a 2 requisitos: debil.
 * - 3 o 4: regular. Falta poco, y es el tramo en que ayuda ver que falta.
 * - Los cinco: buena, y fuerte desde 12 caracteres, que es lo que de verdad
 *   la hace mas costosa de adivinar.
 */
export function evaluarContrasena(contrasena: string): Evaluacion {
  // Se cuentan caracteres y no unidades de UTF-16: un emoji ocupa dos y no es
  // "dos caracteres". Asi la cuenta nunca da mas que la del servidor.
  const longitudVisible = [...contrasena].length;

  const requisitos: readonly Requisito[] = [
    {
      clave: 'longitud',
      texto: `Al menos ${MINIMO_DE_CONTRASENA} caracteres`,
      falta: `al menos ${MINIMO_DE_CONTRASENA} caracteres`,
      cumple: longitudVisible >= MINIMO_DE_CONTRASENA,
    },
    {
      clave: 'mayuscula',
      texto: 'Una mayúscula',
      falta: 'una mayúscula',
      cumple: /[A-Z]/.test(contrasena),
    },
    {
      clave: 'minuscula',
      texto: 'Una minúscula',
      falta: 'una minúscula',
      cumple: /[a-z]/.test(contrasena),
    },
    {
      clave: 'numero',
      texto: 'Un número',
      falta: 'un número',
      cumple: /[0-9]/.test(contrasena),
    },
    {
      clave: 'simbolo',
      texto: 'Un símbolo, como ! # $ % & * ? @',
      falta: 'un símbolo',
      cumple: tieneSimbolo(contrasena),
    },
  ];

  const cumplidos = requisitos.filter((requisito) => requisito.cumple).length;
  const valida = cumplidos === requisitos.length;

  let nivel: NivelDeFuerza;

  if (longitudVisible === 0) {
    nivel = 0;
  } else if (valida) {
    nivel = longitudVisible >= LONGITUD_FUERTE ? 4 : 3;
  } else {
    nivel = cumplidos >= 3 ? 2 : 1;
  }

  return { requisitos, cumplidos, valida, nivel, etiqueta: ETIQUETAS[nivel] };
}

const LISTA = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

/**
 * El mensaje de error cuando la contrasena no cumple, o `null` si cumple.
 *
 * Nombra lo que falta y no repite todo lo que se pide: "necesita una
 * mayuscula y un simbolo" se arregla de un vistazo, y una lista completa
 * obliga a comparar contra la propia contrasena.
 */
export function mensajeSiNoCumple(contrasena: string): string | null {
  const { requisitos, valida } = evaluarContrasena(contrasena);

  if (valida) {
    return null;
  }

  const faltan = requisitos.filter((requisito) => !requisito.cumple).map((r) => r.falta);

  return `La contraseña necesita ${LISTA.format(faltan)}.`;
}
