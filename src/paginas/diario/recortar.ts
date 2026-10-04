import type { NodoDelDocumento } from '../../infraestructura/api/diario.ts';

function esParrafoVacio(nodo: NodoDelDocumento): boolean {
  return nodo.type === 'paragraph' && (nodo.content ?? []).length === 0;
}

/**
 * Quita los parrafos vacios del principio y del final del documento.
 *
 * Un Enter de mas al terminar, o una linea en blanco antes de empezar, no son
 * parte de lo escrito, y en el historial se verian como un hueco. Los de en
 * medio se respetan: ahi si pueden ser una pausa a proposito.
 */
export function recortarDocumento(documento: NodoDelDocumento): NodoDelDocumento {
  const bloques = [...(documento.content ?? [])];

  while (bloques.length > 0 && esParrafoVacio(bloques[0]!)) {
    bloques.shift();
  }

  while (bloques.length > 0 && esParrafoVacio(bloques[bloques.length - 1]!)) {
    bloques.pop();
  }

  return { ...documento, content: bloques };
}
