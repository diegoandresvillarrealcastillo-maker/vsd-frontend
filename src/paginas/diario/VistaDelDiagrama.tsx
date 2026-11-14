import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useContext } from 'react';

import { DiagramasContexto } from './diagramas.ts';

/**
 * La tarjeta de un diagrama dentro del texto, mientras se escribe.
 *
 * No dibuja el diagrama: para eso haria falta cargar el editor de diagramas,
 * que pesa mucho, solo por tener uno en la anotacion. Se abre al pulsar.
 */
export function VistaDelDiagrama({ node, deleteNode }: NodeViewProps) {
  const { abrir } = useContext(DiagramasContexto);
  const id = typeof node.attrs.id === 'string' ? node.attrs.id : null;

  return (
    <NodeViewWrapper className="lienzo__diagrama" contentEditable={false}>
      <span className="lienzo__diagrama-nombre">Diagrama</span>
      {id !== null && (
        <button type="button" className="pildora pildora--fantasma" onClick={() => abrir(id)}>
          Editar diagrama
        </button>
      )}
      <button type="button" className="pildora pildora--fantasma" onClick={deleteNode}>
        Quitar
      </button>
    </NodeViewWrapper>
  );
}
