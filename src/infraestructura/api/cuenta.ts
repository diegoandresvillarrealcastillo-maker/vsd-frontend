import { sincronizarLosArchivosDeLaPersona } from '../../foto/archivosDeLaPersona.ts';
import { fijarLaZonaDeLaCuenta, zonaDelDispositivo } from '../../tiempo/zonaHoraria.ts';
import { ErrorDeLaApi, llamarALaApi } from './clienteHttp.ts';

/**
 * La cuenta de VSD Health, por HTTP.
 *
 * Estos tipos son la copia de este lado del contrato que publica el backend en
 * `openapi.json`. Estan escritos a mano por ahora; en el Ciclo 6 se generan
 * desde ese archivo, y entonces un cambio en la API que rompa al cliente se
 * detecta al compilar en lugar de en ejecucion.
 * Ver docs/adr/0001-dos-repositorios-separados.md en vsd-backend.
 */

/**
 * El consentimiento de tratamiento de datos.
 *
 * `aceptadoEn` es texto y no `Date` a proposito: sobre JSON una fecha viaja
 * como cadena ISO. Convertirla aqui escondia que la conversion existe; quien
 * la necesite como fecha la construye donde la use.
 */
export interface Consentimiento {
  readonly versionPolitica: string;
  readonly aceptadoEn: string;
}

/** Los tres modulos, con la clave estable que usa la API. */
export type Modulo = 'cognicion' | 'bienestar' | 'emociones';

/**
 * La mascota de la persona: el personaje (`forma`) y su nombre (SCRUM-99).
 *
 * Color y accesorio son del modelo anterior y pueden venir en cuentas que ya
 * los tenian guardados; los personajes no los usan.
 */
export interface Mascota {
  readonly forma: string;
  readonly nombre: string;
  readonly color?: string;
  readonly accesorio?: string;
}

/**
 * La foto de perfil, vista desde la cuenta (SCRUM-120): que hay y desde cuando,
 * nunca los bytes. La foto se pide aparte (`api/foto.ts`).
 */
export interface FotoDeLaCuenta {
  /**
   * Cuando se guardo la foto actual. Cambia con cada foto nueva, y por eso sirve
   * para saber si la que se tenia ya no es la vigente.
   */
  readonly actualizadaEl: string;
}

/**
 * La mascota propia, vista desde la cuenta (SCRUM-122): que hay y desde cuando,
 * nunca el dibujo, que es un SVG y se pide aparte (`api/mascotaPropia.ts`).
 */
export interface MascotaPropiaDeLaCuenta {
  /**
   * Cuando se guardo la mascota propia actual. Cambia con cada una nueva, y por
   * eso sirve para saber si la que se tenia ya no es la vigente.
   */
  readonly actualizadaEl: string;
}

/**
 * La cuenta propia.
 *
 * El `id` de aqui es **el nuestro**, no el de Supabase: es el que relacionan
 * los resultados. El del proveedor no sale por la API, porque es un detalle de
 * como se autentica la persona y no le sirve a quien consume la API.
 */
export interface Cuenta {
  readonly id: string;
  readonly correo: string;
  readonly rol: string;
  readonly nombre?: string;
  readonly consentimiento: Consentimiento;
  /**
   * Los terminos que acepto con su casilla, o `null` en las cuentas anteriores a
   * que se pidieran. Opcional por lo mismo que `registroCompleto`.
   */
  readonly terminos?: Consentimiento | null;
  /**
   * Si la cuenta tiene su fecha de nacimiento y el aviso y los terminos aceptados
   * con casilla. Las cuentas anteriores a eso vienen en `false`, y la API les
   * responde 403 `REGISTRO_INCOMPLETO` a todo menos a ver, exportar y borrar la
   * cuenta. Opcional porque una API anterior no lo manda: sin el, se entiende
   * completa.
   */
  readonly registroCompleto?: boolean;
  readonly registradoEn: string;
  /** Vacio mientras la persona no ha elegido con que modulos empezar. */
  readonly modulosActivos: readonly Modulo[];
  /** `null` usa la mascota de siempre. */
  readonly mascota: Mascota | null;
  /**
   * Si la persona permite que se revise lo que escribe en su diario para
   * mostrarle lineas de atencion (SCRUM-108). Apagado salvo que ella lo
   * encienda en su perfil.
   */
  readonly diarioConRecomendaciones: boolean;
  /**
   * La zona horaria de la persona, la que informo su dispositivo. Decide que dia
   * es para ella, tanto aqui como en el servidor (SCRUM-123).
   */
  readonly zonaHoraria: string;
  /**
   * La foto de perfil, o `null` si no tiene. Opcional a proposito: una version de
   * la API anterior a SCRUM-120 no manda el campo, y la pantalla tiene que
   * funcionar igual, sin foto.
   */
  readonly foto?: FotoDeLaCuenta | null;
  /**
   * La mascota propia, un SVG, o `null` si no tiene (SCRUM-122). Opcional por lo
   * mismo que `foto`. Para usarla, `mascota.forma` es `propia`.
   */
  readonly mascotaPropia?: MascotaPropiaDeLaCuenta | null;
}

/** Lo que se puede cambiar de las preferencias. Lo que no venga, se queda igual. */
export interface CambiosDePreferencias {
  readonly nombre?: string;
  readonly modulosActivos?: readonly Modulo[];
  readonly mascota?: Mascota;
  readonly diarioConRecomendaciones?: boolean;
}

