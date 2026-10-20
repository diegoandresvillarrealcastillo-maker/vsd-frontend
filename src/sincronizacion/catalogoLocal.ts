import type {
  ActividadConSuCategoria,
  CategoriaDelCatalogo,
} from '../infraestructura/api/catalogo.ts';
import { leerSiCambio } from '../infraestructura/api/clienteHttp.ts';
import {
  leerConCopia,
  leerSoloLaCopia,
  type LecturaConCopia,
  type OpcionesDeLaLectura,
} from './lecturas.ts';

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
  opciones?: OpcionesDeLaLectura,
): Promise<LecturaConCopia<readonly CategoriaDelCatalogo[]>> {
  return leerConCopia<readonly CategoriaDelCatalogo[]>(
    CLAVE_DEL_CATALOGO,
    (etag) => leerSiCambio('/api/catalogo', { etag, ...(senal ? { senal } : {}) }),
    senal,
    opciones,
  );
}

function buscarEn(
  catalogo: readonly CategoriaDelCatalogo[],
  id: string,
): ActividadConSuCategoria | null {
  for (const categoria of catalogo) {
    const actividad = categoria.actividades.find((una) => una.id === id);

    if (actividad !== undefined) {
      return { actividad, categoria };
    }
  }

  return null;
}

/**
 * Busca una actividad por su identificador, en el catalogo de la API o, sin conexion,
 * en la copia. `null` solo si el catalogo **confirmado por la API** no la tiene.
 *
 * Una copia que no la tiene no prueba que no exista (SCRUM-232): puede ser de antes de que se
 * publicara. Pasa justo cuando sale algo nuevo, que el panel ofrece porque lo lee en vivo y esta
 * pantalla lo busca en una copia que no lo conoce. Por eso, si el catalogo vino de la copia y
 * la actividad no esta, se vuelve a preguntar de verdad: se espera a la API, y si no se puede
 * llegar a ella sale el fallo de conexion, nunca un "no existe" que no se comprobo.
 */
export async function buscarActividadConCopia(
  id: string,
  senal?: AbortSignal,
): Promise<ActividadConSuCategoria | null> {
  const primera = await traerElCatalogoConCopia(senal);
  const encontrada = buscarEn(primera.valor, id);

  if (encontrada !== null || !primera.deLaCopia) {
    return encontrada;
  }

  const confirmada = await traerElCatalogoConCopia(senal, { verificar: true });

  return buscarEn(confirmada.valor, id);
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
