import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RUTAS } from '../rutas/rutas.ts';
import { AvisoOrientativo, TEXTO_DEL_AVISO_ORIENTATIVO } from './AvisoOrientativo.tsx';
import { PieDeLaApp } from './PieDeLaApp.tsx';

/**
 * Los avisos de que VSD Health no diagnostica, dentro de la aplicacion (L-03 de la
 * auditoria 360). El aviso de la portada se ve una vez, antes de entrar; estos son
 * los que acompanan a quien la usa cada dia.
 */
describe('AvisoOrientativo', () => {
  it('es siempre la misma frase, corta', () => {
    render(<AvisoOrientativo />);

    expect(screen.getByText(TEXTO_DEL_AVISO_ORIENTATIVO)).toBeInTheDocument();
    expect(TEXTO_DEL_AVISO_ORIENTATIVO).toBe(
      'Orientativo. No es un diagnóstico ni reemplaza a un profesional.',
    );
    expect(TEXTO_DEL_AVISO_ORIENTATIVO.length).toBeLessThan(80);
  });

  it('admite una clase extra sin perder la suya', () => {
    render(<AvisoOrientativo className="extra" />);

    expect(screen.getByText(TEXTO_DEL_AVISO_ORIENTATIVO)).toHaveClass('aviso-orientativo', 'extra');
  });
});

describe('PieDeLaApp', () => {
  function pintar() {
    return render(
      <MemoryRouter>
        <PieDeLaApp />
      </MemoryRouter>,
    );
  }

  it('dice lo que VSD Health no es y para quien es', () => {
    pintar();

    const pie = screen.getByRole('contentinfo');

    expect(pie).toHaveTextContent('VSD Health no diagnostica, no formula medicamentos');
    expect(pie).toHaveTextContent('no reemplaza a un especialista médico');
    expect(pie).toHaveTextContent('Es solo para mayores de 18 años');
  });

  it('lleva a los tres documentos, sin recargar la pagina', () => {
    pintar();

    const documentos = screen.getByRole('navigation', { name: 'Documentos legales' });

    expect(within(documentos).getByRole('link', { name: 'Privacidad' })).toHaveAttribute(
      'href',
      RUTAS.PRIVACIDAD,
    );
    expect(within(documentos).getByRole('link', { name: 'Términos' })).toHaveAttribute(
      'href',
      RUTAS.TERMINOS,
    );
    expect(within(documentos).getByRole('link', { name: 'Cookies' })).toHaveAttribute(
      'href',
      RUTAS.COOKIES,
    );
  });
});
