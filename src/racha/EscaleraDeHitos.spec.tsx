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

  it('con destacarElPrimero, solo el primero por lograr se marca como el siguiente, y se anuncia', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} destacarElPrimero />);

    const siguientes = screen
      .getAllByRole('listitem')
      .filter((hito) => hito.classList.contains('racha-escalera__hito--siguiente'));

    expect(siguientes).toHaveLength(1);
    expect(siguientes[0]?.textContent).toContain('Dos semanas');
    expect(siguientes[0]?.textContent).toContain('Es el siguiente.');
    // Ningun otro lo dice: el resto sigue siendo «por llegar».
    expect(screen.getAllByText(/Es el siguiente\./)).toHaveLength(1);
  });

  it('sin pedirlo, ninguno se destaca (lo logrado no tiene siguiente)', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} />);

    expect(document.querySelector('.racha-escalera__hito--siguiente')).toBeNull();
    expect(screen.queryByText(/Es el siguiente\./)).not.toBeInTheDocument();
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

  it('la lista puede llevar otro nombre, para cuando hay dos en la misma pantalla', () => {
    render(<EscaleraDeHitos escalera={ESCALERA} nombre="Próximos hitos" />);

    expect(screen.getByRole('list', { name: 'Próximos hitos' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Hitos de tu racha' })).not.toBeInTheDocument();
  });

  it('un nombre que ya dice los dias no los repite: «Cien días», no «Cien días · 100 días»', () => {
    render(
      <EscaleraDeHitos
        escalera={[
          { dias: 50, logrado: false },
          { dias: 100, logrado: false },
          { dias: 200, logrado: false },
        ]}
      />,
    );

    const hitos = screen.getAllByRole('listitem');

    expect(hitos[0]?.textContent).toContain('Cincuenta días');
    expect(hitos[0]?.textContent).not.toContain('50 días');
    expect(hitos[1]?.textContent).not.toContain('100 días');
    expect(hitos[2]?.textContent).not.toContain('200 días');
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
