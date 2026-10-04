import { useEffect, useRef, type RefObject } from 'react';

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Lo que se alcanza con Tab dentro de la caja. Lo de un desplegable cerrado, no. */
function enfocablesDe(caja: HTMLElement): HTMLElement[] {
  return [...caja.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((elemento) => {
    const desplegable = elemento.closest('details');

    return desplegable === null || desplegable.open || elemento.tagName === 'SUMMARY';
  });
}

/**
 * Lo que necesita un dialogo para manejarse entero con teclado (SCRUM-98).
 *
 * - Al abrirse, el foco entra: a `inicial` si se da, o a lo primero que se
 *   pueda enfocar.
 * - Tab y Mayus+Tab dan la vuelta dentro, sin escaparse a la pagina de
 *   detras, que no se ve.
 * - Escape lo cierra.
 *
 * A donde vuelve el foco al cerrar lo decide quien lo abrio: suele ser el
 * boton que lo abrio, pero ese boton puede haber desaparecido.
 */
export function useDialogo<T extends HTMLElement>(
  alCerrar: () => void,
  inicial?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const caja = useRef<T>(null);
  const cerrar = useRef(alCerrar);

  useEffect(() => {
    cerrar.current = alCerrar;
  });

  useEffect(() => {
    const primero = caja.current === null ? undefined : enfocablesDe(caja.current)[0];

    (inicial?.current ?? primero)?.focus();

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar.current();
        return;
      }

      if (evento.key !== 'Tab' || caja.current === null) {
        return;
      }

      const enfocables = enfocablesDe(caja.current);
      const [inicio] = enfocables;
      const fin = enfocables.at(-1);

      if (inicio === undefined || fin === undefined) {
        evento.preventDefault();
        return;
      }

      const activo = document.activeElement;

      if (!caja.current.contains(activo)) {
        evento.preventDefault();
        inicio.focus();
      } else if (
        evento.shiftKey &&
        (activo === inicio || !enfocables.includes(activo as HTMLElement))
      ) {
        // Desde el primero, o desde algo que solo se enfoca a mano (el titulo).
        evento.preventDefault();
        fin.focus();
      } else if (!evento.shiftKey && activo === fin) {
        evento.preventDefault();
        inicio.focus();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);

    return () => document.removeEventListener('keydown', alPulsarTecla);
    // Solo al abrir: `inicial` se lee una vez, como hace el navegador con
    // `autofocus`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return caja;
}
