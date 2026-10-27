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
 * 2. **El lenguaje ofensivo** (SCRUM-192), despues del riesgo y nunca antes.
 * 3. **La charla**, solo si el mensaje **entero** es charla.
 * 4. **Lo demas que se reconoce**, la primera regla que coincide.
 * 5. **El fallback** (SCRUM-176), si nada se reconoce: sin lineas de atencion.
 *
 * Antes de todo, las erratas se leen como se quisieron escribir (SCRUM-193): una tabla y la
 * distancia de edicion de uno hacia una palabra que el asistente ya conoce, con las mismas
 * condiciones que en el servidor (`LecturaDelTexto.ts` del backend). La tolerancia **solo suma**
 * al riesgo, y el lenguaje ofensivo solo usa la tabla.
 *
 * Y lo que no se puede responder sin conexion **no se inventa**: `exige-conexion`.
 */

// ---------------------------------------------------------------------------
// Leer lo que escribe la persona
// ---------------------------------------------------------------------------

/**
 * Deja el texto comparable: sin tildes, en minusculas y con los espacios colapsados.
 * NFKD unifica variantes compatibles; se quitan invisibles y todas las marcas Unicode.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/\p{Default_Ignorable_Code_Point}/gu, '')
    .replace(/\p{M}/gu, '')
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

// ---------------------------------------------------------------------------
// Erratas (SCRUM-193): el mismo algoritmo que el servidor
// ---------------------------------------------------------------------------

/**
 * La distancia de Damerau-Levenshtein: cuantas inserciones, borrados, sustituciones o cambios
 * de dos letras contiguas separan una palabra de otra.
 */
