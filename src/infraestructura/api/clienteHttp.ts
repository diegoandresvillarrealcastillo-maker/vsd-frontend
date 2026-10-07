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
   * Codigo estable de la API, por ejemplo `CONSENTIMIENTO_NO_REGISTRADO`.
   *
   * **Es por aqui por donde conviene decidir**, no por el texto del mensaje ni
   * siempre por el estado. El texto puede reescribirse sin avisar; el codigo es
   * parte del contrato. Y el estado a veces no alcanza: un 400 puede ser una
   * validacion de formato o puede ser que falte el consentimiento, y para quien
   * esta delante no son lo mismo.
   *
   * Queda indefinido cuando el fallo no viene de nuestra API con su forma
   * habitual: un proxy por el medio, o una respuesta sin cuerpo.
   */
  readonly codigo: string | undefined;

  /**
   * Identificador con el que se puede buscar esta peticion en los registros.
   * No contiene nada de la persona, asi que se le puede ensenar, y ella puede
   * pasarlo al pedir ayuda sin compartir nada suyo.
   */
  readonly identificador: string | undefined;

  constructor(estado: number, mensaje: string, identificador?: string, codigo?: string) {
    super(mensaje);
    this.name = 'ErrorDeLaApi';
    this.estado = estado;
    this.identificador = identificador;
    this.codigo = codigo;
  }
}

/** Lo que se pudo entender del cuerpo de una respuesta fallida. */
interface ExplicacionDelFallo {
  readonly codigo?: string;
  readonly mensaje?: string;
}

/** Cuando la API no explica nada, o no es la API quien responde. */
const FALLO_SIN_EXPLICAR = 'No se pudo completar la petición.';

/**
 * Saca el `codigo` y el `mensaje` del cuerpo de una respuesta fallida.
 *
 * **No lanza nunca, pase lo que pase.** Es la parte que mas importa de esta
 * funcion: ya hay un fallo en curso, y un cliente que se rompe al leerlo
 * convierte un problema en dos, con el segundo tapando al primero.
 *
 * El cuerpo puede no ser lo que se espera por motivos normales: una respuesta
 * sin contenido, o un proxy o un balanceador que devuelven su propia pagina de
 * error en HTML sin pasar por nuestra API. En esos casos no hay explicacion y
 * eso es una respuesta valida, no un error.
 */
async function explicacionDe(respuesta: Response): Promise<ExplicacionDelFallo> {
  let cuerpo: unknown;

  try {
    cuerpo = await respuesta.json();
  } catch {
    return {};
  }

  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return {};
  }

  const { codigo, mensaje } = cuerpo as Record<string, unknown>;

  // Se copian solo si son texto con contenido. Una cadena vacia es peor que la
  // ausencia: pasaria las comprobaciones de quien llame y no diria nada.
  return {
    ...(typeof codigo === 'string' && codigo.trim() !== '' ? { codigo } : {}),
    ...(typeof mensaje === 'string' && mensaje.trim() !== '' ? { mensaje } : {}),
  };
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
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Lo que se manda, como JSON. */
  readonly cuerpo?: unknown;
  /**
   * O bien los bytes de un archivo, tal cual y con su propio tipo (SCRUM-120).
   * No se combina con `cuerpo`: son dos formas distintas de llevar lo mismo.
   */
  readonly bytes?: Blob;
  readonly senal?: AbortSignal;
}

/**
 * Hace la llamada y deja pasar solo las que salieron bien.
 *
 * Es lo comun a pedir JSON y a pedir bytes: la cabecera con la sesion, que una
 * sesion caducada se limpie, y que un fallo se convierta en un `ErrorDeLaApi`
 * con su codigo y su identificador. Lo que cambia es como se lee el cuerpo de
 * una respuesta buena, y eso lo decide quien llama.
 */
async function pedir(ruta: string, opciones: Opciones, acepta: string): Promise<Response> {
  const token = await tokenActual();

  const cabeceras = new Headers({ Accept: acepta });

  if (opciones.cuerpo !== undefined) {
    cabeceras.set('Content-Type', 'application/json');
  } else if (opciones.bytes !== undefined) {
    cabeceras.set('Content-Type', opciones.bytes.type);
  }

  if (token) {
    cabeceras.set('Authorization', `Bearer ${token}`);
  }

  const respuesta = await fetch(`${entorno.urlDeLaApi}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: cabeceras,
    body:
      opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : (opciones.bytes ?? null),
    ...(opciones.senal ? { signal: opciones.senal } : {}),
  });

  const identificador = respuesta.headers.get('x-request-id') ?? undefined;

  if (respuesta.status === 401) {
    // El token no vale: caducado, revocado, o la sesion se cerro en otra
    // pestana. Se limpia aqui para que la aplicacion no siga pareciendo que
    // hay alguien dentro mientras ninguna peticion funciona.
    await supabase().auth.signOut();

    // El mensaje lo pone el cliente y no la API, a proposito. La API distingue
    // por dentro entre "no llego token" y "el token no vale", pero responde lo
    // mismo a las dos para no ayudar a quien este probando combinaciones. Aqui
    // se dice lo unico que a la persona le sirve: que vuelva a entrar.
    //
    // El codigo si se conserva, porque sirve para diagnosticar y no se ensena.
    const { codigo } = await explicacionDe(respuesta);

    throw new ErrorDeLaApi(401, 'Tu sesión caducó. Vuelve a entrar.', identificador, codigo);
  }

  if (!respuesta.ok) {
    const { codigo, mensaje } = await explicacionDe(respuesta);

    // Se prefiere el mensaje de la API cuando lo hay: esta escrito para que lo
    // lea una persona y sabe de que error habla. Quien pinte una pantalla puede
    // ignorarlo y redactar el suyo mirando `codigo`, que suele quedar mejor
    // porque conoce el contexto.
    throw new ErrorDeLaApi(respuesta.status, mensaje ?? FALLO_SIN_EXPLICAR, identificador, codigo);
  }

  return respuesta;
}

export async function llamarALaApi<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const respuesta = await pedir(ruta, opciones, 'application/json');

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}

/**
 * Pide un archivo a la API y lo entrega como `Blob`, con el tipo que trae
 * (SCRUM-120). Es para lo que no es JSON: la foto de perfil.
 *
 * Va por aqui y no por una direccion que el navegador abra solo (un `<img
 * src>`) porque cada peticion tiene que llevar la sesion, y una imagen no puede
 * ponerse una cabecera.
 */
export async function pedirBytesALaApi(
  ruta: string,
  opciones: Opciones & {
    /** Lo que se acepta de vuelta. Por defecto, una foto: `image/jpeg, image/png`. */
    readonly acepta?: string;
  } = {},
): Promise<Blob> {
  const respuesta = await pedir(ruta, opciones, opciones.acepta ?? 'image/jpeg, image/png');

  return respuesta.blob();
}
