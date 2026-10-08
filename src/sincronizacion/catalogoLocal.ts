import type {
  ActividadConSuCategoria,
  CategoriaDelCatalogo,
} from '../infraestructura/api/catalogo.ts';
import { leerSiCambio } from '../infraestructura/api/clienteHttp.ts';
import { leerConCopia, leerSoloLaCopia, type LecturaConCopia } from './lecturas.ts';

/**
 * El catalogo de actividades, con copia en este dispositivo (SCRUM-138).
 *
 * Con la copia, una actividad **abre sin conexion**: la pantalla sabe cual es, como se
 * llama y que mecanica monta sin preguntarle a nadie. El catalogo es igual para todo el
 * mundo y no contiene nada de nadie, asi que es lo primero que se guarda.
 *
 * La copia se renueva cada vez que se puede, mandando su `ETag`: si no cambio, el
 * servidor no vuelve a mandarla.
 */

export const CLAVE_DEL_CATALOGO = 'catalogo';

export function traerElCatalogoConCopia(
  senal?: AbortSignal,
): Promise<LecturaConCopia<readonly CategoriaDelCatalogo[]>> {
  return leerConCopia<readonly CategoriaDelCatalogo[]>(
    CLAVE_DEL_CATALOGO,
    (etag) => leerSiCambio('/api/catalogo', { etag, ...(senal ? { senal } : {}) }),
    senal,
  );
}

/**
 * Busca una actividad por su identificador, en el catalogo de la API o, sin conexion,
 * en la copia. `null` si no existe.
 */
export async function buscarActividadConCopia(
  id: string,
  senal?: AbortSignal,
): Promise<ActividadConSuCategoria | null> {
  const { valor: catalogo } = await traerElCatalogoConCopia(senal);

  for (const categoria of catalogo) {
    const actividad = categoria.actividades.find((una) => una.id === id);

    if (actividad !== undefined) {
      return { actividad, categoria };
    }
  }

  return null;
}

/**
 * El nombre de una actividad, **solo de la copia**: sirve para decir "tu resultado de
 * «Como dormiste anoche»" sin tener que preguntar. `null` si no se sabe.
 */
export async function nombreDeLaActividad(id: string): Promise<string | null> {
  const catalogo = await leerSoloLaCopia<readonly CategoriaDelCatalogo[]>(CLAVE_DEL_CATALOGO);

  try {
    for (const categoria of catalogo ?? []) {
      const actividad = categoria.actividades.find((una) => una.id === id);

      if (actividad !== undefined) {
        return actividad.nombre;
      }
    }
  } catch {
    // Una copia con otra forma (la guardo otra version): no hay nombre que dar.
  }

  return null;
}