export function distanciaDeEdicion(a: string, b: string): number {
  const tabla: number[][] = Array.from({ length: a.length + 1 }, (_fila, i) =>
    Array.from({ length: b.length + 1 }, (_columna, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let mejor = Math.min(
        (tabla[i - 1]?.[j] ?? 0) + 1,
        (tabla[i]?.[j - 1] ?? 0) + 1,
        (tabla[i - 1]?.[j - 1] ?? 0) + costo,
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        mejor = Math.min(mejor, (tabla[i - 2]?.[j - 2] ?? 0) + 1);
      }

      tabla[i]![j] = mejor;
    }
  }

  return tabla[a.length]?.[b.length] ?? 0;
}

/** Menos letras que esto y una palabra no se corrige por distancia. */
const LARGO_MINIMO_PARA_CORREGIR = 5;

/**
 * Las palabras que el asistente conoce, sacadas de listas de patrones y frases. Las raices
 * (`psicolog*`) quedan fuera: no son una palabra hacia la que se pueda corregir.
 */
function vocabularioDe(listas: readonly (readonly string[])[]): ReadonlySet<string> {
  const vocabulario = new Set<string>();

  for (const lista of listas) {
    for (const patron of lista) {
      for (const palabra of patron.split(' ')) {
        if (palabra !== '' && !palabra.endsWith('*')) {
          vocabulario.add(palabra);
        }
      }
    }
  }

  return vocabulario;
}

/**
 * La unica palabra del vocabulario a una letra de esta, o `undefined`. Con las mismas
 * condiciones que el servidor: cinco letras o mas, la misma primera y ultima letra (lo que cambia
 * al final suele ser de quien se habla: «aguanta» no es «aguanto») y **un solo** candidato.
 */
function candidataUnica(palabra: string, vocabulario: ReadonlySet<string>): string | undefined {
  const primera = palabra.charAt(0);
  const ultima = palabra.charAt(palabra.length - 1);
  let encontrada: string | undefined;

  for (const candidata of vocabulario) {
    if (
      candidata.length < LARGO_MINIMO_PARA_CORREGIR ||
      Math.abs(candidata.length - palabra.length) > 1 ||
      !candidata.startsWith(primera) ||
      !candidata.endsWith(ultima) ||
      distanciaDeEdicion(palabra, candidata) !== 1
    ) {
      continue;
    }

    if (encontrada !== undefined) {
      return undefined;
    }

    encontrada = candidata;
  }

  return encontrada;
}

/**
 * Lee las palabras como se quisieron escribir: primero la tabla; despues, si la palabra no esta en
 * el vocabulario, la distancia de edicion. Sin vocabulario solo corrige por la tabla.
 */
function corregirPalabras(
  palabras: readonly string[],
  vocabulario: ReadonlySet<string>,
  erratas: Readonly<Record<string, string>>,
): readonly string[] {
  return palabras.map((palabra) => {
    const porTabla = Object.hasOwn(erratas, palabra) ? erratas[palabra] : undefined;

    if (porTabla !== undefined) {
      return porTabla;
    }

    if (vocabulario.has(palabra) || palabra.length < LARGO_MINIMO_PARA_CORREGIR) {
      return palabra;
    }

    return candidataUnica(palabra, vocabulario) ?? palabra;
  });
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
 * Cierto si el mensaje es un insulto o una orden de callar dirigida al asistente (SCRUM-192):
 * lleva alguno de los terminos **y no** habla de quien lo escribe. «Soy un idiota» o «me siento
 * una mierda» son un desahogo. Ante la duda no cuenta.
 */
function esLenguajeOfensivo(
  palabras: readonly string[],
  regla: { readonly terminos: readonly string[]; readonly desahogo: readonly string[] },
): boolean {
  return contieneAlguno(palabras, regla.terminos) && !contieneAlguno(palabras, regla.desahogo);
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
  | { readonly tipo: 'ofensivo'; readonly intencion: string; readonly mensaje: string }
  | {
      readonly tipo: 'fallback';
      readonly intencion: string;
      readonly mensaje: string;
      readonly sugerencias: readonly string[];
    }
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
  const dichas = palabrasDe(consulta.texto);
  const erratas = reglas.erratas ?? {};
  const vocabulario = vocabularioDe([reglas.riesgo.expresiones]);
  const variantes = [
    consulta.texto,
    consulta.texto.replace(/\p{Default_Ignorable_Code_Point}/gu, ' '),
  ];
  const riesgo = variantes.some((texto) => {
    const limpio = normalizar(texto);
    const corregido = corregirPalabras(palabrasDe(texto), vocabulario, erratas).join(' ');
    return reglas.riesgo.expresiones.some(
      (expresion) => limpio.includes(expresion) || corregido.includes(expresion),
    );
  });

  if (riesgo) {
    return {
      tipo: 'riesgo',
      mensaje: reglas.riesgo.mensaje,
      lineas: lineasDeLaZona(reglas, consulta.zona),
    };
  }

  // Despues del riesgo y antes de la charla (SCRUM-192). Sin lineas y sin conexion: es una frase
  // fija. Un paquete anterior a esto no trae la seccion y no cuenta nada como ofensivo. Solo con
  // la tabla de erratas: una palabra nunca se acerca por distancia a un insulto.
  if (
    reglas.ofensivo !== undefined &&
    esLenguajeOfensivo(corregirPalabras(dichas, new Set(), erratas), reglas.ofensivo)
  ) {
    return { tipo: 'ofensivo', intencion: 'lenguaje_ofensivo', mensaje: reglas.ofensivo.mensaje };
  }

  // Lo demas se lee con las erratas corregidas, con el vocabulario que traen las propias reglas.
  const palabras = corregirPalabras(
    dichas,
    vocabularioDe([
      ...reglas.charla.reglas.flatMap((regla) => [
        regla.patrones,
        ...regla.variantes.map((variante) => variante.patrones),
      ]),
      ...reglas.intenciones.map((regla) => regla.patrones),
      reglas.charla.relleno,
    ]),
    erratas,
  );

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

  // Nada se reconoce: el fallback (SCRUM-176, SCRUM-193), sin lineas de atencion y con el
  // catalogo de temas. Es una frase fija y se responde igual sin conexion. Un paquete anterior no
  // lo trae: ahi no se inventa nada.
  if (regla === undefined && reglas.fallback !== undefined) {
    return {
      tipo: 'fallback',
      intencion: 'no_reconocida',
      mensaje: reglas.fallback.mensaje,
      sugerencias: [...reglas.fallback.sugerencias],
    };
  }

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
    esTextoOpcional(valor.enlace) &&
    esTextoOpcional(valor.telefono)
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

/** La tabla de erratas (SCRUM-193), si viene: un objeto de texto a texto. */
function esTablaDeErratas(valor: unknown): boolean {
  return esObjeto(valor) && Object.values(valor).every(esTexto);
}

/** El fallback (SCRUM-176), si viene: un mensaje y su catalogo de frases. */
function esFallback(valor: unknown): boolean {
  return esObjeto(valor) && esTexto(valor.mensaje) && sonTextos(valor.sugerencias);
}

/** La seccion ofensiva (SCRUM-192), si viene: completa y bien formada, o el paquete no se usa. */
function esOfensivo(valor: unknown): boolean {
  return (
    esObjeto(valor) &&
    sonTextos(valor.terminos) &&
    sonTextos(valor.desahogo) &&
    typeof valor.umbral === 'number' &&
    Number.isInteger(valor.umbral) &&
    valor.umbral > 0 &&
    esTexto(valor.mensaje) &&
    esTexto(valor.mensajeAlCerrar)
  );
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
    (valor.ofensivo === undefined || esOfensivo(valor.ofensivo)) &&
    (valor.erratas === undefined || esTablaDeErratas(valor.erratas)) &&
    (valor.fallback === undefined || esFallback(valor.fallback)) &&
    Array.isArray(valor.intenciones) &&
    valor.intenciones.every(esReglaDeIntencion) &&
    esObjeto(paises) &&
    Object.values(paises).every(esPais) &&
    sonLineas(valor.internacional)
  );
}
