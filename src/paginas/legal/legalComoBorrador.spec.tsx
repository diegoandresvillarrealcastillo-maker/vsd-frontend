import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RUTAS } from '../../rutas/rutas.ts';
import { PaginaLegal } from './PaginaLegal.tsx';

/**
 * El candado sigue funcionando aunque hoy no se use (SCRUM-235).
 *
 * Los textos estan cerrados y `TEXTOS_REVISADOS` es `true`. Pero el dia que se redacte una
 * version nueva con algo por completar, la bandera vuelve a `false` y la pagina tiene que
 * volver a decir, arriba y sin que se pueda pasar por alto, que no es el documento vigente.
 * Aqui se simula ese dia.
 */
vi.mock('./datosLegales.ts', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('./datosLegales.ts')>()),
  TEXTOS_REVISADOS: false,
}));

describe('Cuando un texto vuelve a ser un borrador', () => {
  it('la pagina lo dice arriba y no se presenta como vigente', async () => {
    const { FECHA_DE_ACTUALIZACION } = await import('./datosLegales.ts');

    const { container } = render(
      <MemoryRouter>
        <PaginaLegal
          ruta={RUTAS.PRIVACIDAD}
          titulo="Aviso de privacidad"
          entradilla="Una entradilla."
          version="2099-01-1"
          secciones={[{ id: 'uno', titulo: 'Uno', cuerpo: <p>Texto.</p> }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('note')).toHaveTextContent(/borrador pendiente de revisión jurídica/i);
    expect(container.querySelector('.legal__meta')).toHaveTextContent(
      `Versión 2099-01-1 · Borrador del ${FECHA_DE_ACTUALIZACION}`,
    );
    expect(container.querySelector('.legal__meta')).not.toHaveTextContent(/vigente/i);
  });
});
