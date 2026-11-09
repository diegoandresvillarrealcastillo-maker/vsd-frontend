export interface OpcionDeDeduccionLogica {
  readonly clave: string;
  readonly texto: string;
  readonly correcta: boolean;
}

export interface ParametrosDeRazonamientoLogico {
  readonly premisas: readonly string[];
  readonly opciones: readonly OpcionDeDeduccionLogica[];
  readonly explicacion: string;
  readonly puntosMaximos: 1;
}

/** Lee la sesion con cuidado: nunca presenta una respuesta si las reglas no son coherentes. */
export function leerRazonamientoLogico(valor: unknown): ParametrosDeRazonamientoLogico | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return null;
  }

  const parametros = valor as Record<string, unknown>;

  if (
    parametros.modo !== 'deduccion_logica' ||
    !Array.isArray(parametros.premisas) ||
    parametros.premisas.length < 2 ||
    parametros.premisas.length > 4 ||
    !Array.isArray(parametros.opciones) ||
    parametros.opciones.length < 3 ||
    parametros.opciones.length > 4 ||
    typeof parametros.explicacion !== 'string' ||
    parametros.puntosMaximos !== 1
  ) {
    return null;
  }

  const premisas = parametros.premisas;
  const opciones = parametros.opciones;

  if (
    !premisas.every((item) => typeof item === 'string' && item.trim() !== '') ||
    new Set(premisas.map((item) => (item as string).trim().toLocaleLowerCase('es'))).size !==
      premisas.length ||
    !opciones.every(
      (opcion) =>
        typeof opcion === 'object' &&
        opcion !== null &&
        typeof (opcion as Record<string, unknown>).clave === 'string' &&
        typeof (opcion as Record<string, unknown>).texto === 'string' &&
        typeof (opcion as Record<string, unknown>).correcta === 'boolean',
    )
  ) {
    return null;
  }

  const opcionesValidas = opciones as OpcionDeDeduccionLogica[];

  if (
    new Set(opcionesValidas.map((opcion) => opcion.clave)).size !== opcionesValidas.length ||
    opcionesValidas.filter((opcion) => opcion.correcta).length !== 1
  ) {
    return null;
  }

  return {
    premisas: premisas as string[],
    opciones: opcionesValidas,
    explicacion: parametros.explicacion,
    puntosMaximos: 1,
  };
}
