/**
 * Lo que el servidor manda en `sesion.parametros`, leido con cuidado (SCRUM-208, ADR 0030).
 *
 * Cada pantalla de la Fase 0 pinta lo que dice la sesion del dia en lugar de lo que traia escrito
 * en el codigo, y vuelve a lo de siempre si no hay sesion. El servidor ya valida el contrato de
 * cada motor, pero aqui puede llegar una **copia guardada por una version anterior** de la
 * aplicacion, o los parametros de un servidor mas nuevo. Por eso cada lectura:
 *
 * - devuelve `null` ante una forma que no entiende, y la pantalla usa sus valores de siempre: una
 *   sesion rara nunca rompe la pantalla;
 * - **tolera lo que sobra** (un parametro nuevo que un servidor mas nuevo agregue no la tumba);
 * - y devuelve **copias**, para que lo leido no cambie si cambia lo recibido.
 *
 * Cada lectura es la de **una pantalla**, no la del motor entero: `leerEscrituraDeUnCampo` solo
 * entiende lo que `UnMomentoBueno` sabe hacer. Los motores completos (varios campos, casillas con
 * forma y color, sin tiempo) llegan con sus propias pantallas, y hasta entonces una sesion que
 * pida mas de lo que la pantalla sabe hacer cae a lo de siempre en lugar de pintarse a medias.
 */

type Objeto = Readonly<Record<string, unknown>>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esEntero(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim() !== '';
}

// ---------------------------------------------------------------------------
// Secuencia de numeros (motor `secuencia`)
// ---------------------------------------------------------------------------

export interface ParametrosDeSecuenciaDeNumeros {
  /** Cuantos digitos tiene la primera secuencia. */
  readonly largoInicial: number;
  readonly rondas: number;
  /** Cuanto tiempo a la vista, por digito. */
  readonly msPorElemento: number;
  /** Tiempo de margen para leerla, sumado al de los digitos. */
  readonly msDeMargen: number;
}

const LOS_DIEZ_DIGITOS = '0123456789';

/** Las casillas son exactamente los diez digitos, cada uno una vez: es lo unico que esta pantalla juega. */
function sonLosDiezDigitos(casillas: unknown): boolean {
  if (!Array.isArray(casillas) || casillas.length !== LOS_DIEZ_DIGITOS.length) {
    return false;
  }

  const claves = casillas.map((casilla: unknown) =>
    esObjeto(casilla) && typeof casilla.clave === 'string' ? casilla.clave : '',
  );

  return LOS_DIEZ_DIGITOS.split('').every((digito) => claves.includes(digito));
}

export function leerSecuenciaDeNumeros(parametros: unknown): ParametrosDeSecuenciaDeNumeros | null {
  if (
    !esObjeto(parametros) ||
    !sonLosDiezDigitos(parametros.casillas) ||
    !esEntero(parametros.largoInicial, 1, 10) ||
    !esEntero(parametros.rondas, 1, 50) ||
    !esEntero(parametros.msPorElemento, 200, 5000) ||
    !esEntero(parametros.msDeMargen, 0, 10_000)
  ) {
    return null;
  }

  return {
    largoInicial: parametros.largoInicial,
    rondas: parametros.rondas,
    msPorElemento: parametros.msPorElemento,
    msDeMargen: parametros.msDeMargen,
  };
}

// ---------------------------------------------------------------------------
// Encuentra la diferencia (motor `tocar_el_objetivo`)
// ---------------------------------------------------------------------------

export interface ParametrosDeTocarElObjetivo {
  readonly rondas: number;
  readonly segundosPorRonda: number;
  /** Tamanos de la cuadricula, de menor a mayor: las rondas se reparten en tramos iguales. */
  readonly lados: readonly number[];
}

export function leerTocarElObjetivo(parametros: unknown): ParametrosDeTocarElObjetivo | null {
  if (!esObjeto(parametros)) {
    return null;
  }

  const { rondas, segundosPorRonda, lados } = parametros;

  if (
    !esEntero(rondas, 1, 60) ||
    // `null` es «sin tiempo»: esta pantalla siempre juega contra reloj, asi que no lo entiende.
    !esEntero(segundosPorRonda, 3, 120) ||
    !Array.isArray(lados) ||
    lados.length < 1 ||
    lados.length > 6
  ) {
    return null;
  }

  const copia: number[] = [];

  for (const lado of lados as unknown[]) {
    const anterior = copia.at(-1);

    if (!esEntero(lado, 2, 8) || (anterior !== undefined && lado <= anterior)) {
      return null;
    }

    copia.push(lado);
  }

  // Con menos rondas que lados, algun tamano no se jugaria nunca.
  if (rondas < copia.length) {
    return null;
  }

  return { rondas, segundosPorRonda, lados: copia };
}

