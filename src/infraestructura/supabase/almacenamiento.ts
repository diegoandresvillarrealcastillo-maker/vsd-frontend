/**
 * Donde se guarda la sesion, y por que hay dos sitios.
 *
 * ---------------------------------------------------------------------------
 * El caso que esto resuelve
 * ---------------------------------------------------------------------------
 *
 * Buena parte de quien va a usar VSD Health entra desde una sala de computo de
 * la universidad. En un equipo compartido, dejar la sesion abierta significa
 * que la siguiente persona que se siente entra directamente al diario de la
 * anterior.
 *
 * De ahi que haya dos destinos. Con `recordarEnEsteEquipo(false)` la sesion
 * vive en `sessionStorage`: sobrevive a recargar la pagina, que es lo que se
 * espera, y desaparece al cerrar la pestana. Con `true` vive en
 * `localStorage` y dura los treinta dias del token de refresco.
 *
 * Hoy nadie llama con `false`: la casilla que lo ofrecia se quito de las
 * pantallas de acceso y el proveedor guarda siempre. El mecanismo se conserva
 * entero y probado porque el caso de la sala de computo no ha desaparecido,
 * solo la forma de pedirlo; ver `RECORDAR_SIEMPRE` en `ProveedorDeSesion`.
 *
 * ---------------------------------------------------------------------------
 * Por que un adaptador y no dos clientes
 * ---------------------------------------------------------------------------
 *
 * El cliente de Supabase fija su almacenamiento cuando se construye, y la
 * eleccion la hace la persona despues, al entrar. Con dos clientes habria que
 * reconstruir uno a mitad del inicio de sesion y decidir cual manda en cada
 * llamada. Con un adaptador que enruta, el cliente es uno solo.
 *
 * ---------------------------------------------------------------------------
 * Un limite que conviene tener escrito
 * ---------------------------------------------------------------------------
 *
 * El token queda en un almacen que el JavaScript de la pagina puede leer. La
 * alternativa —una cookie que el navegador no deja leer— exige que el inicio
 * de sesion pase por un servidor nuestro, y aqui lo resuelve Supabase desde el
 * navegador. Es el compromiso que trae esa decision, y por eso el token de
 * acceso dura una hora: acota la ventana si alguna vez se filtra.
 *
 * Lo que nunca se guarda aqui es informacion de la persona. Solo el token.
 */

/** Marca que esta sesion no debe sobrevivir al cierre de la pestana. */
const CLAVE_SOLO_ESTA_PESTANA = 'vsd.solo-esta-pestana';

/**
 * Cualquiera de los dos almacenes puede no existir o lanzar: en una ventana
 * privada, con los datos del sitio bloqueados, o dentro de un iframe. Nada de
 * esto debe tumbar la aplicacion, asi que todo acceso va protegido y el peor
 * caso es que la sesion no se recuerde.
 */
function almacenSeguro(obtener: () => Storage): Storage | null {
  try {
    const almacen = obtener();
    const sonda = '__vsd_sonda__';

    // No basta con que exista: en algunos navegadores existe y falla al
    // escribir. La unica forma de saberlo es intentarlo.
    almacen.setItem(sonda, '1');
    almacen.removeItem(sonda);

    return almacen;
  } catch {
    return null;
  }
}

function local(): Storage | null {
  return almacenSeguro(() => window.localStorage);
}

function porPestana(): Storage | null {
  return almacenSeguro(() => window.sessionStorage);
}

/** Indica si la sesion actual es solo para esta pestana. */
export function esSoloDeEstaPestana(): boolean {
  return porPestana()?.getItem(CLAVE_SOLO_ESTA_PESTANA) === '1';
}

/**
 * Decide donde va a vivir la sesion. Se llama **antes** de iniciarla, porque
 * despues el token ya se habria escrito en el almacen equivocado.
 */
export function recordarEnEsteEquipo(recordar: boolean): void {
  const pestana = porPestana();

  if (recordar) {
    pestana?.removeItem(CLAVE_SOLO_ESTA_PESTANA);
    return;
  }

  pestana?.setItem(CLAVE_SOLO_ESTA_PESTANA, '1');
}

/** El almacen que corresponde ahora mismo. */
function elegido(): Storage | null {
  return esSoloDeEstaPestana() ? porPestana() : local();
}

/**
 * El adaptador que recibe el cliente de Supabase.
 *
 * Al leer mira primero el almacen elegido y despues el otro. Ese respaldo
 * importa en un caso concreto: si alguien marca "no recordar" teniendo ya una
 * sesion guardada en `localStorage`, sin el respaldo la aplicacion la daria
 * por perdida y lo expulsaria sin motivo.
 *
 * Al borrar se limpian **los dos**. Cerrar sesion tiene que cerrarla de
 * verdad, no dejar una copia en el almacen que hoy no toca.
 */
export const almacenamientoDeSesion = {
  getItem(clave: string): string | null {
    try {
      return elegido()?.getItem(clave) ?? local()?.getItem(clave) ?? null;
    } catch {
      return null;
    }
  },

  setItem(clave: string, valor: string): void {
    try {
      elegido()?.setItem(clave, valor);
    } catch {
      // Sin almacen, la sesion dura lo que dure la pagina. Es peor
      // experiencia, no un fallo de seguridad.
    }
  },

  removeItem(clave: string): void {
    try {
      local()?.removeItem(clave);
      porPestana()?.removeItem(clave);
    } catch {
      // Nada que hacer: si no se puede escribir, tampoco habia nada escrito.
    }
  },
};

/** Borra la marca de pestana. Se usa al cerrar sesion. */
export function olvidarPreferenciaDePestana(): void {
  try {
    porPestana()?.removeItem(CLAVE_SOLO_ESTA_PESTANA);
  } catch {
    // Ver arriba.
  }
}
