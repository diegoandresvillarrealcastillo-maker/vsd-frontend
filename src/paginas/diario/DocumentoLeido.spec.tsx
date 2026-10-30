import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { NodoDelDocumento } from '../../infraestructura/api/diario.ts';
import { DocumentoLeido } from './DocumentoLeido.tsx';

function documento(...bloques: NodoDelDocumento[]): NodoDelDocumento {
  return { type: 'doc', content: bloques };
}

function parrafo(...trozos: NodoDelDocumento[]): NodoDelDocumento {
  return { type: 'paragraph', content: trozos };
}

function texto(contenido: string, marcas: NodoDelDocumento['marks'] = []): NodoDelDocumento {
  return { type: 'text', text: contenido, marks: marcas };
}

describe('DocumentoLeido', () => {
  it('pinta parrafos, titulos, listas y marcas', () => {
    const { container } = render(
      <DocumentoLeido
        documento={documento(
          { type: 'heading', attrs: { level: 2 }, content: [texto('Sábado')] },
          parrafo(texto('Salí a '), texto('caminar', [{ type: 'bold' }]), texto(' un rato')),
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [parrafo(texto('agua'))] }],
          },
        )}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sábado' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('caminar');
    expect(screen.getByRole('listitem')).toHaveTextContent('agua');
  });

  it('lo que parece HTML se lee como texto y no se ejecuta', () => {
    // El criterio de la tarea: nada se pinta con innerHTML.
    const { container } = render(
      <DocumentoLeido
        documento={documento(
          parrafo(texto('<img src=x onerror="alert(1)"><script>alert(2)</script>')),
        )}
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">');
  });

  it('solo deja pasar los colores, letras y tamanos de la paleta', () => {
    const { container } = render(
      <DocumentoLeido
        documento={documento(
          parrafo(
            texto('verde', [{ type: 'textStyle', attrs: { color: 'var(--tinta-verde)' } }]),
            texto('fuera', [
              {
                type: 'textStyle',
                attrs: { color: 'url(javascript:alert(1))', fontSize: '400px' },
              },
            ]),
          ),
        )}
      />,
    );

    const conEstilo = container.querySelectorAll('span[style]');

    expect(conEstilo).toHaveLength(1);
    expect(conEstilo[0]).toHaveTextContent('verde');
    expect(container).toHaveTextContent('fuera');
  });

  it('un tipo de nodo desconocido no pierde su texto', () => {
    render(
      <DocumentoLeido
        documento={documento({ type: 'callout', content: [parrafo(texto('sigue aqui'))] })}
      />,
    );

    expect(screen.getByText('sigue aqui')).toBeInTheDocument();
  });

  it('un diagrama se anuncia y se abre al pedirlo', async () => {
    const alVer = vi.fn();

    render(
      <DocumentoLeido
        documento={documento({ type: 'diagrama', attrs: { id: 'd-1' } })}
        alVerDiagrama={alVer}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Ver diagrama' }));

    expect(alVer).toHaveBeenCalledWith('d-1');
  });

  it('un diagrama sin quien lo abra, o sin identificador valido, se anuncia pero no ofrece abrirse', () => {
    render(
      <DocumentoLeido
        documento={documento(
          { type: 'diagrama', attrs: { id: 'd-1' } },
          { type: 'diagrama', attrs: { id: 7 } },
          { type: 'diagrama' },
        )}
      />,
    );

    expect(screen.getAllByText('Diagrama')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Ver diagrama' })).toBeNull();
  });

  it('con quien lo abra, un diagrama sin identificador de texto tampoco ofrece abrirse', () => {
    render(
      <DocumentoLeido
        documento={documento({ type: 'diagrama', attrs: { id: 7 } }, { type: 'diagrama' })}
        alVerDiagrama={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Diagrama')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ver diagrama' })).toBeNull();
  });

  describe('la forma de cada bloque', () => {
    it('los titulos de nivel 2 son h3 y los demas, h4 (el h1 y el h2 ya son de la pagina)', () => {
      render(
        <DocumentoLeido
          documento={documento(
            { type: 'heading', attrs: { level: 2 }, content: [texto('Grande')] },
            { type: 'heading', attrs: { level: 3 }, content: [texto('Mediano')] },
            { type: 'heading', content: [texto('Sin nivel')] },
          )}
        />,
      );

      expect(screen.getByRole('heading', { level: 3, name: 'Grande' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Mediano' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Sin nivel' })).toBeInTheDocument();
    });

    it('una lista numerada empieza donde dice, si es un entero', () => {
      const { container } = render(
        <DocumentoLeido
          documento={documento(
            {
              type: 'orderedList',
              attrs: { start: 3 },
              content: [{ type: 'listItem', content: [parrafo(texto('tercero'))] }],
            },
            {
              type: 'orderedList',
              attrs: { start: '9' },
              content: [{ type: 'listItem', content: [parrafo(texto('de texto'))] }],
            },
            {
              type: 'orderedList',
              attrs: { start: 1.5 },
              content: [{ type: 'listItem', content: [parrafo(texto('decimal'))] }],
            },
            {
              type: 'orderedList',
              content: [{ type: 'listItem', content: [parrafo(texto('sin inicio'))] }],
            },
          )}
        />,
      );

      const listas = container.querySelectorAll('ol');

      expect(listas[0]).toHaveAttribute('start', '3');
      expect(listas[1]).not.toHaveAttribute('start');
      expect(listas[2]).not.toHaveAttribute('start');
      expect(listas[3]).not.toHaveAttribute('start');
    });

    it('pinta citas, separadores y saltos de linea', () => {
      const { container } = render(
        <DocumentoLeido
          documento={documento(
            { type: 'blockquote', content: [parrafo(texto('una cita'))] },
            { type: 'horizontalRule' },
            parrafo(texto('arriba'), { type: 'hardBreak' }, texto('abajo')),
          )}
        />,
      );

      expect(container.querySelector('blockquote')).toHaveTextContent('una cita');
      expect(container.querySelector('hr')).not.toBeNull();
      expect(container.querySelector('p br')).not.toBeNull();
    });

    it('un documento o un bloque sin contenido no pinta nada ni se rompe', () => {
      const { container } = render(<DocumentoLeido documento={{ type: 'doc' }} />);

      expect(container.querySelector('.documento')).toBeEmptyDOMElement();
    });

    it('un texto sin contenido se pinta vacio', () => {
      const { container } = render(
        <DocumentoLeido documento={documento(parrafo({ type: 'text' }))} />,
      );

      expect(container.querySelector('p')).toBeEmptyDOMElement();
    });
  });

  describe('las marcas del texto', () => {
    it('cursiva, subrayado y tachado, cada una con su elemento', () => {
      const { container } = render(
        <DocumentoLeido
          documento={documento(
            parrafo(
              texto('inclinado', [{ type: 'italic' }]),
              texto('subrayado', [{ type: 'underline' }]),
              texto('tachado', [{ type: 'strike' }]),
            ),
          )}
        />,
      );

      expect(container.querySelector('em')).toHaveTextContent('inclinado');
      expect(container.querySelector('u')).toHaveTextContent('subrayado');
      expect(container.querySelector('s')).toHaveTextContent('tachado');
    });

    it('varias marcas se anidan de dentro hacia fuera', () => {
      const { container } = render(
        <DocumentoLeido
          documento={documento(parrafo(texto('ambas', [{ type: 'bold' }, { type: 'italic' }])))}
        />,
      );

      expect(container.querySelector('em > strong')).toHaveTextContent('ambas');
    });

    it('una marca que no se conoce no cambia nada', () => {
      const { container } = render(
        <DocumentoLeido documento={documento(parrafo(texto('igual', [{ type: 'highlight' }])))} />,
      );

      expect(container.querySelector('p')?.innerHTML).toBe('igual');
    });

    it('deja pasar la letra y el tamano de la paleta, y descarta los de fuera', () => {
      const { container } = render(
        <DocumentoLeido
          documento={documento(
            parrafo(
              texto('dentro', [
                {
                  type: 'textStyle',
                  attrs: {
                    color: 'var(--tinta-azul)',
                    fontFamily: 'var(--letra-diario-mono)',
                    fontSize: '1.25em',
                  },
                },
              ]),
              texto('fuera', [
                {
                  type: 'textStyle',
                  attrs: { fontFamily: 'Comic Sans MS', fontSize: '400px', color: 7 },
                },
              ]),
            ),
          )}
        />,
      );

      const conEstilo = container.querySelectorAll<HTMLElement>('span[style]');

      expect(conEstilo).toHaveLength(1);
      expect(conEstilo[0]?.style.color).toBe('var(--tinta-azul)');
      expect(conEstilo[0]?.style.fontFamily).toBe('var(--letra-diario-mono)');
      expect(conEstilo[0]?.style.fontSize).toBe('1.25em');
    });

    it('un color de fuera de la paleta se descarta del todo, sin dejar un span vacio', () => {
      // jsdom tira por su cuenta un color que no entiende, asi que lo que se comprueba es que
      // ni siquiera se llegue a pintar el contenedor del estilo.
      const { container } = render(
        <DocumentoLeido
          documento={documento(
            parrafo(
              texto('fuera', [{ type: 'textStyle', attrs: { color: 'url(javascript:alert(1))' } }]),
            ),
          )}
        />,
      );

      expect(container.querySelector('span')).toBeNull();
      expect(container.querySelector('p')).toHaveTextContent('fuera');
    });

    it('un estilo sin atributos no pinta un span vacio', () => {
      const { container } = render(
        <DocumentoLeido documento={documento(parrafo(texto('liso', [{ type: 'textStyle' }])))} />,
      );

      expect(container.querySelector('span')).toBeNull();
    });
  });
});
