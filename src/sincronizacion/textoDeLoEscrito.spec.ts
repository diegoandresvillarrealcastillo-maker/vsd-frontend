import { describe, expect, it } from 'vitest';

import type { NodoDelDocumento } from '../infraestructura/api/diario.ts';
import { nuevaOperacion, type Operacion, type TipoDeOperacion } from './cola.ts';
import { textoDeLoEscrito, textoDeUnDocumento } from './textoDeLoEscrito.ts';

const parrafo = (texto: string): NodoDelDocumento => ({
  type: 'paragraph',
  content: texto === '' ? [] : [{ type: 'text', text: texto }],
});

const doc = (...bloques: NodoDelDocumento[]): NodoDelDocumento => ({
  type: 'doc',
  content: bloques,
});

function operacion(tipo: TipoDeOperacion, payload: unknown): Operacion {
  return nuevaOperacion(
    { operationId: 'op-1', tipo, entidad: 'diario:1', payload },
    new Date('2026-10-08T10:00:00.000Z'),
  );
}

describe('textoDeUnDocumento (SCRUM-142)', () => {
  it('una linea por parrafo', () => {
    expect(textoDeUnDocumento(doc(parrafo('Primera'), parrafo('Segunda')))).toBe(
      'Primera\nSegunda',
    );
  });

  it('un parrafo con partes con formato es una sola linea', () => {
    const negrita: NodoDelDocumento = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hoy fue ' },
        { type: 'text', text: 'un buen', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' dia' },
      ],
    };

    expect(textoDeUnDocumento(doc(negrita))).toBe('Hoy fue un buen dia');
  });

  it('un salto de linea dentro de un parrafo se conserva', () => {
    const conSalto: NodoDelDocumento = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Uno' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Dos' },
      ],
    };

    expect(textoDeUnDocumento(doc(conSalto))).toBe('Uno\nDos');
  });

  it('un titulo es una linea', () => {
    const titulo: NodoDelDocumento = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Un titulo' }],
    };

    expect(textoDeUnDocumento(doc(titulo, parrafo('Y el texto')))).toBe('Un titulo\nY el texto');
  });

  it('un titulo con partes con formato sigue siendo una sola linea', () => {
    const titulo: NodoDelDocumento = {
      type: 'heading',
      attrs: { level: 1 },
      content: [
        { type: 'text', text: 'Un ' },
        { type: 'text', text: 'gran', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' dia' },
      ],
    };

    expect(textoDeUnDocumento(doc(titulo, parrafo('Y el texto')))).toBe('Un gran dia\nY el texto');
  });

  it('un bloque de codigo con partes con formato sigue siendo un solo bloque', () => {
    const codigo: NodoDelDocumento = {
      type: 'codeBlock',
      content: [
        { type: 'text', text: 'let ' },
        { type: 'text', text: 'x', marks: [{ type: 'code' }] },
        { type: 'text', text: ' = 1;' },
      ],
    };

    expect(textoDeUnDocumento(doc(parrafo('Antes'), codigo, parrafo('Despues')))).toBe(
      ['Antes', 'let x = 1;', 'Despues'].join('\n'),
    );
  });

  it('una lista da una linea por elemento', () => {
    const lista: NodoDelDocumento = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [parrafo('Pan')] },
        { type: 'listItem', content: [parrafo('Leche')] },
      ],
    };

    expect(textoDeUnDocumento(doc(parrafo('Comprar'), lista))).toBe('Comprar\nPan\nLeche');
  });

  it('una cita y un bloque de codigo tambien', () => {
    const cita: NodoDelDocumento = { type: 'blockquote', content: [parrafo('Una cita')] };
    const codigo: NodoDelDocumento = {
      type: 'codeBlock',
      content: [{ type: 'text', text: 'let x = 1;' }],
    };

    expect(textoDeUnDocumento(doc(cita, codigo))).toBe('Una cita\nlet x = 1;');
  });

  it('los parrafos vacios de los extremos no cuentan; los de en medio, si', () => {
    expect(
      textoDeUnDocumento(
        doc(parrafo(''), parrafo('Uno'), parrafo(''), parrafo('Dos'), parrafo('')),
      ),
    ).toBe('Uno\n\nDos');
  });

  it('un documento vacio es un texto vacio', () => {
    expect(textoDeUnDocumento(doc())).toBe('');
    expect(textoDeUnDocumento(doc(parrafo('')))).toBe('');
  });

  it('un nodo suelto con texto es ese texto', () => {
    expect(textoDeUnDocumento({ type: 'text', text: 'Solo' })).toBe('Solo');
  });
});

