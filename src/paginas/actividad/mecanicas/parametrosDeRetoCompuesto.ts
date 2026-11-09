import type { SesionDeLaActividad } from '../../../infraestructura/api/progreso.ts';

export interface FaseDeRetoCompuesto {
  readonly codigo: string;
  readonly sesion: SesionDeLaActividad;
  readonly maximo: number;
}

export interface ParametrosDeRetoCompuesto {
  readonly fases: readonly FaseDeRetoCompuesto[];
  readonly puntosMaximos: number;
}

const CODIGOS = new Set(
  Array.from({ length: 11 }, (_, indice) => `COG-${String(indice + 1).padStart(2, '0')}`),
);

/** Cada reto encadena tres mecánicas diferentes, con sus instrucciones y reglas originales. */
export function leerRetoCompuesto(valor: unknown): ParametrosDeRetoCompuesto | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return null;
  }

  const parametros = valor as Record<string, unknown>;
  const datos = parametros.fases;

  if (
    parametros.modo !== 'reto_compuesto_cognitivo' ||
    !Array.isArray(datos) ||
    (datos.length !== 3 && datos.length !== 4) ||
    !Number.isInteger(parametros.puntosMaximos) ||
    (parametros.puntosMaximos as number) < 3 ||
    (parametros.puntosMaximos as number) > 45
  ) {
    return null;
  }

  const fases: FaseDeRetoCompuesto[] = [];

  for (const dato of datos) {
    if (typeof dato !== 'object' || dato === null || Array.isArray(dato)) {
      return null;
    }

    const fase = dato as Record<string, unknown>;
    const sesion = fase.parametros;

    if (
      typeof fase.codigo !== 'string' ||
      !CODIGOS.has(fase.codigo) ||
      typeof fase.idSesion !== 'string' ||
      fase.idSesion.trim() === '' ||
      typeof fase.titulo !== 'string' ||
      fase.titulo.trim() === '' ||
      !Number.isInteger(fase.nivel) ||
      (fase.nivel as number) < 1 ||
      (fase.nivel as number) > 3 ||
      !Number.isInteger(fase.maximo) ||
      (fase.maximo as number) < 1 ||
      (fase.maximo as number) > 15 ||
      typeof sesion !== 'object' ||
      sesion === null ||
      Array.isArray(sesion)
    ) {
      return null;
    }

    fases.push({
      codigo: fase.codigo,
      maximo: fase.maximo as number,
      sesion: {
        id: fase.idSesion,
        titulo: fase.titulo,
        nivel: fase.nivel as number,
        parametros: sesion as Record<string, unknown>,
      },
    });
  }

  if (
    new Set(fases.map((fase) => fase.codigo)).size !== fases.length ||
    fases.reduce((total, fase) => total + fase.maximo, 0) !== parametros.puntosMaximos
  ) {
    return null;
  }

  return {
    fases,
    puntosMaximos: parametros.puntosMaximos,
  };
}
