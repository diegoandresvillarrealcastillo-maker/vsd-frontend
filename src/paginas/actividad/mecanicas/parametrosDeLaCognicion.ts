import { MAXIMO_DE_RONDAS } from './cognicion.ts';
import { esEntero, esObjeto, esTexto, leerLista, sinRepetir } from './parametrosDeLaSesion.ts';

/**
 * Lo que el servidor manda en `sesion.parametros` para los motores de Cognicion que suma SCRUM-225 (ADR 0030),
 * leido con cuidado: `tocar_el_objetivo` (flujo y puntos), `ver_ocultar_recordar` (lista y escena), `clasificar`
 * (intruso y cestas), `palabras` y `calculo`.
 *
 * Igual que en `parametrosDeLaSesion.ts`, cada lectura devuelve `null` ante una forma que no entiende (una
 * copia guardada por una version anterior, o los parametros de un servidor mas nuevo): la pantalla dice que
 * necesita la sesion de hoy en lugar de pintarse a medias. **Tolera lo que sobra** y devuelve **copias**.
 *
 * Son pantallas de una sesion: no tienen respaldo, porque lo que se juega sale entero de la sesion.
 *
 * **Se juegan hasta siete rondas** (SCRUM-288, `MAXIMO_DE_RONDAS`): los lectores de los juegos de rondas
 * (`intruso`, `calculo`, las preguntas de la escena y las palabras) se quedan con las siete primeras. El
 * puntaje de esas pantallas es la proporcion de aciertos por `puntosMaximos`, asi que el maximo no cambia.
 */

const claveDe = (valor: unknown): valor is string => esTexto(valor);

// ---------------------------------------------------------------------------
// tocar_el_objetivo · flujo (COG-05)
// ---------------------------------------------------------------------------

export interface SimboloDelFlujo {
  readonly clave: string;
  readonly nombre: string;
  readonly pictograma: string;
}

export interface ParametrosDeFlujo {
  readonly objetivos: readonly SimboloDelFlujo[];
  readonly otros: readonly SimboloDelFlujo[];
  /** Las claves, en el orden en que aparecen. */
  readonly secuencia: readonly string[];
  readonly msPorEstimulo: number;
  readonly puntosMaximos: number;
}

function leerSimbolo(item: unknown): SimboloDelFlujo | null {
  if (
    !esObjeto(item) ||
    !claveDe(item.clave) ||
    !esTexto(item.nombre) ||
    !esTexto(item.pictograma)
  ) {
    return null;
  }

  return { clave: item.clave, nombre: item.nombre, pictograma: item.pictograma };
}

export function leerFlujo(parametros: unknown): ParametrosDeFlujo | null {
  if (!esObjeto(parametros) || parametros.modo !== 'flujo') {
    return null;
  }

  const objetivos = leerLista(parametros.objetivos, 1, 2, leerSimbolo);
  const otros = leerLista(parametros.otros, 2, 8, leerSimbolo);
  const secuencia = leerLista(parametros.secuencia, 10, 60, (item) =>
    claveDe(item) ? item : null,
  );

  if (
    objetivos === null ||
    otros === null ||
    secuencia === null ||
    // Mas de un estimulo por segundo seria un destello rapido (R10): se rechaza, no se acepta mas rapido.
    !esEntero(parametros.msPorEstimulo, 1000, 3000) ||
    !esEntero(parametros.puntosMaximos, 1, 100)
  ) {
    return null;
  }

  const conocidas = new Set([...objetivos, ...otros].map((simbolo) => simbolo.clave));

  if (
    conocidas.size !== objetivos.length + otros.length ||
    secuencia.some((clave) => !conocidas.has(clave))
  ) {
    return null;
  }

  return {
    objetivos,
    otros,
    secuencia,
    msPorEstimulo: parametros.msPorEstimulo,
    puntosMaximos: parametros.puntosMaximos,
  };
}

// ---------------------------------------------------------------------------
// tocar_el_objetivo · puntos (COG-08)
// ---------------------------------------------------------------------------

export interface PuntoDelTablero {
  readonly etiqueta: string;
  /** Porcentajes de la tabla, de 5 a 95. */
  readonly x: number;
  readonly y: number;
}

export interface ParametrosDePuntos {
  readonly indicacion: string;
  /** En el orden en que se tocan. */
  readonly puntos: readonly PuntoDelTablero[];
  readonly puntosMaximos: number;
}

