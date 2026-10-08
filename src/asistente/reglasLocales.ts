import {
  ESQUEMA_QUE_ENTIENDE_LA_APLICACION,
  type ReglasLocales,
} from '../infraestructura/api/reglasLocales.ts';
import type { LineaDeAtencion } from '../infraestructura/api/resultados.ts';

/**
 * Lo que VSD IA responde sin conexion (SCRUM-141).
 *
 * Aplica las reglas que publica el servidor (`ReglasLocales`) y **nada mas**: no hay aqui
 * ninguna lista de saludos, de expresiones de riesgo ni de telefonos. Si las reglas
 * guardadas cambian, cambia lo que se responde; si no hay reglas, no se responde nada.
 *
 * El algoritmo es el del servidor (`SenalesDeRiesgo.ts` y `Reconocimiento.ts` del
 * backend), copiado a proposito y comprobado contra el mismo conjunto de frases
 * (`contrato/reglas-locales.json`, ver `reglasLocales.spec.ts`): los datos tienen un
 * solo origen y el algoritmo se comprueba, porque vive en dos repositorios.
 *
 * El orden es el del servidor y no se negocia:
 *
 * 1. **El riesgo**, primero y aparte, sobre el texto normalizado.
 * 2. **La charla**, solo si el mensaje **entero** es charla.
 * 3. **Lo demas que se reconoce**, la primera regla que coincide.
 *
 * Y lo que no se puede responder sin conexion **no se inventa**: `exige-conexion`.
 */

// ---------------------------------------------------------------------------
// Leer lo que escribe la persona
// ---------------------------------------------------------------------------

/**
 * Deja el texto comparable: sin tildes, en minusculas y con los espacios colapsados.
 * La forma NFD separa cada letra de su tilde, y el rango de marcas diacriticas las borra.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Las palabras de un texto: enteras, sin tildes, sin signos y en minuscula. Tres letras
 * iguales seguidas se leen como una ("holaaaa"): en espanol ninguna palabra las lleva.
 */
export function palabrasDe(texto: string): readonly string[] {
  return normalizar(texto)
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((palabra) => palabra !== '');
}

/**
 * Una palabra del patron contra una del texto: la misma, o un comienzo si el patron
 * termina en `*` (una raiz que admite terminaciones: "psicolog*").
 */
function coincide(palabra: string, patron: string): boolean {
  return patron.endsWith('*') ? palabra.startsWith(patron.slice(0, -1)) : palabra === patron;
}

/** Donde empieza cada aparicion del patron, como posiciones de palabra. */
function apariciones(palabras: readonly string[], patron: string): readonly number[] {
  const partes = patron.split(' ');

  return palabras
    .map((_palabra, inicio) => inicio)
    .filter(
      (inicio) =>
        inicio + partes.length <= palabras.length &&
        partes.every((parte, desplazamiento) =>
          coincide(palabras[inicio + desplazamiento] ?? '', parte),
        ),
    );
}

/** Cierto si alguno de los patrones aparece completo, palabra por palabra. */
function contieneAlguno(palabras: readonly string[], patrones: readonly string[]): boolean {
  return patrones.some((patron) => apariciones(palabras, patron).length > 0);
}

/**
 * Cuando el mensaje entero es charla y no otra cosa: cada palabra tiene que ser de un
 * patron o del relleno que la acompana. Devuelve la regla que gana (las primeras de la
 * lista), o `undefined`.
 *
 * Reconocer un "hola" dentro de una frase mas larga es el camino a una respuesta alegre
 * para quien no la necesita: "hola, quiero desaparecer" contiene un saludo y contiene lo
 * que importa.
 */
function reconocerCharla<T extends { readonly patrones: readonly string[] }>(
  palabras: readonly string[],
  reglas: readonly T[],
  relleno: ReadonlySet<string>,
): T | undefined {
  if (palabras.length === 0) {
    return undefined;
  }

  const cubiertas = new Set<number>();
  const coinciden = reglas.filter((regla) => {
    const huellas = regla.patrones.flatMap((patron) =>
      apariciones(palabras, patron).flatMap((inicio) =>
        Array.from({ length: patron.split(' ').length }, (_valor, i) => inicio + i),
      ),
    );

    huellas.forEach((posicion) => cubiertas.add(posicion));

    return huellas.length > 0;
  });

  const sobra = palabras.some(
    (palabra, posicion) => !cubiertas.has(posicion) && !relleno.has(palabra),
  );

  return sobra ? undefined : coinciden[0];
}

// ---------------------------------------------------------------------------
// Que pais es
// ---------------------------------------------------------------------------

/**
 * El nombre de la zona como lo escribe IANA: `america/bogota` y `US/Eastern` se leen como
 * `America/Bogota` y `America/New_York`. Una zona que el entorno no conoce se queda como
 * esta, y no coincide con ninguna: recibe el directorio.
 */
function canonica(zona: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zona }).resolvedOptions().timeZone;
  } catch {
    return zona;
  }
}

/**
 * Las lineas del pais de la zona, o el directorio internacional si la zona no es de
 * ningun pais con lineas verificadas. **Nunca las de otro pais**: un numero de otro pais,
 * ensenado como si fuera de quien lo lee, es el peor error posible.
 */
export function lineasDeLaZona(reglas: ReglasLocales, zona: string): readonly LineaDeAtencion[] {
  const buscada = canonica(zona);
  const pais = Object.values(reglas.paises).find((una) => una.zonas.includes(buscada));

  return pais?.lineas ?? reglas.internacional;
}

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

