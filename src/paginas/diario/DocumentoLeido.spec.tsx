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
});
