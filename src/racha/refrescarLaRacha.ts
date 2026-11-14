import { consultarLaRacha, type Racha } from '../infraestructura/api/racha.ts';
import { rachaRecordadaDe, recordarLaRacha } from './memoriaDeLaRacha.ts';

/**
 * Pide la racha otra vez, por ejemplo al terminar una actividad (SCRUM-243).
 *
 * Devuelve lo que se sabia **antes** y lo que dice **ahora** el servidor, para que la pantalla decida
 * si hay algo que celebrar: el cliente no cuenta dias, solo compara. Lo nuevo queda recordado, y
 * con eso la llama de la barra se actualiza sola.
 *
 * Si no se puede pedir, rechaza y no toca lo recordado.
 */
export async function refrescarLaRacha(
  cuenta: string,
  senal?: AbortSignal,
): Promise<{ readonly antes: Racha | null; readonly ahora: Racha }> {
  const antes = rachaRecordadaDe(cuenta);
  const ahora = await consultarLaRacha(senal);

  recordarLaRacha(cuenta, ahora);

  return { antes, ahora };
}
