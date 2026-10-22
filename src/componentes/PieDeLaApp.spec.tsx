import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PieDeLaApp } from './PieDeLaApp.tsx';

function pintar() {
  return render(
    <MemoryRouter>
      <PieDeLaApp />
    </MemoryRouter>,
  );
}

describe('PieDeLaApp', () => {
  it('sigue diciendo lo que VSD Health no es y para quien es', () => {
    pintar();

    expect(screen.getByText(/no diagnostica, no formula medicamentos/)).toBeInTheDocument();
    expect(screen.getByText(/solo para mayores de 18 años/)).toBeInTheDocument();
  });

  it('dice que version de la aplicacion se esta usando (SCRUM-234)', () => {
    // «Hay una version nueva» no se ve si nadie puede decir cual tiene: con esto, una captura del panel basta.
    pintar();

    expect(
      screen.getByText(/^Versión (del \d{2}\/\d{2}\/\d{4}( · [0-9a-f]{7,})?|de desarrollo)$/),
    ).toBeInTheDocument();
  });

  it('la version es texto de la pagina, no un control: se puede seleccionar y copiar', () => {
    pintar();

    const version = screen.getByText(/^Versión /);

    expect(version.closest('button')).toBeNull();
    expect(version.closest('a')).toBeNull();
  });
});
