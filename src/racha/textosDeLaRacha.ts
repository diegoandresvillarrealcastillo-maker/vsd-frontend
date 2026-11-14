import type { NivelDeLaLlama, Racha } from '../infraestructura/api/racha.ts';

/**
 * Los textos de la llama que comparten el boton de la barra y su panel (SCRUM-186).
 *
 * Ninguno habla de perdida, de falta ni de reclamo, y lo vigila una prueba: la llama descansa, no se
 * pierde ni se rompe.
 */

/** El nombre de cada nivel, para quien lo lee en el panel. */
export const NOMBRE_DEL_NIVEL: Readonly<Record<NivelDeLaLlama, string>> = {
  0: 'Ascua',
  1: 'Llama',
  2: 'Llama firme',
  3: 'Hoguera',
  4: 'Estrella',
};

export function diasSeguidos(dias: number): string {
  return `${String(dias)} ${dias === 1 ? 'día seguido' : 'días seguidos'}`;
}

/** El texto de los congelamientos del mes. */
export function textoDeLosCongelamientos(racha: Racha): string {
  const { congelamientosUsados: usados, congelamientosPorMes: porMes } = racha;

  if (usados === 0) {
    return `Cada mes te cubrimos hasta ${String(porMes)} días sin actividad para que tu llama no se corte.`;
  }

  if (usados >= porMes) {
    return `Este mes te cubrimos ${String(usados)} de ${String(porMes)} días sin actividad. El mes que viene vuelven a estar.`;
  }

  return `Este mes te cubrimos ${String(usados)} de ${String(porMes)} días sin actividad. Quedan ${String(porMes - usados)}.`;
}