export function leerPuntos(parametros: unknown): ParametrosDePuntos | null {
  if (!esObjeto(parametros) || parametros.modo !== 'puntos' || !esTexto(parametros.indicacion)) {
    return null;
  }

  const puntos = leerLista(parametros.puntos, 5, 20, (item): PuntoDelTablero | null =>
    esObjeto(item) && esTexto(item.etiqueta) && esEntero(item.x, 5, 95) && esEntero(item.y, 5, 95)
      ? { etiqueta: item.etiqueta, x: item.x, y: item.y }
      : null,
  );

  if (
    puntos === null ||
    !esEntero(parametros.puntosMaximos, 1, 100) ||
    !sinRepetir(puntos.map((punto) => punto.etiqueta))
  ) {
    return null;
  }

  return { indicacion: parametros.indicacion, puntos, puntosMaximos: parametros.puntosMaximos };
}

// ---------------------------------------------------------------------------
// ver_ocultar_recordar · lista (COG-06)
// ---------------------------------------------------------------------------

export interface ElementoDeLaLista {
  readonly clave: string;
  readonly nombre: string;
}

export interface ParametrosDeLista {
  readonly contexto: string;
  readonly segundosVista: number;
  readonly elementos: readonly ElementoDeLaLista[];
  readonly distractores: readonly ElementoDeLaLista[];
  readonly puntosMaximos: number;
}

function leerElemento(item: unknown): ElementoDeLaLista | null {
  return esObjeto(item) && claveDe(item.clave) && esTexto(item.nombre)
    ? { clave: item.clave, nombre: item.nombre }
    : null;
}

export function leerLaLista(parametros: unknown): ParametrosDeLista | null {
  if (!esObjeto(parametros) || parametros.modo !== 'lista' || !esTexto(parametros.contexto)) {
    return null;
  }

  const elementos = leerLista(parametros.elementos, 3, 8, leerElemento);
  const distractores = leerLista(parametros.distractores, 2, 6, leerElemento);

  if (
    elementos === null ||
    distractores === null ||
    !esEntero(parametros.segundosVista, 5, 30) ||
    !esEntero(parametros.puntosMaximos, 1, 100) ||
    !sinRepetir([...elementos, ...distractores].map((una) => una.clave))
  ) {
    return null;
  }

  return {
    contexto: parametros.contexto,
    segundosVista: parametros.segundosVista,
    elementos,
    distractores,
    puntosMaximos: parametros.puntosMaximos,
  };
}

// ---------------------------------------------------------------------------
// ver_ocultar_recordar · escena (COG-09)
// ---------------------------------------------------------------------------

export interface FiguraDeLaEscena {
  readonly pictograma: string;
  readonly nombre: string;
}

export interface CeldaDeLaEscena extends FiguraDeLaEscena {
  readonly fila: number;
  readonly columna: number;
}

export interface PreguntaDeLaEscena {
  readonly texto: string;
  readonly fila: number;
  readonly columna: number;
  readonly opciones: readonly FiguraDeLaEscena[];
  readonly correcta: number;
}

export interface ParametrosDeEscena {
  readonly segundosVista: number;
  readonly filas: number;
  readonly columnas: number;
  readonly celdas: readonly CeldaDeLaEscena[];
  readonly preguntas: readonly PreguntaDeLaEscena[];
  readonly puntosMaximos: number;
}

function leerFigura(item: unknown): FiguraDeLaEscena | null {
  return esObjeto(item) && esTexto(item.pictograma) && esTexto(item.nombre)
    ? { pictograma: item.pictograma, nombre: item.nombre }
    : null;
}

export function leerLaEscena(parametros: unknown): ParametrosDeEscena | null {
  if (!esObjeto(parametros) || parametros.modo !== 'escena') {
    return null;
  }

  const { filas, columnas } = parametros;

  if (!esEntero(filas, 2, 4) || !esEntero(columnas, 2, 4)) {
    return null;
  }

  const celdas = leerLista(parametros.celdas, 4, 16, (item): CeldaDeLaEscena | null => {
    const figura = leerFigura(item);

    return figura !== null &&
      esObjeto(item) &&
      esEntero(item.fila, 1, filas) &&
      esEntero(item.columna, 1, columnas)
      ? { ...figura, fila: item.fila, columna: item.columna }
      : null;
  });

  const preguntas = leerLista(parametros.preguntas, 3, 8, (item): PreguntaDeLaEscena | null => {
    if (
      !esObjeto(item) ||
      !esTexto(item.texto) ||
      !esEntero(item.fila, 1, filas) ||
      !esEntero(item.columna, 1, columnas)
    ) {
      return null;
    }

    const opciones = leerLista(item.opciones, 3, 4, leerFigura);

    return opciones !== null && esEntero(item.correcta, 0, opciones.length - 1)
      ? {
          texto: item.texto,
          fila: item.fila,
          columna: item.columna,
          opciones,
          correcta: item.correcta,
        }
      : null;
  });

  if (
    celdas === null ||
    preguntas === null ||
    !esEntero(parametros.segundosVista, 5, 20) ||
    !esEntero(parametros.puntosMaximos, 1, 100) ||
    // Dos figuras en un mismo lugar, o una pregunta por un lugar vacio, no tienen respuesta.
    new Set(celdas.map((celda) => `${celda.fila},${celda.columna}`)).size !== celdas.length ||
    preguntas.some(
      (pregunta) =>
        !celdas.some((celda) => celda.fila === pregunta.fila && celda.columna === pregunta.columna),
    )
  ) {
    return null;
  }

  return {
    segundosVista: parametros.segundosVista,
    filas,
    columnas,
    celdas,
    preguntas: preguntas.slice(0, MAXIMO_DE_RONDAS),
    puntosMaximos: parametros.puntosMaximos,
  };
}