// ---------------------------------------------------------------------------
// Cuestionario corto (motor `cuestionario_corto`)
// ---------------------------------------------------------------------------

export interface PreguntaDeLaSesion {
  readonly clave: string;
  readonly texto: string;
}

export interface OpcionDeLaSesion {
  readonly valor: number;
  readonly texto: string;
}

export interface ParametrosDeCuestionario {
  /** La frase que enmarca el cuestionario. */
  readonly indicacion: string;
  readonly preguntas: readonly PreguntaDeLaSesion[];
  readonly opciones: readonly OpcionDeLaSesion[];
}

export function leerCuestionario(parametros: unknown): ParametrosDeCuestionario | null {
  if (
    !esObjeto(parametros) ||
    !esTexto(parametros.indicacion) ||
    !Array.isArray(parametros.preguntas) ||
    !Array.isArray(parametros.opciones)
  ) {
    return null;
  }

  const preguntas: PreguntaDeLaSesion[] = [];

  for (const pregunta of parametros.preguntas as unknown[]) {
    if (
      !esObjeto(pregunta) ||
      !esTexto(pregunta.clave) ||
      !esTexto(pregunta.texto) ||
      preguntas.some((otra) => otra.clave === pregunta.clave)
    ) {
      return null;
    }

    preguntas.push({ clave: pregunta.clave, texto: pregunta.texto });
  }

  const opciones: OpcionDeLaSesion[] = [];

  for (const opcion of parametros.opciones as unknown[]) {
    if (
      !esObjeto(opcion) ||
      !esEntero(opcion.valor, 0, 1000) ||
      !esTexto(opcion.texto) ||
      opciones.some((otra) => otra.valor === opcion.valor)
    ) {
      return null;
    }

    opciones.push({ valor: opcion.valor, texto: opcion.texto });
  }

  // Un cuestionario sin preguntas, o con una sola opcion, no tiene nada que contestar.
  if (preguntas.length < 1 || opciones.length < 2) {
    return null;
  }

  return { indicacion: parametros.indicacion, preguntas, opciones };
}

/**
 * El maximo del puntaje de un cuestionario: sus preguntas por el valor mas alto de sus opciones.
 *
 * No se guarda en ningun sitio, para que no pueda desincronizarse del maximo de la actividad en el
 * catalogo (el servidor rechaza con 400 un puntaje que lo pase).
 */
export function maximoDelCuestionario(
  cuestionario: Pick<ParametrosDeCuestionario, 'preguntas' | 'opciones'>,
): number {
  return cuestionario.preguntas.length * Math.max(...cuestionario.opciones.map((o) => o.valor));
}

// ---------------------------------------------------------------------------
// Escritura breve de un solo campo (motor `escritura_breve`)
// ---------------------------------------------------------------------------

export interface ParametrosDeEscrituraDeUnCampo {
  /** Lo que pregunta la pantalla. */
  readonly invitacion: string;
  /** Ideas para empezar, a un toque. Pueden no haber. */
  readonly ideas: readonly string[];
  readonly largoMaximo: number;
  /** Si se ofrece «hoy no me sale ninguno». */
  readonly permiteNingunaHoy: boolean;
}

export function leerEscrituraDeUnCampo(parametros: unknown): ParametrosDeEscrituraDeUnCampo | null {
  if (
    !esObjeto(parametros) ||
    !esTexto(parametros.invitacion) ||
    // Varios campos llegan con su propio motor; esta pantalla tiene uno.
    parametros.campos !== 1 ||
    !esEntero(parametros.largoMaximo, 50, 1000)
  ) {
    return null;
  }

  // Esta pantalla pide una respuesta: «basta con ninguna» o «hacen falta dos» no es lo suyo.
  if (parametros.minimo !== undefined && parametros.minimo !== 1) {
    return null;
  }

  const ideasRecibidas = parametros.ideas ?? [];

  if (!Array.isArray(ideasRecibidas) || !(ideasRecibidas as unknown[]).every(esTexto)) {
    return null;
  }

  const permiteNingunaHoy = parametros.permiteNingunaHoy ?? false;

  if (typeof permiteNingunaHoy !== 'boolean') {
    return null;
  }

  return {
    invitacion: parametros.invitacion,
    ideas: [...(ideasRecibidas as string[])],
    largoMaximo: parametros.largoMaximo,
    permiteNingunaHoy,
  };
}
