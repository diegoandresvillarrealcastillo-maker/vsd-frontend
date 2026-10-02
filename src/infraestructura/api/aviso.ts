import { llamarALaApi } from './clienteHttp.ts';

/** Lo que devuelve `GET /api/aviso`. */
interface AvisoVigente {
  readonly version: string;
}

/**
 * La version vigente del aviso de tratamiento de datos.
 *
 * Se pide a la API en lugar de llevar una copia aqui. Antes el frontend tenia
 * su propia constante y el backend aceptaba cualquier valor, asi que segun por
 * donde entrara alguien quedaba registrado que habia aceptado cosas distintas.
 * Ahora la version vive en un unico sitio, el backend, y el alta solo acepta la
 * vigente (SCRUM-85).
 *
 * La ruta es publica: se necesita antes de que exista la cuenta y no contiene
 * nada de nadie.
 */
export async function consultarLaVersionDelAviso(senal?: AbortSignal): Promise<string> {
  const aviso = await llamarALaApi<AvisoVigente>('/api/aviso', senal ? { senal } : {});

  return aviso.version;
}
