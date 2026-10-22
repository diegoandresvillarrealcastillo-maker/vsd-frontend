import { sincronizarLosArchivosDeLaPersona } from '../../foto/archivosDeLaPersona.ts';
import { fijarLaZonaDeLaCuenta, zonaDelDispositivo } from '../../tiempo/zonaHoraria.ts';
import type { Cuenta, TextoPendiente } from './cuenta.ts';
import { ErrorDeLaApi, llamarALaApi } from './clienteHttp.ts';
import type { TextosVigentes } from './aviso.ts';

/**
 * El registro de la persona: su fecha de nacimiento y lo que acepta.
 *
 * Es la otra mitad de `POST /api/cuenta` (T-01 de la auditoria 360). La API
 * exige la fecha, que sea mayor de 18 anos y las dos casillas para crear una
 * cuenta, y a las cuentas anteriores a eso las deja con el registro incompleto
 * hasta que lo completan. El alta de siempre, la del panel, se queda en
 * `cuenta.ts` y sigue sin mandar nada de esto.
 *
 * La API compara la edad en el servidor. Lo que este archivo mande sobre ella es
 * lo que la persona escribio, tal cual.
 */

const RUTA = '/api/cuenta';

/** Lo que se sabe de la cuenta de quien tiene sesion. */
export type EstadoDelRegistro =
  | { readonly estado: 'completo'; readonly cuenta: Cuenta }
  /** La cuenta existe pero es anterior a que se pidiera la fecha y las casillas. */
  | { readonly estado: 'incompleto'; readonly cuenta: Cuenta }
  /**
   * La cuenta esta completa, pero el aviso o los terminos que acepto ya no son los vigentes
   * (SCRUM-237): hay que volver a aceptarlos antes de usar nada.
   */
  | {
      readonly estado: 'textos-pendientes';
      readonly cuenta: Cuenta;
      readonly pendientes: readonly TextoPendiente[];
    }
  /** Hay identidad y todavia no hay cuenta: se registro (o entro con Google) y falta el alta. */
  | { readonly estado: 'sin-cuenta' };

/**
 * Pregunta como esta el registro, sin cambiar nada.
 *
 * Es la misma llamada que el panel hace al entrar, sin la fecha ni las casillas.
 * La API contesta de tres maneras, y de ahi sale el estado:
 *
 * - **200 con `registroCompleto`**: la cuenta esta lista.
 * - **200 con `registroCompleto: false`**: es una cuenta de las anteriores.
 * - **400 `FECHA_DE_NACIMIENTO_INVALIDA`**: no hay cuenta. Es el unico caso en
 *   que ese error puede salir de esta llamada, porque a quien ya tiene cuenta
 *   la API no le pide la fecha.
 *
 * Una API anterior a T-01 no manda `registroCompleto`: se entiende que esta
 * completo, que es lo que era para ella.
 */
export async function consultarElEstadoDelRegistro(
  senal?: AbortSignal,
): Promise<EstadoDelRegistro> {
  let cuenta: Cuenta;

  try {
    cuenta = await llamarALaApi<Cuenta>(RUTA, {
      metodo: 'POST',
      cuerpo: { zonaHoraria: zonaDelDispositivo() },
      ...(senal ? { senal } : {}),
    });
  } catch (error) {
    if (error instanceof ErrorDeLaApi && error.codigo === 'FECHA_DE_NACIMIENTO_INVALIDA') {
      return { estado: 'sin-cuenta' };
    }

    throw error;
  }

  if (cuenta.registroCompleto === false) {
    return { estado: 'incompleto', cuenta };
  }

  // Una API anterior no manda `textosPendientes`: se entiende que esta al dia, que es lo que era para
  // ella. No se piden la foto ni la mascota: la API las negaria mientras haya textos pendientes, y se
  // piden al aceptar.
  const pendientes = cuenta.textosPendientes ?? [];

  if (pendientes.length > 0) {
    return { estado: 'textos-pendientes', cuenta, pendientes };
  }

  fijarLaZonaDeLaCuenta(cuenta.zonaHoraria);
  sincronizarLosArchivosDeLaPersona(cuenta);

  return { estado: 'completo', cuenta };
}

