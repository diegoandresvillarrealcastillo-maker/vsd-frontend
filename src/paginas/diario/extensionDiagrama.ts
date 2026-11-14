import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { VistaDelDiagrama } from './VistaDelDiagrama.tsx';

/**
 * El nodo `diagrama` del documento: un bloque que solo lleva el `id` de su
 * escena. La escena va en los `adjuntos` de la anotacion, y el servidor la
 * guarda tal cual (SCRUM-95).
 *
 * Es atomico: el cursor lo salta entero y no se escribe dentro.
 */
export const Diagrama = Node.create({
  name: 'diagrama',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { id: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'div[data-diagrama]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-diagrama': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VistaDelDiagrama);
  },
});
