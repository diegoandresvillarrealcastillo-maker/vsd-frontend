import { entorno } from '../entorno.ts';
import { recordarElMotivo } from './motivoDelFallo.ts';

/**
 * Si de verdad hay conexion con la API (SCRUM-136).
 *
 * `navigator.onLine` solo sirve en un sentido: si dice que **no** hay red, es
 * cierto. Si dice que **si**, puede que sea mentira: estar conectado a una red wifi
 * no es poder llegar al servidor (la red sin salida, el portal cautivo, el servidor
 * caido). Por eso, antes de dar por buena la conexion, se le pregunta al servidor,
 * con `GET /health`, que responde sin tocar la base de datos.
 *
 * Tiene un limite de tiempo: un servidor que no contesta no es una conexion. En el
 * plan gratuito el servidor se duerme y despertarlo tarda entre 40 segundos y un minuto
 * (medido en PRE: 38 s). Con un limite de 15 s, la primera sincronizacion tras un rato sin
 * uso decia "sin conexion" y bloqueaba el boton aunque la red estuviera bien; el limite
 * cubre el despertar. Un fallo rapido (sin red, direccion que no responde) sigue siendo
 * rapido: esto solo alarga la espera de un servidor que no contesta.
 */
export const ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS = 60_000;

function direcciones(): string {
  const desde = typeof location === 'undefined' ? 'un origen desconocido' : location.origin;
  let hacia = entorno.urlDeLaApi;

  try {
    hacia = new URL(entorno.urlDeLaApi).origin;
  } catch {
    // Una direccion mal escrita se muestra tal cual: es justo lo que hay que ver.
  }

  return `desde ${desde} hacia ${hacia}`;
}

/** Una ruta publica y barata de la API, para cuando `/health` no se puede pedir. */
const RUTA_DE_RESPALDO = '/api/aviso';
const ESPERA_DE_LA_RUTA_DE_RESPALDO_EN_MS = 10_000;

/**
 * Lo que contesta la API por la ruta de respaldo: el estado HTTP, o `null` si no llego.
 *
 * Solo se pide cuando `/health` fallo de golpe, sin que el servidor llegara a contestar. Un bloqueador de
 * contenido del navegador (`net::ERR_BLOCKED_BY_CLIENT`) puede cortar solo esa direccion y dejar pasar el
 * resto de la API; sin esto, la comprobacion decia «sin conexion» y el envio de lo guardado se quedaba parado
 * con el servidor sano (SCRUM-244).
 */
async function estadoPorLaRutaDeRespaldo(): Promise<number | null> {
  const control = new AbortController();
  const limite = setTimeout(() => {
    control.abort();
  }, ESPERA_DE_LA_RUTA_DE_RESPALDO_EN_MS);

  try {
    const respuesta = await fetch(`${entorno.urlDeLaApi}${RUTA_DE_RESPALDO}`, {
      cache: 'no-store',
      signal: control.signal,
    });

    return respuesta.status;
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
  }
}

export async function hayConexionConLaApi(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    recordarElMotivo(`el navegador dice que no hay red (${direcciones()})`);

    return false;
  }

  const control = new AbortController();
  const inicio = Date.now();
  const limite = setTimeout(() => {
    control.abort();
  }, ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS);

  try {
    const respuesta = await fetch(`${entorno.urlDeLaApi}/health`, {
      // Sin cache: lo que se quiere saber es si responde ahora.
      cache: 'no-store',
      signal: control.signal,
    });

    // Un 429 («espera un momento») tambien es la API contestando: hay conexion, y el envio
    // respetara su `Retry-After` (SCRUM-244).
    const hay = respuesta.ok || respuesta.status === 429;

    recordarElMotivo(hay ? null : `el servidor respondió ${respuesta.status} (${direcciones()})`);

    return hay;
  } catch (error) {
    if (control.signal.aborted) {
      recordarElMotivo(
        `sin respuesta en ${ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS / 1000} s (${direcciones()})`,
      );
    } else {
      const que = error instanceof Error ? `${error.name}: ${error.message}` : 'error desconocido';
      const duracion = Date.now() - inicio;
      const porRespaldo = await estadoPorLaRutaDeRespaldo();

      if (
        porRespaldo !== null &&
        ((porRespaldo >= 200 && porRespaldo < 300) || porRespaldo === 429)
      ) {
        recordarElMotivo(null);

        return true;
      }

      // Desde la pagina no hay forma fiable de saber si un fallo de `fetch` fue CORS o red: el navegador
      // dice lo mismo en los dos casos (y una peticion `no-cors` a un JSON con `nosniff` tambien se
      // rechaza). Por eso solo se dice lo que se sabe: el error, cuanto tardo y desde donde a donde.
      recordarElMotivo(
        `${que.slice(0, 80)} en ${duracion} ms; por ${RUTA_DE_RESPALDO} ${
          porRespaldo === null ? 'tampoco llega' : `el servidor respondió ${porRespaldo}`
        } (${direcciones()})`,
      );
    }

    return false;
  } finally {
    clearTimeout(limite);
  }
}