describe('textoDeLoEscrito', () => {
  it('el titulo y el texto de una anotacion nueva', () => {
    const escrito = textoDeLoEscrito(
      operacion('diario.escribir', {
        titulo: 'Un dia dificil',
        contenido: doc(parrafo('No pude dormir.'), parrafo('Me siento cansada.')),
      }),
    );

    expect(escrito).toEqual({
      texto: 'Un dia dificil\n\nNo pude dormir.\nMe siento cansada.',
      conDiagramas: false,
    });
  });

  it('sin titulo, solo el texto', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.escribir', { titulo: null, contenido: doc(parrafo('Hola')) }),
      ),
    ).toEqual({ texto: 'Hola', conDiagramas: false });
  });

  it('el titulo se recorta: los espacios de los lados no se copian', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.escribir', { titulo: '   Hoy   ', contenido: doc(parrafo('Texto')) }),
      ),
    ).toEqual({ texto: 'Hoy\n\nTexto', conDiagramas: false });
  });

  it('un contenido que no tiene la forma de un documento no se lee', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.escribir', {
          contenido: { content: [{ type: 'text', text: 'Suelto' }] },
        }),
      ),
    ).toBeNull();
  });

  it('un titulo en blanco no cuenta', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.escribir', { titulo: '   ', contenido: doc(parrafo('Hola')) }),
      ),
    ).toEqual({ texto: 'Hola', conDiagramas: false });
  });

  it('una correccion tambien: es lo que se queria escribir', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.editar', { id: 'a', contenido: doc(parrafo('Corregido')) }),
      ),
    ).toEqual({ texto: 'Corregido', conDiagramas: false });
  });

  it('solo un titulo nuevo, sin texto, es ese titulo', () => {
    expect(textoDeLoEscrito(operacion('diario.editar', { id: 'a', titulo: 'Nuevo' }))).toEqual({
      texto: 'Nuevo',
      conDiagramas: false,
    });
  });

  it('dice si lleva diagramas, que no se copian como texto', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.escribir', {
          contenido: doc(parrafo('Mira')),
          adjuntos: [{ tipo: 'diagrama', escena: {} }],
        }),
      ),
    ).toEqual({ texto: 'Mira', conDiagramas: true });
  });

  it('una lista de adjuntos vacia no son diagramas', () => {
    expect(
      textoDeLoEscrito(
        operacion('diario.escribir', { contenido: doc(parrafo('Mira')), adjuntos: [] }),
      ),
    ).toMatchObject({ conDiagramas: false });
  });

  it.each([
    ['sin nada escrito', { contenido: doc(parrafo('')) }],
    ['sin contenido ni titulo', {}],
    ['con un contenido que no es un documento', { contenido: 'texto' }],
    ['con un payload que no es un objeto', 'texto'],
    ['sin payload', null],
  ])('una anotacion %s no tiene nada que copiar', (_nombre, payload) => {
    expect(textoDeLoEscrito(operacion('diario.escribir', payload))).toBeNull();
  });

  it.each(['pendiente.crear', 'resultado.registrar', 'pendiente.editar'] as const)(
    '%s no es del diario: no se copia',
    (tipo) => {
      expect(
        textoDeLoEscrito(operacion(tipo, { texto: 'Algo', contenido: doc(parrafo('Algo')) })),
      ).toBeNull();
    },
  );
});
