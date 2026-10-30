import {
  esEntero,
  esObjeto,
  esTexto,
  igualSinMayusculas,
  leerLista,
  sinRepetir,
  type Objeto,
} from './parametrosDeLaSesion.ts';

/**
 * Lo que el servidor manda en `sesion.parametros` para el cuestionario corto **sin puntaje** (SCRUM-227, ADR
 * 0030): el motor `cuestionario_corto` en sus cuatro modos nuevos. Sirven a ocho mecanicas de Bienestar y
 * Emociones.
 *
 * - `tarjeta`: una practica del dia y tres respuestas que cuentan igual (BIE-03, BIE-04, BIE-05).
 * - `lista`: unos gestos que se marcan, los que se hicieron o se haran (BIE-07).
 * - `preguntas`: preguntas con una opcion, varias o una hora (BIE-08, EMO-08).
 * - `rueda`: la rueda de emociones, de lo mas amplio a lo mas fino (EMO-01).
 *
 * Ninguno lleva `valor` en sus opciones: lo que se responde no suma ni se interpreta (R7). Igual que en
 * `parametrosDeLaSesion.ts`, cada lectura devuelve `null` ante una forma que no entiende, tolera lo que sobra y
 * devuelve copias. El cuestionario **con puntaje** (sin `modo`) sigue en `Cuestionario.tsx`.
 */

export interface OpcionSinValor {
  readonly clave: string;
  readonly texto: string;
}

function leerOpcion(item: unknown): OpcionSinValor | null {
  return esObjeto(item) && esTexto(item.clave) && esTexto(item.texto)
    ? { clave: item.clave, texto: item.texto }
    : null;
}

/** Una lista de opciones con claves y textos que no se repiten. */
function leerOpciones(valor: unknown, minimo: number, maximo: number): OpcionSinValor[] | null {
  const opciones = leerLista(valor, minimo, maximo, leerOpcion);

  return opciones !== null &&
    sinRepetir(opciones.map((una) => una.clave)) &&
    sinRepetir(opciones.map((una) => una.texto))
    ? opciones
    : null;
}

/** Un texto opcional: `undefined` si no esta, `null` si esta y no es un texto. */
function textoOpcional(parametros: Objeto, campo: string): string | undefined | null {
  const valor = parametros[campo];

  if (valor === undefined) {
    return undefined;
  }

  return esTexto(valor) ? valor : null;
}

/** Lo opcional que todos los modos comparten: la nota de abajo y el cierre. */
interface Comunes {
  readonly nota?: string;
  readonly cierre?: string;
}

function leerComunes(parametros: Objeto): Comunes | null {
  const nota = textoOpcional(parametros, 'nota');
  const cierre = textoOpcional(parametros, 'cierre');

  if (nota === null || cierre === null) {
    return null;
  }

  return {
    ...(nota === undefined ? {} : { nota }),
    ...(cierre === undefined ? {} : { cierre }),
  };
}

// ---------------------------------------------------------------------------
// tarjeta (BIE-03, BIE-04, BIE-05)
// ---------------------------------------------------------------------------

export interface ParametrosDeTarjeta extends Comunes {
  readonly indicacion?: string;
  readonly titulo: string;
  readonly texto: string;
  /** El «por que» de la practica, que se abre si se quiere. */
  readonly porQue?: string;
  readonly opciones: readonly OpcionSinValor[];
}

export function leerLaTarjeta(parametros: unknown): ParametrosDeTarjeta | null {
  if (
    !esObjeto(parametros) ||
    parametros.modo !== 'tarjeta' ||
    !esTexto(parametros.titulo) ||
    !esTexto(parametros.texto)
  ) {
    return null;
  }

  const indicacion = textoOpcional(parametros, 'indicacion');
  const porQue = textoOpcional(parametros, 'porQue');
  const opciones = leerOpciones(parametros.opciones, 2, 4);
  const comunes = leerComunes(parametros);

  if (indicacion === null || porQue === null || opciones === null || comunes === null) {
    return null;
  }

  return {
    ...(indicacion === undefined ? {} : { indicacion }),
    titulo: parametros.titulo,
    texto: parametros.texto,
    ...(porQue === undefined ? {} : { porQue }),
    opciones,
    ...comunes,
  };
}

// ---------------------------------------------------------------------------
// lista (BIE-07)
// ---------------------------------------------------------------------------

export interface ParametrosDeGestos extends Comunes {
  readonly indicacion: string;
  readonly items: readonly OpcionSinValor[];
}

export function leerLosGestos(parametros: unknown): ParametrosDeGestos | null {
  if (!esObjeto(parametros) || parametros.modo !== 'lista' || !esTexto(parametros.indicacion)) {
    return null;
  }

  const items = leerOpciones(parametros.items, 3, 6);
  const comunes = leerComunes(parametros);

  if (items === null || comunes === null) {
    return null;
  }

  return { indicacion: parametros.indicacion, items, ...comunes };
}

// ---------------------------------------------------------------------------
// preguntas (BIE-08, EMO-08)
// ---------------------------------------------------------------------------

export type TipoDePregunta = 'opcion' | 'varias' | 'hora';

export interface PreguntaSinPuntaje {
  readonly clave: string;
  readonly texto: string;
  readonly tipo: TipoDePregunta;
  /** Las opciones de `opcion` y `varias`; una pregunta de `hora` no las trae. */
  readonly opciones?: readonly OpcionSinValor[];
  readonly pista?: string;
}

