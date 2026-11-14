/**
 * Una vibracion corta al elegir algo, en los telefonos que la tienen (SCRUM-173).
 *
 * Es un detalle y nada depende de el: donde no hay `navigator.vibrate` (iPhone, escritorio)
 * no pasa nada. Y no vibra con `prefers-reduced-motion`, porque quien pidio menos movimiento
 * tampoco quiere que el telefono se mueva.
 */
export function vibrar(milisegundos = 12): void {
  try {
    if (typeof navigator.vibrate !== 'function') {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    navigator.vibrate(milisegundos);
  } catch {
    // Un detalle que no funciona no se avisa.
  }
}
