import { esEntero, esObjeto, esTexto } from './parametrosDeLaSesion.ts';

export interface CeldaDeDeduccionEspacial {
  readonly clave: string;
  readonly etiqueta: string;
  readonly fila: number;
  readonly columna: number;
}

export interface ParametrosDeDeduccionEspacial {
  readonly filas: number;
  readonly columnas: number;
  readonly celdas: readonly CeldaDeDeduccionEspacial[];
  readonly pistas: readonly string[];
  readonly solucion: string;
  readonly explicacion: string;
  readonly puntosMaximos: 1;
}

export function leerDeduccionEspacial(valor: unknown): ParametrosDeDeduccionEspacial | null {
  if (
    !esObjeto(valor) ||
    valor.modo !== 'deduccion_espacial' ||
    !esEntero(valor.filas, 2, 4) ||
    !esEntero(valor.columnas, 2, 4) ||
    !Array.isArray(valor.celdas) ||
    valor.celdas.length !== valor.filas * valor.columnas ||
    !Array.isArray(valor.pistas) ||
    valor.pistas.length < 2 ||
    valor.pistas.length > 5 ||
    !esTexto(valor.solucion) ||
    !esTexto(valor.explicacion) ||
    valor.puntosMaximos !== 1
  ) {
    return null;
  }

  const celdas: CeldaDeDeduccionEspacial[] = [];

  for (const una of valor.celdas) {
    if (
      !esObjeto(una) ||
      !esTexto(una.clave) ||
      !esTexto(una.etiqueta) ||
      !esEntero(una.fila, 1, valor.filas) ||
      !esEntero(una.columna, 1, valor.columnas)
    ) {
      return null;
    }

    celdas.push({
      clave: una.clave,
      etiqueta: una.etiqueta,
      fila: una.fila,
      columna: una.columna,
    });
  }

  const claves = new Set(celdas.map((celda) => celda.clave));
  const posiciones = new Set(celdas.map((celda) => `${celda.fila}:${celda.columna}`));
  const pistas = valor.pistas as string[];

  if (
    claves.size !== celdas.length ||
    posiciones.size !== celdas.length ||
    !claves.has(valor.solucion) ||
    !pistas.every((pista) => esTexto(pista)) ||
    new Set(pistas.map((pista) => pista.trim().toLocaleLowerCase())).size !== pistas.length
  ) {
    return null;
  }

  return {
    filas: valor.filas,
    columnas: valor.columnas,
    celdas,
    pistas: [...pistas],
    solucion: valor.solucion,
    explicacion: valor.explicacion,
    puntosMaximos: 1,
  };
}