export interface ParametrosDePreguntas extends Comunes {
  readonly indicacion: string;
  readonly preguntas: readonly PreguntaSinPuntaje[];
  /** Ofrece ir a donde se activa el aviso de la noche; la persona decide. */
  readonly enlaceAlAviso: boolean;
  readonly avisoSiempre?: string;
  readonly conLineasDeAyuda: boolean;
}

function leerPregunta(item: unknown): PreguntaSinPuntaje | null {
  if (!esObjeto(item) || !esTexto(item.clave) || !esTexto(item.texto)) {
    return null;
  }

  const { tipo } = item;

  if (tipo !== 'opcion' && tipo !== 'varias' && tipo !== 'hora') {
    return null;
  }

  const pista = textoOpcional(item, 'pista');

  if (pista === null) {
    return null;
  }

  // Una pregunta de hora se responde con el campo de hora: sin opciones. Las otras las necesitan.
  if (tipo === 'hora') {
    return item.opciones === undefined
      ? { clave: item.clave, texto: item.texto, tipo, ...(pista === undefined ? {} : { pista }) }
      : null;
  }

  const opciones = leerOpciones(item.opciones, 2, 8);

  return opciones === null
    ? null
    : {
        clave: item.clave,
        texto: item.texto,
        tipo,
        opciones,
        ...(pista === undefined ? {} : { pista }),
      };
}

export function leerLasPreguntas(parametros: unknown): ParametrosDePreguntas | null {
  if (!esObjeto(parametros) || parametros.modo !== 'preguntas' || !esTexto(parametros.indicacion)) {
    return null;
  }

  const preguntas = leerLista(parametros.preguntas, 1, 6, leerPregunta);
  const comunes = leerComunes(parametros);
  const avisoSiempre = textoOpcional(parametros, 'avisoSiempre');
  const enlaceAlAviso = parametros.enlaceAlAviso ?? false;
  const conLineasDeAyuda = parametros.conLineasDeAyuda ?? false;

  if (
    preguntas === null ||
    comunes === null ||
    avisoSiempre === null ||
    typeof enlaceAlAviso !== 'boolean' ||
    typeof conLineasDeAyuda !== 'boolean' ||
    !sinRepetir(preguntas.map((una) => una.clave)) ||
    // El acceso a las lineas va con su frase.
    (conLineasDeAyuda && avisoSiempre === undefined)
  ) {
    return null;
  }

  return {
    indicacion: parametros.indicacion,
    preguntas,
    enlaceAlAviso,
    ...(avisoSiempre === undefined ? {} : { avisoSiempre }),
    conLineasDeAyuda,
    ...comunes,
  };
}

// ---------------------------------------------------------------------------
// rueda (EMO-01)
// ---------------------------------------------------------------------------

/** Ningun nivel de la rueda pasa de tres. */
const MAXIMO_DE_NIVELES = 3;

export interface NodoDeLaRueda {
  readonly clave: string;
  readonly nombre: string;
  /** Solo en las hojas (las emociones): lo que se lee al elegirla. */
  readonly definicion?: string;
  readonly hijos?: readonly NodoDeLaRueda[];
}

export interface ParametrosDeRueda extends Comunes {
  readonly indicacion: string;
  readonly puerta: { readonly titulo: string; readonly texto: string };
  readonly rueda: readonly NodoDeLaRueda[];
  readonly linea?: { readonly invitacion: string; readonly largoMaximo: number };
}

function leerNodo(item: unknown, profundidad: number, claves: Set<string>): NodoDeLaRueda | null {
  if (!esObjeto(item) || !esTexto(item.clave) || !esTexto(item.nombre)) {
    return null;
  }

  const clave = igualSinMayusculas(item.clave);

  // Las claves son unicas en toda la rueda, no solo entre hermanas.
  if (claves.has(clave)) {
    return null;
  }

  claves.add(clave);

  const definicion = textoOpcional(item, 'definicion');

  if (definicion === null) {
    return null;
  }

  if (item.hijos === undefined) {
    // Una hoja es una emocion: lleva la definicion que se lee al elegirla.
    return definicion === undefined ? null : { clave: item.clave, nombre: item.nombre, definicion };
  }

  if (profundidad >= MAXIMO_DE_NIVELES) {
    return null;
  }

  const hijos = leerLista(item.hijos, 2, 8, (hijo) => leerNodo(hijo, profundidad + 1, claves));

  return hijos === null
    ? null
    : {
        clave: item.clave,
        nombre: item.nombre,
        ...(definicion === undefined ? {} : { definicion }),
        hijos,
      };
}

export function leerLaRueda(parametros: unknown): ParametrosDeRueda | null {
  if (!esObjeto(parametros) || parametros.modo !== 'rueda' || !esTexto(parametros.indicacion)) {
    return null;
  }

  const { puerta, linea } = parametros;

  if (!esObjeto(puerta) || !esTexto(puerta.titulo) || !esTexto(puerta.texto)) {
    return null;
  }

  const claves = new Set<string>();
  const rueda = leerLista(parametros.rueda, 2, 8, (nodo) => leerNodo(nodo, 1, claves));
  const comunes = leerComunes(parametros);
  const lineaLeida =
    linea === undefined
      ? undefined
      : esObjeto(linea) && esTexto(linea.invitacion) && esEntero(linea.largoMaximo, 50, 500)
        ? { invitacion: linea.invitacion, largoMaximo: linea.largoMaximo }
        : null;

  if (rueda === null || comunes === null || lineaLeida === null) {
    return null;
  }

  return {
    indicacion: parametros.indicacion,
    puerta: { titulo: puerta.titulo, texto: puerta.texto },
    rueda,
    ...(lineaLeida === undefined ? {} : { linea: lineaLeida }),
    ...comunes,
  };
}
