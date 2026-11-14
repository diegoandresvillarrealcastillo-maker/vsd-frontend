import { useEffect, useState } from 'react';

/**
 * Si hay un campo de texto con el foco.
 *
 * Lo usan lo que flota sobre la pantalla, la mascota y el semaforo, para
 * apartarse mientras se escribe: en el movil, con el teclado abierto, el
 * campo queda abajo y cualquier cosa flotante lo taparia.
 */

const TIPOS_QUE_NO_SE_ESCRIBEN = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function esCampoDeTexto(elemento: Element | null): boolean {
  if (elemento instanceof HTMLInputElement) {
    return !TIPOS_QUE_NO_SE_ESCRIBEN.has(elemento.type);
  }

  return (
    elemento instanceof HTMLTextAreaElement ||
    elemento instanceof HTMLSelectElement ||
    (elemento instanceof HTMLElement && elemento.isContentEditable)
  );
}

export function useEscribiendo(): boolean {
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    function revisar() {
      setEscribiendo(esCampoDeTexto(document.activeElement));
    }

    document.addEventListener('focusin', revisar);
    document.addEventListener('focusout', revisar);

    return () => {
      document.removeEventListener('focusin', revisar);
      document.removeEventListener('focusout', revisar);
    };
  }, []);

  return escribiendo;
}
