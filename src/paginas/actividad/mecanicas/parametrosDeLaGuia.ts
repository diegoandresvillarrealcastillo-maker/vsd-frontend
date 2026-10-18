import { esEntero, esObjeto, esTexto, type Objeto } from './parametrosDeLaSesion.ts';

/**
 * Lo que el servidor manda en `sesion.parametros` para una guia de pasos (SCRUM-226, ADR 0030): el motor
 * `guia_paso_a_paso` en su modo `pasos`, que sirve al estiramiento (BIE-02), el escaneo corporal (BIE-06), el
 * respiro del dia (BIE-09), el ancla 5-4-3-2-1 (EMO-03) y el lugar tranquilo (EMO-07).
 *
 * Igual que en `parametrosDeLaSesion.ts`, la lectura devuelve `null` ante una forma que no entiende: la pantalla
 * dice que necesita la sesion de hoy en lugar de pintarse a medias. **Tolera lo que sobra** y devuelve
 * **copias**. Repite los limites del contrato del dominio porque aqui puede llegar una copia guardada por una
 * version anterior, o los parametros de un servidor mas nuevo.
 */

export interface PasoDeLaGuia {
  readonly titulo?: string;
  readonly texto: string;
  /** Una clave de pictograma (`sol`) o de figura de estiramiento (`cuello:inclinar-der`). */
  readonly pictograma?: string;
  /** Cuanto dura el paso, con `avance: auto`. */
  readonly segundos?: number;
}

export interface EleccionDeLaGuia {
  readonly clave: string;
  readonly nombre: string;
  readonly descripcion?: string;
  readonly pictograma?: string;
  readonly pasos: readonly PasoDeLaGuia[];
}

export interface ParametrosDePasos {
  /** `manual`: la persona toca para seguir y no hay tiempo. `auto`: cada paso dura sus `segundos`. */
  readonly avance: 'manual' | 'auto';
  readonly advertenciaInicial?: string;
  readonly intro?: string;
  /** Una guia tiene pasos o elecciones, nunca las dos cosas. */
  readonly pasos?: readonly PasoDeLaGuia[];
  readonly elecciones?: readonly EleccionDeLaGuia[];
  readonly cierre?: string;
  /** Una frase que queda a la vista durante toda la guia. */
  readonly avisoSiempre?: string;
  /** Junto al aviso, el acceso a las lineas de atencion. */
  readonly conLineasDeAyuda: boolean;
  readonly haptico: boolean;
}

function leerPaso(item: unknown, auto: boolean): PasoDeLaGuia | null {
  if (!esObjeto(item) || !esTexto(item.texto)) {
    return null;
  }

  const { titulo, pictograma, segundos } = item;

  if (
    (titulo !== undefined && !esTexto(titulo)) ||
    (pictograma !== undefined && !esTexto(pictograma)) ||
    (segundos !== undefined && !esEntero(segundos, 5, 180)) ||
    // Con avance automatico, un paso sin su duracion no sabria cuando pasar.
    (auto && segundos === undefined)
  ) {
    return null;
  }

  return {
    ...(titulo === undefined ? {} : { titulo }),
    texto: item.texto,
    ...(pictograma === undefined ? {} : { pictograma }),
    ...(segundos === undefined ? {} : { segundos }),
  };
}

function leerPasos(valor: unknown, auto: boolean): PasoDeLaGuia[] | null {
  if (!Array.isArray(valor) || valor.length < 2 || valor.length > 12) {
    return null;
  }

  const pasos: PasoDeLaGuia[] = [];

  for (const item of valor as unknown[]) {
    const paso = leerPaso(item, auto);

    if (paso === null) {
      return null;
    }

    pasos.push(paso);
  }

  return pasos;
}

function leerEleccion(item: unknown, auto: boolean): EleccionDeLaGuia | null {
  if (!esObjeto(item) || !esTexto(item.clave) || !esTexto(item.nombre)) {
    return null;
  }

  const { descripcion, pictograma } = item;
  const pasos = leerPasos(item.pasos, auto);

  if (
    pasos === null ||
    (descripcion !== undefined && !esTexto(descripcion)) ||
    (pictograma !== undefined && !esTexto(pictograma))
  ) {
    return null;
  }

  return {
    clave: item.clave,
    nombre: item.nombre,
    ...(descripcion === undefined ? {} : { descripcion }),
    ...(pictograma === undefined ? {} : { pictograma }),
    pasos,
  };
}

function textoOpcional(parametros: Objeto, campo: string): string | undefined | null {
  const valor = parametros[campo];

  if (valor === undefined) {
    return undefined;
  }

  return esTexto(valor) ? valor : null;
}

export function leerLosPasos(parametros: unknown): ParametrosDePasos | null {
  if (!esObjeto(parametros) || parametros.modo !== 'pasos') {
    return null;
  }

  const { avance } = parametros;

  if (avance !== 'manual' && avance !== 'auto') {
    return null;
  }

  const auto = avance === 'auto';
  const conPasos = parametros.pasos !== undefined;
  const conElecciones = parametros.elecciones !== undefined;

  // O pasos o elecciones: con las dos, o con ninguna, no se sabria que recorrer.
  if (conPasos === conElecciones) {
    return null;
  }

  const pasos = conPasos ? leerPasos(parametros.pasos, auto) : undefined;
  let elecciones: EleccionDeLaGuia[] | undefined;

  if (conElecciones) {
    const crudas = parametros.elecciones;

    if (!Array.isArray(crudas) || crudas.length < 2 || crudas.length > 4) {
      return null;
    }

    const leidas = (crudas as unknown[]).map((item) => leerEleccion(item, auto));

    if (leidas.some((una) => una === null)) {
      return null;
    }

    elecciones = leidas as EleccionDeLaGuia[];

    const claves = new Set(elecciones.map((una) => una.clave));

    if (claves.size !== elecciones.length) {
      return null;
    }
  }

  const advertenciaInicial = textoOpcional(parametros, 'advertenciaInicial');
  const intro = textoOpcional(parametros, 'intro');
  const cierre = textoOpcional(parametros, 'cierre');
  const avisoSiempre = textoOpcional(parametros, 'avisoSiempre');
  const conLineasDeAyuda = parametros.conLineasDeAyuda ?? false;
  const haptico = parametros.haptico ?? false;

  if (
    pasos === null ||
    advertenciaInicial === null ||
    intro === null ||
    cierre === null ||
    avisoSiempre === null ||
    typeof conLineasDeAyuda !== 'boolean' ||
    typeof haptico !== 'boolean' ||
    // El acceso a las lineas va con su frase.
    (conLineasDeAyuda && avisoSiempre === undefined)
  ) {
    return null;
  }

  return {
    avance,
    ...(advertenciaInicial === undefined ? {} : { advertenciaInicial }),
    ...(intro === undefined ? {} : { intro }),
    ...(pasos === undefined ? {} : { pasos }),
    ...(elecciones === undefined ? {} : { elecciones }),
    ...(cierre === undefined ? {} : { cierre }),
    ...(avisoSiempre === undefined ? {} : { avisoSiempre }),
    conLineasDeAyuda,
    haptico,
  };
}