export type ResultadoSinConexion =
  | {
      readonly tipo: 'riesgo';
      readonly mensaje: string;
      readonly lineas: readonly LineaDeAtencion[];
    }
  | { readonly tipo: 'charla'; readonly intencion: string; readonly mensaje: string }
  | {
      readonly tipo: 'ayuda';
      readonly intencion: string;
      readonly mensaje: string;
      readonly lineas: readonly LineaDeAtencion[];
    }
  | { readonly tipo: 'exige-conexion' };

export interface ConsultaSinConexion {
  readonly texto: string;
  /** La zona horaria de la cuenta. De ella sale el pais; nunca se pide ubicacion. */
  readonly zona: string;
  /** El nombre de la mascota: para que "hola, Luma" se lea como un saludo. */
  readonly mascota?: string | undefined;
}

export function responderSinConexion(
  reglas: ReglasLocales,
  consulta: ConsultaSinConexion,
): ResultadoSinConexion {
  const limpio = normalizar(consulta.texto);

  if (reglas.riesgo.expresiones.some((expresion) => limpio.includes(expresion))) {
    return {
      tipo: 'riesgo',
      mensaje: reglas.riesgo.mensaje,
      lineas: lineasDeLaZona(reglas, consulta.zona),
    };
  }

  const palabras = palabrasDe(consulta.texto);
  const relleno = new Set([...reglas.charla.relleno, ...palabrasDe(consulta.mascota ?? '')]);
  const charla = reconocerCharla(palabras, reglas.charla.reglas, relleno);

  if (charla !== undefined) {
    if (charla.mensaje === null) {
      return { tipo: 'exige-conexion' };
    }

    const variante = charla.variantes.find((una) => contieneAlguno(palabras, una.patrones));

    return {
      tipo: 'charla',
      intencion: charla.intencion,
      mensaje: variante?.mensaje ?? charla.mensaje,
    };
  }

  const regla = reglas.intenciones.find((una) => contieneAlguno(palabras, una.patrones));

  // Ni una regla que coincida, ni una que se pueda responder sin conexion: hace falta conexion.
  if (regla?.mensaje == null) {
    return { tipo: 'exige-conexion' };
  }

  return {
    tipo: 'ayuda',
    intencion: regla.intencion,
    mensaje: regla.mensaje,
    lineas: regla.conLineas ? lineasDeLaZona(reglas, consulta.zona) : [],
  };
}

// ---------------------------------------------------------------------------
// Lo que se acepta
// ---------------------------------------------------------------------------

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string';
}

function sonTextos(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor) && valor.every(esTexto);
}

function esTextoOpcional(valor: unknown): boolean {
  return valor === undefined || esTexto(valor);
}

function esLinea(valor: unknown): valor is LineaDeAtencion {
  return (
    esObjeto(valor) &&
    esTexto(valor.id) &&
    valor.id !== '' &&
    esTexto(valor.titulo) &&
    esTexto(valor.tipo) &&
    esTextoOpcional(valor.descripcion) &&
    esTextoOpcional(valor.cobertura) &&
    esTextoOpcional(valor.enlace)
  );
}

function sonLineas(valor: unknown): boolean {
  return Array.isArray(valor) && valor.every(esLinea);
}

function esTextoONulo(valor: unknown): boolean {
  return valor === null || esTexto(valor);
}

function esVariante(valor: unknown): boolean {
  return esObjeto(valor) && sonTextos(valor.patrones) && esTexto(valor.mensaje);
}

function esReglaDeCharla(valor: unknown): boolean {
  return (
    esObjeto(valor) &&
    esTexto(valor.intencion) &&
    sonTextos(valor.patrones) &&
    esTextoONulo(valor.mensaje) &&
    Array.isArray(valor.variantes) &&
    valor.variantes.every(esVariante)
  );
}

function esReglaDeIntencion(valor: unknown): boolean {
  return (
    esObjeto(valor) &&
    esTexto(valor.intencion) &&
    sonTextos(valor.patrones) &&
    esTextoONulo(valor.mensaje) &&
    typeof valor.conLineas === 'boolean'
  );
}

function esPais(valor: unknown): boolean {
  return esObjeto(valor) && sonTextos(valor.zonas) && sonLineas(valor.lineas);
}

/**
 * Si algo que se leyo del servidor o del dispositivo es un paquete de reglas que esta
 * aplicacion sabe aplicar: del esquema que conoce y con todo lo que el motor usa.
 *
 * **Un paquete de otro esquema no se usa.** Lo que se guardo hace tiempo, o lo que
 * publique un servidor mas nuevo, no debe romper la pantalla ni responder mal: se sigue
 * con lo que ya habia, o con nada.
 */
export function esReglasLocales(valor: unknown): valor is ReglasLocales {
  if (!esObjeto(valor) || valor.esquema !== ESQUEMA_QUE_ENTIENDE_LA_APLICACION) {
    return false;
  }

  const { riesgo, charla, paises } = valor;

  return (
    esObjeto(riesgo) &&
    sonTextos(riesgo.expresiones) &&
    esTexto(riesgo.mensaje) &&
    esObjeto(charla) &&
    Array.isArray(charla.reglas) &&
    charla.reglas.every(esReglaDeCharla) &&
    sonTextos(charla.relleno) &&
    Array.isArray(valor.intenciones) &&
    valor.intenciones.every(esReglaDeIntencion) &&
    esObjeto(paises) &&
    Object.values(paises).every(esPais) &&
    sonLineas(valor.internacional)
  );
}
