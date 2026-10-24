/**
 * Cuanto hay que desplazar el recorrido de la ruta del dia (SCRUM-250) para que una fila quede
 * en su centro, sin pasarse de ninguno de los dos extremos.
 *
 * Es una cuenta sobre numeros, sin pantalla: `fila.arriba` es donde empieza la fila **dentro del
 * contenido** (con el desplazamiento actual ya sumado), y `contenido` es el alto de todo lo que se
 * desplaza.
 */
export function desplazamientoParaCentrar(
  fila: { readonly arriba: number; readonly alto: number },
  recorrido: { readonly alto: number; readonly contenido: number },
): number {
  const deseado = fila.arriba + fila.alto / 2 - recorrido.alto / 2;
  const maximo = Math.max(0, recorrido.contenido - recorrido.alto);

  return Math.min(Math.max(0, deseado), maximo);
}
