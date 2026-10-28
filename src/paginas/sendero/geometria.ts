/**
 * Las medidas del camino del sendero, que comparten la etapa de cada modulo y el mapa de 365 dias
 * (SCRUM-92 y SCRUM-293).
 *
 * La traza se dibuja con estas mismas cifras en lugar de medir nada en el navegador, asi que tienen
 * que coincidir con `.sendero__fila` y `.sendero__fila--hoy` de la hoja de estilos.
 */

/** Alto de cada fila del camino. */
export const ALTO_DE_FILA = 96;
export const ALTO_DE_FILA_DE_HOY = 132;

/** Desplazamiento lateral de cada punto, para que el camino serpentee. */
export function desplazamiento(indice: number): number {
  return Math.round(Math.sin(indice * 0.9) * 56);
}
