import { llamarALaApi } from './clienteHttp.ts';

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
  readonly registradoEn: string;
  /** Vacio mientras la persona no ha elegido con que modulos empezar. */
  readonly modulosActivos: readonly Modulo[];
  /** `null` usa la mascota de siempre. */
  readonly mascota: Mascota | null;
}

/** Lo que se puede cambiar de las preferencias. Lo que no venga, se queda igual. */
export interface CambiosDePreferencias {
  readonly nombre?: string;
  readonly modulosActivos?: readonly Modulo[];
  readonly mascota?: Mascota;
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
 * El cuerpo lleva **solo** la version del aviso. El correo y la identidad
 * salen del token que la API verifica, y el rol lo fija ella: mandarlo aqui
 * seria pedir una escalada de privilegios, y la API responde 400 porque el
 * campo no existe en su contrato.
 */
export function darDeAltaLaCuenta(versionPolitica: string, senal?: AbortSignal): Promise<Cuenta> {
  return llamarALaApi<Cuenta>(RUTA, {
    metodo: 'POST',
    cuerpo: { versionPolitica },
    ...(senal ? { senal } : {}),
  });
}

/**
 * La cuenta propia, y unicamente la propia.
 *
 * No hay parametro de persona ni podria haberlo: el identificador sale del
 * token y las politicas de la base filtran por el.
 */
export function consultarLaCuentaPropia(senal?: AbortSignal): Promise<Cuenta> {
  return llamarALaApi<Cuenta>(RUTA, senal ? { senal } : {});
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
 * Cambia el nombre, los modulos activos o la mascota de la cuenta propia.
 *
 * Devuelve la cuenta como quedo, que es lo que hay que pintar: la API ordena
 * los modulos y normaliza la mascota, asi que lo enviado y lo guardado no
 * siempre coinciden letra por letra.
 */
export function cambiarPreferencias(
  cambios: CambiosDePreferencias,
  senal?: AbortSignal,
): Promise<Cuenta> {
  return llamarALaApi<Cuenta>(`${RUTA}/preferencias`, {
    metodo: 'PATCH',
    cuerpo: cambios,
    ...(senal ? { senal } : {}),
  });
}