// ---------------------------------------------------------------------------
// clasificar · intruso (COG-02)
// ---------------------------------------------------------------------------

export interface RondaDeIntruso {
  readonly palabras: readonly string[];
  readonly intruso: number;
  readonly razon: string;
}

export interface ParametrosDeIntruso {
  readonly rondas: readonly RondaDeIntruso[];
  readonly puntosMaximos: number;
}

export function leerIntruso(parametros: unknown): ParametrosDeIntruso | null {
  if (!esObjeto(parametros) || parametros.modo !== 'intruso') {
    return null;
  }

  const rondas = leerLista(parametros.rondas, 3, 10, (item): RondaDeIntruso | null => {
    if (!esObjeto(item) || !esTexto(item.razon) || !esEntero(item.intruso, 0, 3)) {
      return null;
    }

    const palabras = leerLista(item.palabras, 4, 4, (palabra) =>
      esTexto(palabra) ? palabra : null,
    );

    return palabras !== null && sinRepetir(palabras)
      ? { palabras, intruso: item.intruso, razon: item.razon }
      : null;
  });

  if (rondas === null || !esEntero(parametros.puntosMaximos, 1, 100)) {
    return null;
  }

  return { rondas: rondas.slice(0, MAXIMO_DE_RONDAS), puntosMaximos: parametros.puntosMaximos };
}

// ---------------------------------------------------------------------------
// clasificar · cestas (COG-03, EMO-04)
// ---------------------------------------------------------------------------

export interface CestaDeLaMesa {
  readonly clave: string;
  readonly nombre: string;
}

export interface ElementoPorClasificar {
  readonly clave: string;
  readonly nombre: string;
  /** Las cestas donde tiene su sitio (varias si es ambiguo). Vacio en un ejercicio de reflexion. */
  readonly sitios: readonly string[];
}

export interface ParametrosDeCestas {
  readonly indicacion: string;
  readonly cestas: readonly CestaDeLaMesa[];
  readonly elementos: readonly ElementoPorClasificar[];
  /** Presente si cada elemento tiene su cesta: se puntua. Ausente: es un ejercicio de reflexion. */
  readonly puntosMaximos?: number;
  readonly linea?: { readonly invitacion: string; readonly largoMaximo: number };
  readonly cierre?: string;
}

export function leerLasCestas(parametros: unknown): ParametrosDeCestas | null {
  if (!esObjeto(parametros) || parametros.modo !== 'cestas' || !esTexto(parametros.indicacion)) {
    return null;
  }

  const cestas = leerLista(parametros.cestas, 2, 3, (item): CestaDeLaMesa | null =>
    esObjeto(item) && claveDe(item.clave) && esTexto(item.nombre)
      ? { clave: item.clave, nombre: item.nombre }
      : null,
  );

  if (cestas === null) {
    return null;
  }

  const clavesDeCestas = new Set(cestas.map((cesta) => cesta.clave));
  const elementos = leerLista(parametros.elementos, 4, 16, (item): ElementoPorClasificar | null => {
    if (!esObjeto(item) || !claveDe(item.clave) || !esTexto(item.nombre)) {
      return null;
    }

    const sitios =
      item.cesta === undefined
        ? []
        : Array.isArray(item.cesta)
          ? (item.cesta as unknown[])
          : [item.cesta];

    return sitios.every((sitio): sitio is string => claveDe(sitio) && clavesDeCestas.has(sitio))
      ? { clave: item.clave, nombre: item.nombre, sitios }
      : null;
  });

  if (elementos === null || !sinRepetir(elementos.map((elemento) => elemento.clave))) {
    return null;
  }

  const conSitio = elementos.filter((elemento) => elemento.sitios.length > 0).length;

  // O todos tienen su sitio (se puntua) o ninguno (se reflexiona): mezclados no se sabria que hacer.
  if (conSitio !== 0 && conSitio !== elementos.length) {
    return null;
  }

  const puntua = conSitio > 0;
  const puntosMaximos = parametros.puntosMaximos;

  if (puntua !== (puntosMaximos !== undefined) || (puntua && !esEntero(puntosMaximos, 1, 100))) {
    return null;
  }

  const linea = parametros.linea;
  const lineaLeida =
    linea === undefined
      ? undefined
      : esObjeto(linea) && esTexto(linea.invitacion) && esEntero(linea.largoMaximo, 50, 500)
        ? { invitacion: linea.invitacion, largoMaximo: linea.largoMaximo }
        : null;

  if (lineaLeida === null || (parametros.cierre !== undefined && !esTexto(parametros.cierre))) {
    return null;
  }

  return {
    indicacion: parametros.indicacion,
    cestas,
    elementos,
    ...(puntua ? { puntosMaximos: puntosMaximos as number } : {}),
    ...(lineaLeida === undefined ? {} : { linea: lineaLeida }),
    ...(typeof parametros.cierre === 'string' ? { cierre: parametros.cierre } : {}),
  };
}

