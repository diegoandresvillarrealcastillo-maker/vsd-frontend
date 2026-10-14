import { llamarALaApi } from './clienteHttp.ts';
import type { Modulo } from './cuenta.ts';

/**
 * El historial de un modulo, por HTTP (SCRUM-184).
 *
 * Es la copia de este lado del contrato que publica el backend. El servidor arma las paginas:
 * aqui no se cuenta, no se ordena ni se agrupa nada que cambie lo que dice.
 *
 * **Solo que hizo y cuando**: la actividad, su dia y la hora. Nunca el puntaje, el nivel ni lo
 * que escribio.
 */

export interface HechoDelHistorial {
  readonly id: string;
  readonly actividad: { readonly id: string; readonly nombre: string };
  /** El dia en la zona que la persona tenia al hacerlo: AAAA-MM-DD. */
  readonly dia: string;
  /** La hora a la que termino la actividad (ISO 8601). */
  readonly hechaEn: string;
}

export interface PaginaDelHistorial {
  /** Del mas reciente al mas antiguo. */
  readonly hechos: readonly HechoDelHistorial[];
  /** El texto que se devuelve para pedir la siguiente pagina, o `null` si no hay mas. */
  readonly siguientePagina: string | null;
}

export interface OpcionesDelHistorial {
  /** Cuantos hechos por pagina (1 a 50). Sin decir, 20. */
  readonly limite?: number;
  /** El `siguientePagina` de la anterior. Es opaco: no se arma ni se interpreta. */
  readonly pagina?: string;
  readonly senal?: AbortSignal;
}

/**
 * Una pagina del historial de un modulo, del mas reciente al mas antiguo.
 *
 * Una respuesta que no tiene la forma esperada no rompe la pantalla: se lee como una pagina
 * vacia y sin mas paginas.
 */
export async function consultarElHistorial(
  modulo: Modulo,
  { limite, pagina, senal }: OpcionesDelHistorial = {},
): Promise<PaginaDelHistorial> {
  const parametros = new URLSearchParams();

  if (limite !== undefined) {
    parametros.set('limite', String(limite));
  }

  if (pagina !== undefined) {
    parametros.set('pagina', pagina);
  }

  const consulta = parametros.toString();
  const ruta = `/api/progreso/${modulo}/historial${consulta === '' ? '' : `?${consulta}`}`;
  const respuesta = await llamarALaApi<Partial<PaginaDelHistorial> | null>(
    ruta,
    senal ? { senal } : {},
  );

  return {
    hechos: Array.isArray(respuesta?.hechos) ? respuesta.hechos : [],
    siguientePagina:
      typeof respuesta?.siguientePagina === 'string' ? respuesta.siguientePagina : null,
  };
}
