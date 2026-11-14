import type { Racha } from '../infraestructura/api/racha.ts';
import type { SituacionDeLaRacha } from './frasesDeLaRacha.ts';

/** Desde que hora (local de la persona) es «la tarde»: antes no se habla de lo que esta en juego. */
export const HORA_DE_LA_TARDE = 18;

/** A cuantos dias del proximo hito se dice que esta cerca. */
const DIAS_PARA_ESTAR_CERCA = 3;

/** Desde cuantos dias seguidos una racha vale la pena avisar de lo que esta en juego. */
const DIAS_PARA_AVISAR_DEL_RIESGO = 3;

/**
 * Que le dice la mascota a la persona segun su racha y la hora (SCRUM-243).
 *
 * El riesgo solo sale cuando de verdad aplica (ADR 0024, addendum de SCRUM-242): hoy todavia sin
 * hacer, de tarde, con una racha de 3 dias o mas. Y dice la verdad segun los congelamientos:
 * si quedan, una actividad evita gastar uno; si no quedan, la racha esta en juego. En cualquier otro
 * caso la mascota anima: un hito cerca, o un dia mas.
 *
 * `hora` es la hora local de la persona (0 a 23).
 */
export function situacionDeLaRacha(racha: Racha, hora: number): SituacionDeLaRacha {
  if (racha.enDescanso) {
    return 'regreso';
  }

  if (!racha.hechoHoy && hora >= HORA_DE_LA_TARDE && racha.dias >= DIAS_PARA_AVISAR_DEL_RIESGO) {
    return racha.congelamientosDisponibles > 0
      ? 'riesgoConCongelamientos'
      : 'riesgoSinCongelamientos';
  }

  const faltan = racha.proximoHito - racha.dias;

  return racha.proximoHito > 0 && faltan > 0 && faltan <= DIAS_PARA_ESTAR_CERCA
    ? 'cercaDelHito'
    : 'diaNormal';
}
