import type { CSSProperties, ReactNode } from 'react';

import type { NodoDelDocumento } from '../../infraestructura/api/diario.ts';
import { COLORES_PERMITIDOS, LETRAS_PERMITIDAS, TAMANOS_PERMITIDOS } from './formato.ts';

/**
 * Una anotacion para leer, en el historial (SCRUM-96).
 *
 * ## Por que no se usa el editor ni `innerHTML`
 *
 * Lo guardado es un arbol de nodos, y aqui cada nodo se convierte en un
 * elemento de React escrito a mano. El texto entra siempre como texto: si
 * alguien escribe `<img onerror=...>`, se lee eso, letra por letra, y no se
 * ejecuta nada. No hay ningun `innerHTML` ni `dangerouslySetInnerHTML` en el
 * camino, que es el criterio de la tarea.
 *
 * Un tipo de nodo que no se conoce no se pinta como tal: se pintan sus hijos,
 * para no perder el texto. Un color, una letra o un tamano fuera de la lista
 * de `formato.ts` se ignora.
 *
 * Tampoco se monta un editor por anotacion: con un mes de diario serian
 * decenas de editores para algo que solo se lee.
 */
export function DocumentoLeido({
  documento,
  alVerDiagrama,
}: {
  documento: NodoDelDocumento;
  /** Si no se pasa, los diagramas se anuncian pero no se abren. */
  alVerDiagrama?: (id: string) => void;
}) {
  return <div className="documento">{hijos(documento, alVerDiagrama)}</div>;
}

type AlVerDiagrama = ((id: string) => void) | undefined;

function hijos(nodo: NodoDelDocumento, alVerDiagrama: AlVerDiagrama): ReactNode[] {
  return (nodo.content ?? []).map((hijo, indice) => pintar(hijo, indice, alVerDiagrama));
}

function pintar(nodo: NodoDelDocumento, clave: number, alVerDiagrama: AlVerDiagrama): ReactNode {
  switch (nodo.type) {
    case 'text':
      return <Texto key={clave} nodo={nodo} />;
    case 'paragraph':
      return <p key={clave}>{hijos(nodo, alVerDiagrama)}</p>;
    case 'heading':
      // El titulo de la pagina y el del dia ya son h1 y h2.
      return nodo.attrs?.level === 2 ? (
        <h3 key={clave}>{hijos(nodo, alVerDiagrama)}</h3>
      ) : (
        <h4 key={clave}>{hijos(nodo, alVerDiagrama)}</h4>
      );
    case 'bulletList':
      return <ul key={clave}>{hijos(nodo, alVerDiagrama)}</ul>;
    case 'orderedList':
      return (
        <ol key={clave} start={numeroOIndefinido(nodo.attrs?.start)}>
          {hijos(nodo, alVerDiagrama)}
        </ol>
      );
    case 'listItem':
      return <li key={clave}>{hijos(nodo, alVerDiagrama)}</li>;
    case 'blockquote':
      return <blockquote key={clave}>{hijos(nodo, alVerDiagrama)}</blockquote>;
    case 'horizontalRule':
      return <hr key={clave} />;
    case 'hardBreak':
      return <br key={clave} />;
    case 'diagrama': {
      const id = typeof nodo.attrs?.id === 'string' ? nodo.attrs.id : undefined;

      return (
        <div key={clave} className="documento__diagrama">
          <span>Diagrama</span>
          {id !== undefined && alVerDiagrama !== undefined && (
            <button
              type="button"
              className="pildora pildora--fantasma"
              onClick={() => alVerDiagrama(id)}
            >
              Ver diagrama
            </button>
          )}
        </div>
      );
    }
    default:
      // Un tipo que no se conoce: su texto, sin su forma.
      return <span key={clave}>{hijos(nodo, alVerDiagrama)}</span>;
  }
}

function numeroOIndefinido(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : undefined;
}

/** Un trozo de texto con sus marcas, de dentro hacia fuera. */
function Texto({ nodo }: { nodo: NodoDelDocumento }) {
  let contenido: ReactNode = nodo.text ?? '';
  const estilo: CSSProperties = {};

  for (const marca of nodo.marks ?? []) {
    switch (marca.type) {
      case 'bold':
        contenido = <strong>{contenido}</strong>;
        break;
      case 'italic':
        contenido = <em>{contenido}</em>;
        break;
      case 'underline':
        contenido = <u>{contenido}</u>;
        break;
      case 'strike':
        contenido = <s>{contenido}</s>;
        break;
      case 'textStyle': {
        const { color, fontFamily, fontSize } = marca.attrs ?? {};

        if (typeof color === 'string' && COLORES_PERMITIDOS.has(color)) {
          estilo.color = color;
        }

        if (typeof fontFamily === 'string' && LETRAS_PERMITIDAS.has(fontFamily)) {
          estilo.fontFamily = fontFamily;
        }

        if (typeof fontSize === 'string' && TAMANOS_PERMITIDOS.has(fontSize)) {
          estilo.fontSize = fontSize;
        }

        break;
      }
      default:
        // Una marca desconocida no cambia nada.
        break;
    }
  }

  return Object.keys(estilo).length > 0 ? <span style={estilo}>{contenido}</span> : contenido;
}