const RUTA = '/api/cuenta';

/**
 * Da de alta la cuenta, o recupera la que ya existe.
 *
 * Hace falta porque Supabase autentica pero no sabe nada del dominio: no
 * conoce el rol ni el consentimiento. Hasta que esta llamada ocurre, quien
 * inicia sesion tiene identidad y no tiene cuenta, y cualquier otra operacion
 * suya responde 403.
 *
 * Es idempotente en el servidor: si ya habia cuenta la devuelve sin volver a
 * pedir el consentimiento ni sobrescribir el que hay —la fecha y la version
 * guardadas son la prueba de lo que se acepto aquel dia—. De ahi que se pueda
 * invocar en cada inicio de sesion, y que no pase nada si React monta el
 * efecto dos veces en desarrollo.
 *
 * El cuerpo lleva la version del aviso y la zona horaria del dispositivo
 * (SCRUM-123). El correo y la identidad salen del token que la API verifica, y
 * el rol lo fija ella: mandarlo aqui seria pedir una escalada de privilegios, y
 * la API responde 400 porque el campo no existe en su contrato.
 *
 * ## La zona viaja en cada entrada
 *
 * Es lo que hace que viajar no obligue a configurar nada: si la cuenta existe y
 * la zona es otra, la API la actualiza. Y es lo que hace falta para que este
 * lado cuente el dia con la misma zona que el servidor, que se fija al recibir
 * la cuenta.
 *
 * ## Si la API no acepta la zona, se entra igual
 *
 * La zona es una comodidad, no una condicion para entrar. Si la API la rechaza
 * (una zona que no reconoce, o una version de la API anterior que todavia no
 * conoce el campo) la peticion se repite sin ella, y se entra con la zona que
 * la cuenta ya tenia. Otros errores —sin conexion, sin consentimiento, correo
 * repetido— no se reintentan: no tienen que ver con la zona.
 */
export async function darDeAltaLaCuenta(
  versionPolitica: string,
  senal?: AbortSignal,
): Promise<Cuenta> {
  const opciones = (cuerpo: Record<string, string>) => ({
    metodo: 'POST' as const,
    cuerpo,
    ...(senal ? { senal } : {}),
  });

  let cuenta: Cuenta;

  try {
    cuenta = await llamarALaApi<Cuenta>(
      RUTA,
      opciones({ versionPolitica, zonaHoraria: zonaDelDispositivo() }),
    );
  } catch (error) {
    if (!(error instanceof ErrorDeLaApi) || error.estado !== 400) {
      throw error;
    }

    cuenta = await llamarALaApi<Cuenta>(RUTA, opciones({ versionPolitica }));
  }

  fijarLaZonaDeLaCuenta(cuenta.zonaHoraria);
  sincronizarLosArchivosDeLaPersona(cuenta);

  return cuenta;
}

/**
 * La cuenta propia, y unicamente la propia.
 *
 * No hay parametro de persona ni podria haberlo: el identificador sale del
 * token y las politicas de la base filtran por el.
 */
export async function consultarLaCuentaPropia(senal?: AbortSignal): Promise<Cuenta> {
  const cuenta = await llamarALaApi<Cuenta>(RUTA, senal ? { senal } : {});

  fijarLaZonaDeLaCuenta(cuenta.zonaHoraria);
  sincronizarLosArchivosDeLaPersona(cuenta);

  return cuenta;
}

/** La frase que la API exige para borrar la cuenta. */
export const FRASE_PARA_BORRAR = 'BORRAR MI CUENTA';

/**
 * Todo lo que VSD Health guarda de la persona (derecho de acceso, SCRUM-75).
 *
 * Se trata como datos opacos: esta pantalla no los interpreta, solo los
 * entrega a la persona en un archivo.
 */
export function exportarMisDatos(senal?: AbortSignal): Promise<unknown> {
  return llamarALaApi<unknown>(`${RUTA}/exportacion`, senal ? { senal } : {});
}

/**
 * Borra la cuenta con todo lo suyo y su identidad en el proveedor
 * (derecho de supresion, SCRUM-75). No tiene vuelta atras.
 *
 * La API exige la frase exacta en el cuerpo. La pide la pantalla a la persona;
 * aqui solo se envia.
 */
export function borrarMiCuenta(confirmacion: string): Promise<void> {
  return llamarALaApi<void>(RUTA, { metodo: 'DELETE', cuerpo: { confirmacion } });
}

/**
 * Cambia el nombre, los modulos activos, la mascota o el permiso del diario de
 * la cuenta propia.
 *
 * Devuelve la cuenta como quedo, que es lo que hay que pintar: la API ordena
 * los modulos y normaliza la mascota, asi que lo enviado y lo guardado no
 * siempre coinciden letra por letra.
 */
export async function cambiarPreferencias(
  cambios: CambiosDePreferencias,
  senal?: AbortSignal,
): Promise<Cuenta> {
  const cuenta = await llamarALaApi<Cuenta>(`${RUTA}/preferencias`, {
    metodo: 'PATCH',
    cuerpo: cambios,
    ...(senal ? { senal } : {}),
  });

  sincronizarLosArchivosDeLaPersona(cuenta);

  return cuenta;
}
