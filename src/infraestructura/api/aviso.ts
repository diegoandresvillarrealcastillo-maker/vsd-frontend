import { llamarALaApi } from './clienteHttp.ts';

/** Lo que devuelve `GET /api/aviso`. */
interface AvisoVigente {
  readonly version: string;
  /** Una API anterior a la auditoria 360 (T-01) no lo manda. */
  readonly versionTerminos?: string;
}

/** Las versiones de los dos textos que hay que aceptar para registrarse. */
export interface TextosVigentes {
  readonly aviso: string;
  readonly terminos: string;
}

/**
 * Las versiones vigentes del aviso de privacidad y de los terminos.
 *
 * Misma razon que la del aviso solo: la unica fuente es la API, y el alta solo
 * acepta las vigentes. Si la API no informa la de los terminos no se puede
 * registrar a nadie —aceptar unos terminos sin version es aceptar algo que
 * nadie puede demostrar— y se falla en lugar de suponer una.
 */
export async function consultarLosTextosVigentes(senal?: AbortSignal): Promise<TextosVigentes> {
  const vigente = await llamarALaApi<AvisoVigente>('/api/aviso', senal ? { senal } : {});

  if (vigente.versionTerminos === undefined) {
    throw new Error('La API no informa la versión vigente de los términos.');
  }

  return { aviso: vigente.version, terminos: vigente.versionTerminos };
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
