import { consultarCartasEnEspera, type CartaEnEspera } from '../infraestructura/api/diario.ts';
import { leerLoQueNoSeHaEnviado } from './loGuardadoEnEsteEquipo.ts';
import { leerConCopia, modificarLaCopia, type LecturaConCopia } from './lecturas.ts';

/**
 * Las cartas a mi de manana que esperan, con copia en este dispositivo (SCRUM-230).
 *
 * La tarjeta «Ayer te dejaste esto» tiene que poder aparecer, y poder borrar sin leer, tambien sin
 * conexion: por eso se guarda lo que el servidor dijo, como en el resto de lo que se lee.
 *
 * **Lo que se guarda es solo el identificador y el dia** de cada carta, nunca su texto: el servidor no
 * lo manda hasta que la persona decide abrirla. La copia vive en el almacen de la persona, cifrada, y se
 * borra al cerrar sesion.
 */
export const CLAVE_DE_LAS_CARTAS_EN_ESPERA = 'cartas-en-espera';

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lo guardado puede ser de otra version de la aplicacion: se queda con lo que entiende. */
function esCarta(valor: unknown): valor is CartaEnEspera {
  return (
    esObjeto(valor) &&
    typeof valor.id === 'string' &&
    valor.id !== '' &&
    typeof valor.dia === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor.dia)
  );
}

/**
 * Los identificadores de las cartas que la persona ya mando borrar desde este equipo y todavia no
 * salieron. Mientras esperan, la carta no puede volver a ofrecerse, aunque el servidor la siga teniendo.
 */
async function borradasSinEnviar(): Promise<ReadonlySet<string>> {
  const ids = (await leerLoQueNoSeHaEnviado())
    .filter((operacion) => operacion.tipo === 'diario.borrar')
    .map((operacion) => (esObjeto(operacion.payload) ? operacion.payload.id : undefined))
    .filter((id): id is string => typeof id === 'string' && id !== '');

  return new Set(ids);
}

/**
 * Las cartas que esperan, la mas reciente primero: del servidor si se puede, de la copia si no. Sin
 * copia y sin conexion falla, y quien llama no ofrece nada: nunca se inventa una carta.
 */
export async function leerLasCartasEnEspera(
  senal?: AbortSignal,
): Promise<LecturaConCopia<readonly CartaEnEspera[]>> {
  const lectura = await leerConCopia<readonly CartaEnEspera[]>(
    CLAVE_DE_LAS_CARTAS_EN_ESPERA,
    async () => ({
      estado: 'nuevo',
      valor: await consultarCartasEnEspera(senal),
      etag: null,
    }),
    senal,
  );
  const borradas = await borradasSinEnviar();
  const cartas = Array.isArray(lectura.valor) ? (lectura.valor as unknown[]).filter(esCarta) : [];

  return { ...lectura, valor: cartas.filter((carta) => !borradas.has(carta.id)) };
}

/** Saca una carta de la copia: ya se leyo o se mando borrar. Nunca falla. */
export function quitarLaCartaDeLaCopia(id: string): Promise<void> {
  return modificarLaCopia<readonly CartaEnEspera[]>(CLAVE_DE_LAS_CARTAS_EN_ESPERA, (actual) =>
    actual === null
      ? null
      : (actual as unknown[]).filter(esCarta).filter((carta) => carta.id !== id),
  );
}
