import { createContext } from 'react';

/**
 * Lo que el texto del editor necesita saber de los diagramas (SCRUM-96).
 *
 * El documento solo guarda donde va cada diagrama, con su `id`. La escena
 * vive aparte, en los `adjuntos` de la anotacion, y quien la tiene es el
 * editor. La tarjeta de cada diagrama dentro del texto la pide por aqui.
 */
export interface DiagramasDelEditor {
  /** Abre el editor de diagramas sobre ese diagrama. */
  readonly abrir: (id: string) => void;
}

export const DiagramasContexto = createContext<DiagramasDelEditor>({ abrir: () => undefined });

/** Los ids de los diagramas que siguen en el documento, en orden. */
export function idsDeDiagramas(nodo: {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly unknown[];
}): string[] {
  const propio =
    nodo.type === 'diagrama' && typeof nodo.attrs?.id === 'string' ? [nodo.attrs.id] : [];

  return [
    ...propio,
    ...(nodo.content ?? []).flatMap((hijo) => idsDeDiagramas(hijo as typeof nodo)),
  ];
}
