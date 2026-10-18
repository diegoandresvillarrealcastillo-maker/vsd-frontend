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

export type Objeto = Readonly<Record<string, unknown>>;

export function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function esEntero(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

export function esTexto(valor: unknown): valor is string {
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
// Secuencia de casillas, «Recuerda los colores» (motor `secuencia`, con destello)
// ---------------------------------------------------------------------------

export interface CasillaDeLaSesion {
  readonly clave: string;
  /** Lo que se lee de ella, y lo que se anuncia al iluminarse. Nunca falta: el color no basta (R10). */
  readonly nombre: string;
  readonly forma?: string;
  readonly color?: string;
}

export interface ParametrosDeSecuenciaDeCasillas {
  readonly casillas: readonly CasillaDeLaSesion[];
  readonly largoInicial: number;
  readonly rondas: number;
  /** Cuanto pasa entre el comienzo de una casilla y el de la siguiente. */
  readonly msPorElemento: number;
  /** La espera antes de que se ilumine la primera. */
  readonly msDeMargen: number;
  /** Cuanto tiempo se queda iluminada cada casilla. */
  readonly msDestello: number;
}

const igualSinMayusculas = (texto: string): string => texto.trim().toLowerCase();

function leerLasCasillas(valor: unknown): CasillaDeLaSesion[] | null {
  if (!Array.isArray(valor) || valor.length < 2 || valor.length > 12) {
    return null;
  }

  const casillas: CasillaDeLaSesion[] = [];

  for (const casilla of valor as unknown[]) {
    if (!esObjeto(casilla) || !esTexto(casilla.clave) || !esTexto(casilla.nombre)) {
      return null;
    }

    const { clave, nombre, forma, color } = casilla;

    if (
      (forma !== undefined && !esTexto(forma)) ||
      (color !== undefined && !esTexto(color)) ||
      // El color nunca es la unica pista (R10): sin forma, no hay color.
      (color !== undefined && forma === undefined) ||
      casillas.some(
        (otra) =>
          otra.clave === clave || igualSinMayusculas(otra.nombre) === igualSinMayusculas(nombre),
      )
    ) {
      return null;
    }

    casillas.push({
      clave,
      nombre,
      ...(forma === undefined ? {} : { forma }),
      ...(color === undefined ? {} : { color }),
    });
  }

  return casillas;
}

export function leerSecuenciaDeCasillas(
  parametros: unknown,
): ParametrosDeSecuenciaDeCasillas | null {
  if (!esObjeto(parametros)) {
    return null;
  }

  const casillas = leerLasCasillas(parametros.casillas);
  const { largoInicial, rondas, msPorElemento, msDeMargen, msDestello } = parametros;

  if (
    casillas === null ||
    !esEntero(largoInicial, 1, 10) ||
    !esEntero(rondas, 1, 50) ||
    !esEntero(msPorElemento, 200, 5000) ||
    !esEntero(msDeMargen, 0, 10_000) ||
    // Sin destello es la secuencia de numeros; y menos de 600 ms no se alcanza a ver (R10).
    !esEntero(msDestello, 600, 5000) ||
    // El destello cabe en el turno de cada casilla: si lo pasara, la siguiente no tendria su momento.
    msDestello > msPorElemento
  ) {
    return null;
  }

  return { casillas, largoInicial, rondas, msPorElemento, msDeMargen, msDestello };
}

// ---------------------------------------------------------------------------
// Guia paso a paso, «Respiracion guiada» (motor `guia_paso_a_paso`)
// ---------------------------------------------------------------------------

export interface PatronDeRespiracion {
  readonly inhalaSegundos: number;
  readonly exhalaSegundos: number;
  /** Una pausa entre inhalar y exhalar. Cero si no hay. Nunca mas de 4 s: ninguna retencion larga. */
  readonly pausaSegundos: number;
}

export interface ParametrosDeGuiaDeRespiracion {
  /** Lo que se dice antes de empezar («si te mareas...»): a la vista, no en letra pequena. */
  readonly advertenciaInicial: string;
  readonly patron: PatronDeRespiracion;
  readonly duracionSegundos: number;
  /** El fondo y el color de la sesion; el estilo de cada una llega con su contenido. */
  readonly ambientacion?: string;
  /** Frases breves de acompanamiento, una por ciclo. Pueden no haber. */
  readonly frases: readonly string[];
  /** Una vibracion suave al cambiar de etapa, si el dispositivo puede. */
  readonly haptico: boolean;
}

function leerElPatron(valor: unknown): PatronDeRespiracion | null {
  if (!esObjeto(valor)) {
    return null;
  }

  const { inhalaSegundos, exhalaSegundos, pausaSegundos } = valor;

  if (
    !esEntero(inhalaSegundos, 3, 8) ||
    !esEntero(exhalaSegundos, 3, 10) ||
    // La baranda de la ficha BIE-01: ninguna retencion de mas de 4 s.
    !esEntero(pausaSegundos, 0, 4)
  ) {
    return null;
  }

  return { inhalaSegundos, exhalaSegundos, pausaSegundos };
}

export function leerGuiaDeRespiracion(parametros: unknown): ParametrosDeGuiaDeRespiracion | null {
  if (!esObjeto(parametros)) {
    return null;
  }

  const patron = leerElPatron(parametros.patron);
  const { advertenciaInicial, duracionSegundos } = parametros;
  const ambientacion = parametros.ambientacion;
  const frases = parametros.frases ?? [];
  const haptico = parametros.haptico ?? false;

  if (
    patron === null ||
    !esTexto(advertenciaInicial) ||
    !esEntero(duracionSegundos, 60, 600) ||
    (ambientacion !== undefined && !esTexto(ambientacion)) ||
    !Array.isArray(frases) ||
    !(frases as unknown[]).every(esTexto) ||
    typeof haptico !== 'boolean'
  ) {
    return null;
  }

  return {
    advertenciaInicial,
    patron,
    duracionSegundos,
    ...(ambientacion === undefined ? {} : { ambientacion }),
    frases: [...(frases as string[])],
    haptico,
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
// Escritura breve (motor `escritura_breve`)
// ---------------------------------------------------------------------------

export interface ParametrosDeEscrituraBreve {
  /** Lo que pregunta la pantalla. */
  readonly invitacion: string;
  /** Cuantos campos de texto hay, de 1 a 5. */
  readonly campos: number;
  /** Cuantos hay que llenar para poder terminar: con «una basta», 1. */
  readonly minimo: number;
  /** Ideas para empezar, a un toque. Pueden no haber. */
  readonly ideas: readonly string[];
  /** El largo de **cada** campo. */
  readonly largoMaximo: number;
  /** Si se ofrece «hoy no me sale ninguno». */
  readonly permiteNingunaHoy: boolean;
}

/**
 * Esta pantalla pide al menos una respuesta: «basta con ninguna» no es lo suyo (para eso esta el
 * boton de «hoy no me sale ninguno»), y pedir mas de las que hay campos no se podria cumplir.
 */
export function leerEscrituraBreve(parametros: unknown): ParametrosDeEscrituraBreve | null {
  if (
    !esObjeto(parametros) ||
    !esTexto(parametros.invitacion) ||
    !esEntero(parametros.campos, 1, 5) ||
    !esEntero(parametros.largoMaximo, 50, 1000)
  ) {
    return null;
  }

  const { invitacion, campos, largoMaximo } = parametros;
  const minimo = parametros.minimo === undefined ? 1 : parametros.minimo;
  const ideasRecibidas = parametros.ideas ?? [];
  const permiteNingunaHoy = parametros.permiteNingunaHoy ?? false;

  if (
    !esEntero(minimo, 1, campos) ||
    !Array.isArray(ideasRecibidas) ||
    !(ideasRecibidas as unknown[]).every(esTexto) ||
    typeof permiteNingunaHoy !== 'boolean'
  ) {
    return null;
  }

  return {
    invitacion,
    campos,
    minimo,
    ideas: [...(ideasRecibidas as string[])],
    largoMaximo,
    permiteNingunaHoy,
  };
}

// ---------------------------------------------------------------------------
// Escritura breve de un solo campo (`UnMomentoBueno`)
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

/** Lo mismo que `leerEscrituraBreve`, pero con un solo campo: es lo unico que esa pantalla tiene. */
export function leerEscrituraDeUnCampo(parametros: unknown): ParametrosDeEscrituraDeUnCampo | null {
  const escritura = leerEscrituraBreve(parametros);

  if (escritura?.campos !== 1) {
    return null;
  }

  const { invitacion, ideas, largoMaximo, permiteNingunaHoy } = escritura;

  return { invitacion, ideas, largoMaximo, permiteNingunaHoy };
}
