import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { EscaleraDeHitos } from './EscaleraDeHitos.tsx';

/**
 * La escalera de hitos del panel (SCRUM-243): los que ya se lograron, iluminados, y los que siguen,
 * con candado y lo que cambia en cada uno.
 */
const ESCALERA = [
  { dias: 3, logrado: true },
  { dias: 7, logrado: true },
  { dias: 14, logrado: false },
  { dias: 30, logrado: false },
  { dias: 50, logrado: false },
];

describe('EscaleraDeHitos', () => {
  it('es una lista con nombre, con un elemento por hito', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} />);

    const lista = screen.getByRole('list', { name: 'Hitos de tu racha' });

    expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
  });

  it('los logrados dicen que ya se llego, sin genero', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} />);

    const logrados = screen
      .getAllByRole('listitem')
      .filter((hito) => hito.classList.contains('racha-escalera__hito--logrado'));

    expect(logrados).toHaveLength(2);
    expect(logrados[0]?.textContent).toContain('Primera chispa');
    expect(logrados[0]?.textContent).toContain('Ya llegaste');
    expect(logrados[1]?.textContent).toContain('Primera semana');
  });

  it('los que siguen dicen que cambia y se anuncian como por llegar', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} />);

    const pendientes = screen
      .getAllByRole('listitem')
      .filter((hito) => hito.classList.contains('racha-escalera__hito--por-lograr'));

    expect(pendientes).toHaveLength(3);
    expect(pendientes[0]?.textContent).toContain('Dos semanas');
    expect(pendientes[0]?.textContent).toContain('Dos barras que se unen y chispas que giran');
    expect(pendientes[0]?.textContent).toContain('Por llegar');
    expect(pendientes[1]?.textContent).toContain('Un mes');
  });

  it('cada hito dice cuantos dias pide', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} />);

    expect(screen.getAllByRole('listitem')[2]?.textContent).toContain('14 días');
  });

  it('sin escalera (un servidor viejo) no se pinta', () => {
    const { container } = render(<EscaleraDeHitos escalera={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('el texto nunca habla de perdida ni de castigo', () => {
    const { container } = render(<EscaleraDeHitos escalera={ESCALERA} />);

    expect(container.textContent).not.toMatch(/perdi|rompi|fall|apag|castig|error/iu);
  });

  it('no tiene fallos de accesibilidad', async () => {
    render(<EscaleraDeHitos escalera={ESCALERA} />);

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
