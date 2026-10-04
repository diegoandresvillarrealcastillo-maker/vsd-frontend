/**
 * Donde se abre VSD IA y donde se posa la mascota (SCRUM-100).
 *
 * Se calcula aqui y no en el CSS porque la mascota tiene que saber a que
 * punto ir antes de que el asistente se pinte: las dos animaciones empiezan
 * a la vez.
 */

export interface Marco {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const MARGEN_MOVIL = 12;
const MARGEN = 24;
/** La barra superior mide 76 px; la mascota posada no la pisa. */
const ARRIBA = 84;

/**
 * En el movil, casi todo el ancho y hasta tres cuartos del alto, abajo. Fuera
 * del movil, una columna abajo a la izquierda, donde suele estar la mascota.
 */
export function marcoDelAsistente(
  ancho: number,
  alto: number,
  movil: boolean,
  ladoDeLaMascota: number,
): Marco {
  // Por encima tiene que caber la mitad de la mascota, que se posa en la
  // esquina, y la barra superior.
  const altoMaximo = alto - ARRIBA - ladoDeLaMascota * 0.6 - (movil ? MARGEN_MOVIL : MARGEN);

  if (movil) {
    const height = Math.max(240, Math.min(alto * 0.75, 640, altoMaximo));

    return {
      left: MARGEN_MOVIL,
      top: alto - height - MARGEN_MOVIL,
      width: ancho - MARGEN_MOVIL * 2,
      height,
    };
  }

  const height = Math.max(320, Math.min(620, altoMaximo));

  return {
    left: MARGEN + ladoDeLaMascota * 0.25,
    top: alto - height - MARGEN,
    width: Math.min(420, ancho - MARGEN * 2),
    height,
  };
}

/** La esquina superior izquierda del asistente, con la mascota medio fuera. */
export function puntoDeLaMascota(marco: Marco, lado: number): { x: number; y: number } {
  return {
    x: Math.max(4, marco.left - lado * 0.25),
    y: Math.max(4, marco.top - lado * 0.6),
  };
}
