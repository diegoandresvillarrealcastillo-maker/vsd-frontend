const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * El dia `n` dias antes de `dia`, en AAAA-MM-DD.
 *
 * Un dia es un dia del calendario y no un instante: se cuenta a mediodia UTC para que
 * ninguna zona lo mueva. Por eso no depende de la zona de nadie y la pueden usar tanto la
 * pantalla del diario como lo que se guarda por adelantado para usarlo sin conexion.
 */
export function diasAntes(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) - n * UN_DIA).toISOString().slice(0, 10);
}
