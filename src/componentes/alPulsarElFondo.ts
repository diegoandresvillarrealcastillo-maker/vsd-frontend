import type { MouseEvent } from 'react';

/**
 * Para cerrar una ventana al pulsar el fondo que la rodea, sin cerrarla al pulsar
 * dentro (SCRUM-158).
 *
 * Antes cada ventana lo resolvia con un `onClick` en el fondo y otro en la caja que
 * llamaba a `stopPropagation`. Funciona, pero deja un `div` con un manejador de
 * clic y sin teclado, que es justo lo que un lector de pantalla y `jsx-a11y`
 * marcan como un control que no se puede usar sin raton. Aqui el fondo mira que el
 * clic sea **suyo** (`target === currentTarget`) y la caja no necesita nada.
 *
 * Sigue sin ser un control: el fondo lleva `role="presentation"` y quien usa
 * teclado cierra con Escape, que cada ventana ya maneja. Esto solo ahorra el
 * clic fuera a quien usa raton o dedo.
 */
export function alPulsarElFondo(alCerrar: () => void): (evento: MouseEvent<HTMLElement>) => void {
  return (evento) => {
    if (evento.target === evento.currentTarget) {
      alCerrar();
    }
  };
}