/** Lo que escribio la persona al completar su registro. */
export interface DatosDelRegistro {
  /** AAAA-MM-DD, como la entrega un campo de fecha. */
  readonly fechaNacimiento: string;
  /** Las versiones que la persona vio al aceptar: las que la API tiene como vigentes. */
  readonly textos: TextosVigentes;
}

/**
 * Crea la cuenta, o completa la de quien la tenia incompleta.
 *
 * Las casillas viajan en `true` porque quien llega aqui las marco: esta funcion
 * no se llama sin ellas. La API las exige y no acepta la version sola.
 *
 * Si la API rechaza por la edad responde 403 `MENOR_DE_EDAD`, borra la identidad
 * y no guarda nada. Es un `ErrorDeLaApi` que quien llama tiene que reconocer
 * (`esUnRechazoPorEdad`): lo que sigue es mostrar la pantalla de rechazo y cerrar
 * la sesion, no un mensaje de error.
 *
 * Igual que el alta del panel, si la API no acepta la zona se repite sin ella: es
 * una comodidad, no una condicion.
 */
export async function completarElRegistro(
  datos: DatosDelRegistro,
  senal?: AbortSignal,
): Promise<Cuenta> {
  const cuerpo = {
    fechaNacimiento: datos.fechaNacimiento,
    versionPolitica: datos.textos.aviso,
    versionTerminos: datos.textos.terminos,
    aceptaAviso: true,
    aceptaTerminos: true,
  };
  const opciones = (extra: Record<string, string>) => ({
    metodo: 'POST' as const,
    cuerpo: { ...cuerpo, ...extra },
    ...(senal ? { senal } : {}),
  });

  let cuenta: Cuenta;

  try {
    cuenta = await llamarALaApi<Cuenta>(RUTA, opciones({ zonaHoraria: zonaDelDispositivo() }));
  } catch (error) {
    if (!(error instanceof ErrorDeLaApi) || error.codigo !== 'ZONA_HORARIA_INVALIDA') {
      throw error;
    }

    cuenta = await llamarALaApi<Cuenta>(RUTA, opciones({}));
  }

  fijarLaZonaDeLaCuenta(cuenta.zonaHoraria);
  sincronizarLosArchivosDeLaPersona(cuenta);

  return cuenta;
}

/** Lo que se necesita para volver a aceptar los textos que cambiaron. */
export interface AceptacionDeTextos {
  /** Cuales hay que aceptar: los que dijo la API en `textosPendientes`. */
  readonly pendientes: readonly TextoPendiente[];
  /** Las versiones que la persona vio al aceptar: las que la API tiene como vigentes. */
  readonly textos: TextosVigentes;
}

/**
 * Vuelve a aceptar el aviso de privacidad o los terminos cuando cambiaron (SCRUM-237).
 *
 * Manda la casilla y la version de **lo que esta pendiente**, como el registro: la API exige las
 * casillas en `true` y la version vigente, y la fecha la pone ella. Las casillas viajan en `true`
 * porque quien llega aqui las marco: esta funcion no se llama sin ellas.
 *
 * Si los textos cambiaron otra vez mientras tanto, la API responde 409 con el codigo del texto; quien
 * llama vuelve a pedir las versiones y reintenta.
 *
 * Devuelve la cuenta como quedo, y entonces si se piden la foto y la mascota que no se pudieron pedir
 * con los textos pendientes.
 */
export async function aceptarLosTextos(
  datos: AceptacionDeTextos,
  senal?: AbortSignal,
): Promise<Cuenta> {
  const cuerpo = {
    ...(datos.pendientes.includes('aviso_de_privacidad')
      ? { aceptaAviso: true, versionPolitica: datos.textos.aviso }
      : {}),
    ...(datos.pendientes.includes('terminos')
      ? { aceptaTerminos: true, versionTerminos: datos.textos.terminos }
      : {}),
  };

  const cuenta = await llamarALaApi<Cuenta>(`${RUTA}/aceptacion`, {
    metodo: 'POST',
    cuerpo,
    ...(senal ? { senal } : {}),
  });

  fijarLaZonaDeLaCuenta(cuenta.zonaHoraria);
  sincronizarLosArchivosDeLaPersona(cuenta);

  return cuenta;
}

/** Si el fallo es que la API considero menor de edad a la persona. */
export function esUnRechazoPorEdad(error: unknown): boolean {
  return error instanceof ErrorDeLaApi && error.codigo === 'MENOR_DE_EDAD';
}
