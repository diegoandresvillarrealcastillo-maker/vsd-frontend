import { createContext } from 'react';

import type { Decision } from './consentimiento.ts';

/**
 * Lo que el resto de la aplicacion puede saber y hacer con la analitica
 * (SCRUM-161). Nada de aqui da acceso a Google: eso es de `ga4.ts`, y solo
 * `ProveedorDeAnalitica` lo llama.
 */
export interface EstadoDeAnalitica {
  /**
   * El identificador de medicion de este ambiente, o `null` si no hay. Es publico
   * por diseno (va en cada pagina que mide); los documentos legales lo usan para
   * nombrar la cookie `_ga_…` de verdad.
   */
  readonly idDeMedicion: string | null;

  /**
   * Si en este ambiente existe la analitica: hay identificador de medicion.
   * Sin ella no hay banner, ni opcion en los pies, ni nada que decir en la pagina
   * de cookies.
   */
  readonly disponible: boolean;

  /** Lo que la persona eligio, o `null` si todavia no ha elegido. */
  readonly decision: Decision | null;

  /** Si el banner tiene que verse: no ha elegido, o pidio cambiar de idea. */
  readonly preguntando: boolean;

  readonly aceptar: () => void;
  readonly rechazar: () => void;

  /**
   * Vuelve a mostrar el banner, desde un pie o desde la pagina de cookies. Al
   * cerrarse devuelve el foco a lo que lo abrio, para que quien navega con teclado
   * no se quede sin sitio.
   */
  readonly preguntarDeNuevo: () => void;

  /** Cierra el banner reabierto sin cambiar lo elegido. */
  readonly cerrar: () => void;
}

/**
 * Sin proveedor, la analitica no existe. Es lo que ven las pruebas que no hablan
 * de ella, y lo que hace que ningun componente falle por usarla fuera de
 * `ProveedorDeAnalitica`: lo seguro es no medir.
 */
export const AnaliticaContexto = createContext<EstadoDeAnalitica>({
  idDeMedicion: null,
  disponible: false,
  decision: null,
  preguntando: false,
  aceptar: () => undefined,
  rechazar: () => undefined,
  preguntarDeNuevo: () => undefined,
  cerrar: () => undefined,
});
