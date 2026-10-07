import { entorno } from '../entorno.ts';

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
 * plan gratuito el servidor se duerme y despertarlo tarda cerca de un minuto; este
 * limite es mas corto, y esta bien: cuenta como "todavia no", y esta misma peticion
 * ya lo esta despertando para el siguiente intento.
 */
export const ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS = 15_000;

export async function hayConexionConLaApi(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const control = new AbortController();
  const limite = setTimeout(() => {
    control.abort();
  }, ESPERA_MAXIMA_DE_LA_COMPROBACION_EN_MS);

  try {
    const respuesta = await fetch(`${entorno.urlDeLaApi}/health`, {
      // Sin cache: lo que se quiere saber es si responde ahora.
      cache: 'no-store',
      signal: control.signal,
    });

    return respuesta.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(limite);
  }
}
