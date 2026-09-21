import { entorno } from '../entorno.ts';
import { supabase } from '../supabase/cliente.ts';

/**
 * Las llamadas a la API de vsd-backend.
 *
 * Existe para que nadie tenga que acordarse de poner la cabecera
 * `Authorization`. Acordarse funciona hasta que un dia no, y el sintoma de esa
 * vez es un 401 en una pantalla suelta que nadie sabe explicar.
 *
 * Que el token vaya en cada peticion no es un formalismo: desde SCRUM-64 es lo
 * unico que le dice a la API quien esta pidiendo, y desde SCRUM-68 es lo que
 * decide que filas devuelve la base.
 */

/** Lo que devuelve la API cuando algo sale mal. */
export class ErrorDeLaApi extends Error {
  readonly estado: number;

  /**
   * Identificador con el que se puede buscar esta peticion en los registros.
   * No contiene nada de la persona, asi que se le puede ensenar, y ella puede
   * pasarlo al pedir ayuda sin compartir nada suyo.
   */
  readonly identificador: string | undefined;

  constructor(estado: number, mensaje: string, identificador?: string) {
    super(mensaje);
    this.name = 'ErrorDeLaApi';
    this.estado = estado;
    this.identificador = identificador;
  }
}

async function tokenActual(): Promise<string | null> {
  try {
    // getSession renueva el token si le queda poco, asi que esta es tambien la
    // forma de no mandar uno caducado a media sesion larga.
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

interface Opciones {
  readonly metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly cuerpo?: unknown;
  readonly senal?: AbortSignal;
}

export async function llamarALaApi<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const token = await tokenActual();

  const cabeceras = new Headers({ Accept: 'application/json' });

  if (opciones.cuerpo !== undefined) {
    cabeceras.set('Content-Type', 'application/json');
  }

  if (token) {
    cabeceras.set('Authorization', `Bearer ${token}`);
  }

  const respuesta = await fetch(`${entorno.urlDeLaApi}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: cabeceras,
    body: opciones.cuerpo === undefined ? null : JSON.stringify(opciones.cuerpo),
    ...(opciones.senal ? { signal: opciones.senal } : {}),
  });

  if (respuesta.status === 401) {
    // El token no vale: caducado, revocado, o la sesion se cerro en otra
    // pestana. Se limpia aqui para que la aplicacion no siga pareciendo que
    // hay alguien dentro mientras ninguna peticion funciona.
    await supabase().auth.signOut();

    throw new ErrorDeLaApi(401, 'Tu sesion caduco. Vuelve a entrar.');
  }

  if (!respuesta.ok) {
    const identificador = respuesta.headers.get('x-request-id') ?? undefined;

    throw new ErrorDeLaApi(
      respuesta.status,
      'No se pudo completar la peticion.',
      identificador ?? undefined,
    );
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}
