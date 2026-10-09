/**
 * Lo que acompana a la barra de avance de hoy (SCRUM-170).
 *
 * Cambia segun el momento y nunca reprocha: tampoco cuando no se ha hecho nada.
 */
export function textoDelAvance(hechas: number, total: number): string {
  if (total === 0) {
    return 'Elige un módulo para empezar tu plan de hoy.';
  }

  if (hechas === total) {
    return '¡Terminaste tu ruta de hoy! Lo que hiciste cuenta.';
  }

  if (hechas === 0) {
    return `${String(total)} actividades te esperan hoy. Empieza por la que más te llame, sin prisa.`;
  }

  return `¡Buen ritmo! ${String(hechas)} de ${String(total)} actividades de hoy.`;
}