// ---------------------------------------------------------------------------
// palabras (COG-07)
// ---------------------------------------------------------------------------

export interface PalabraDelJuego {
  readonly pista: string;
  readonly palabra: string;
  /** Las posiciones que faltan (completar). */
  readonly faltan?: readonly number[];
  /** Las letras revueltas (anagrama). */
  readonly revuelta?: string;
}

export interface ParametrosDePalabras {
  readonly modo: 'completar' | 'anagrama';
  readonly palabras: readonly PalabraDelJuego[];
  readonly puntosMaximos: number;
}

export function leerLasPalabras(parametros: unknown): ParametrosDePalabras | null {
  if (
    !esObjeto(parametros) ||
    (parametros.modo !== 'completar' && parametros.modo !== 'anagrama')
  ) {
    return null;
  }

  const modo = parametros.modo;
  const palabras = leerLista(parametros.palabras, 3, 10, (item): PalabraDelJuego | null => {
    if (
      !esObjeto(item) ||
      !esTexto(item.pista) ||
      !esTexto(item.palabra) ||
      !/^\p{L}+$/u.test(item.palabra)
    ) {
      return null;
    }

    const largo = [...item.palabra].length;

    if (modo === 'anagrama') {
      return esTexto(item.revuelta) && [...item.revuelta].length === largo
        ? { pista: item.pista, palabra: item.palabra, revuelta: item.revuelta }
        : null;
    }

    const faltan = leerLista(item.faltan, 1, 3, (lugar) =>
      esEntero(lugar, 0, largo - 1) ? lugar : null,
    );

    return faltan !== null && new Set(faltan).size === faltan.length
      ? { pista: item.pista, palabra: item.palabra, faltan }
      : null;
  });

  if (palabras === null || !esEntero(parametros.puntosMaximos, 1, 100)) {
    return null;
  }

  return {
    modo,
    palabras: palabras.slice(0, MAXIMO_DE_RONDAS),
    puntosMaximos: parametros.puntosMaximos,
  };
}

// ---------------------------------------------------------------------------
// calculo (COG-04)
// ---------------------------------------------------------------------------

export interface RondaDeCalculo {
  readonly enunciado: string;
  readonly opciones: readonly string[];
  readonly correcta: number;
}

export interface ParametrosDeCalculo {
  readonly rondas: readonly RondaDeCalculo[];
  readonly puntosMaximos: number;
}

export function leerElCalculo(parametros: unknown): ParametrosDeCalculo | null {
  if (!esObjeto(parametros)) {
    return null;
  }

  const rondas = leerLista(parametros.rondas, 3, 10, (item): RondaDeCalculo | null => {
    if (!esObjeto(item) || !esTexto(item.enunciado) || !esEntero(item.correcta, 0, 2)) {
      return null;
    }

    const opciones = leerLista(item.opciones, 3, 3, (opcion) => (esTexto(opcion) ? opcion : null));

    return opciones !== null && sinRepetir(opciones)
      ? { enunciado: item.enunciado, opciones, correcta: item.correcta }
      : null;
  });

  if (rondas === null || !esEntero(parametros.puntosMaximos, 1, 100)) {
    return null;
  }

  return { rondas: rondas.slice(0, MAXIMO_DE_RONDAS), puntosMaximos: parametros.puntosMaximos };
}
