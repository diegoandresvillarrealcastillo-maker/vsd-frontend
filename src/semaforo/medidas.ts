/**
 * Cuanto ocupa la esquina del semaforo contando desde abajo, con un margen
 * para que no se toque con lo de encima. La mascota no baja de ahi cuando
 * esta a la derecha (SCRUM-98).
 *
 * Sale de `semaforo.css`: en el movil el boton (56 px) va sobre la navegacion
 * inferior, a 104 px del borde; fuera del movil, a 24 px. Si cambia alli,
 * cambia aqui.
 */
export const ESPACIO_DEL_SEMAFORO = {
  movil: 104 + 56 + 12,
  escritorio: 24 + 56 + 12,
} as const;
