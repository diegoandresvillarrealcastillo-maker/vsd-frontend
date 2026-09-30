import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin esto, cada prueba deja su arbol montado y la siguiente encuentra dos
// veces el mismo boton. El sintoma es una prueba que falla solo cuando se
// ejecuta despues de otra, que es de las cosas mas molestas de diagnosticar.
afterEach(() => {
  cleanup();
});

/**
 * jsdom no trae `scrollIntoView`.
 *
 * Lo usa el enlace de salto al contenido. Sin este relleno, la prueba de ese
 * enlace pasa y aun asi el conjunto termina con un error suelto, porque el
 * fallo ocurre despues de la comprobacion.
 *
 * No hace nada: en una prueba no hay nada que desplazar, y lo que se quiere
 * verificar es a donde fue el foco.
 */
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function noDesplaza(): void {
    // Sin ventana, no hay desplazamiento.
  };
}

/**
 * jsdom no trae `matchMedia`.
 *
 * Se consulta en dos sitios: para saber que tema pide el sistema y para saber
 * si alguien pidio menos movimiento. Sin este relleno, montar la portada
 * revienta con "window.matchMedia is not a function", y el fallo no tiene nada
 * que ver con lo que se estaba comprobando.
 *
 * Responde que no a todo. Es la respuesta correcta para una prueba: sin
 * preferencia de tema se usa el claro, y sin preferencia de movimiento se
 * anima, que son los dos caminos por defecto.
 */
// Se comprueba que sea una funcion y no solo que el nombre exista: jsdom
// declara la propiedad y la deja sin implementar, asi que `in` responde que si
// y llamarla revienta igual.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

/**
 * jsdom no trae `IntersectionObserver`.
 *
 * La portada anima cada bloque al entrar en pantalla, y para eso Framer Motion
 * lo usa. Sin este relleno, montar la portada en una prueba revienta con
 * "IntersectionObserver is not defined" y el fallo no tiene nada que ver con
 * lo que se estaba comprobando.
 *
 * El doble no observa nada ni dispara nunca. Es justo lo que hace falta: en
 * una prueba no hay desplazamiento que observar, y lo que se quiere verificar
 * es el contenido, no si aparecio con un desvanecido.
 */
if (!('IntersectionObserver' in globalThis)) {
  class ObservadorQueNoObserva {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];

    observe(): void {
      // No hay desplazamiento que observar en una prueba.
    }

    unobserve(): void {
      // Nada que dejar de observar.
    }

    disconnect(): void {
      // Nada que desconectar.
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  // Se fuerza el tipo en vez de declarar `implements`. La interfaz real gana
  // campos cada tantas versiones de TypeScript —el ultimo fue `scrollMargin`—
  // y cada uno rompia esta linea sin que nada del doble tuviera que cambiar.
  globalThis.IntersectionObserver =
    ObservadorQueNoObserva as unknown as typeof IntersectionObserver;
}
