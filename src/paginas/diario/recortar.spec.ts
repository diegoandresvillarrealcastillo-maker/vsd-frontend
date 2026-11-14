import { describe, expect, it } from 'vitest';

import { recortarDocumento } from './recortar.ts';

const VACIO = { type: 'paragraph' };
const TEXTO = { type: 'paragraph', content: [{ type: 'text', text: 'hola' }] };

describe('recortarDocumento', () => {
  it('quita los parrafos vacios de los bordes y respeta los de en medio', () => {
    expect(
      recortarDocumento({ type: 'doc', content: [VACIO, TEXTO, VACIO, TEXTO, VACIO, VACIO] }),
    ).toEqual({ type: 'doc', content: [TEXTO, VACIO, TEXTO] });
  });

  it('un documento sin nada queda sin bloques', () => {
    expect(recortarDocumento({ type: 'doc', content: [VACIO] })).toEqual({
      type: 'doc',
      content: [],
    });
  });
});
