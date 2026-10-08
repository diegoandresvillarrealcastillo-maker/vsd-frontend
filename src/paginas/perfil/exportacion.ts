import type { CambioSinEnviar } from '../../sincronizacion/loGuardadoEnEsteEquipo.ts';

/**
 * El archivo que descarga la persona con "todo lo que VSD Health guarda de ti" (SCRUM-75,
 * SCRUM-142).
 *
 * Es lo que responde el servidor, **tal cual** (esta pantalla no lo interpreta), y, si este
 * equipo todavia guarda cambios que no llegaron al servidor, **se suman aparte** con la clave
 * `sinEnviarDesdeEsteEquipo`: sin ellos, el archivo no seria todo lo que se guarda de la
 * persona, y quien cierra sesion sin enviarlos los pierde.
 *
 * Si no hay nada sin enviar, no se agrega la clave: el archivo es el de siempre.
 */
export function armarLaExportacion(
  delServidor: unknown,
  sinEnviar: readonly CambioSinEnviar[],
): unknown {
  if (sinEnviar.length === 0) {
    return delServidor;
  }

  // Lo normal es un objeto con las secciones; si no lo fuera, se conserva entero y aparte.
  const base =
    typeof delServidor === 'object' && delServidor !== null && !Array.isArray(delServidor)
      ? delServidor
      : { servidor: delServidor };

  return { ...base, sinEnviarDesdeEsteEquipo: sinEnviar };
}
