import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DiaDeLaSemana } from '../infraestructura/api/racha.ts';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { SEMANA_DE_PRUEBA } from '../pruebas/rachaDePrueba.ts';
import { SemanaDeLaRacha } from './SemanaDeLaRacha.tsx';

/**
 * La semana de la racha (SCRUM-243): siete dias, de lunes a domingo, cada uno con su estado.
 *
 * Lo que se dice con color tambien se dice con texto: cada dia lleva su nombre y su estado para quien
 * lee con un lector de pantalla.
 */

const MIERCOLES_SIN_HACER: readonly DiaDeLaSemana[] = [
  { dia: '2026-10-19', estado: 'hecho' },
  { dia: '2026-10-20', estado: 'hecho' },
  { dia: '2026-10-21', estado: 'hoy' },
  { dia: '2026-10-22', estado: 'futuro' },
  { dia: '2026-10-23', estado: 'futuro' },
  { dia: '2026-10-24', estado: 'futuro' },
  { dia: '2026-10-25', estado: 'futuro' },
];

describe('SemanaDeLaRacha', () => {
  it('son siete dias, de lunes a domingo, y la lista tiene nombre', () => {
    render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} />);

    const lista = screen.getByRole('list', { name: 'Tu semana' });

    expect(within(lista).getAllByRole('listitem')).toHaveLength(7);
    expect(lista.textContent).toContain('lunes: hecho');
    expect(lista.textContent).toContain('domingo: todavía no');
  });

  it('cada dia dice su estado con palabras', () => {
    render(
      <SemanaDeLaRacha
        semana={[
          { dia: '2026-10-19', estado: 'hecho' },
          { dia: '2026-10-20', estado: 'cubierto' },
          { dia: '2026-10-21', estado: 'hoy' },
          { dia: '2026-10-22', estado: 'sinActividad' },
          { dia: '2026-10-23', estado: 'futuro' },
          { dia: '2026-10-24', estado: 'futuro' },
          { dia: '2026-10-25', estado: 'futuro' },
        ]}
      />,
    );

    const dias = screen.getAllByRole('listitem').map((dia) => dia.textContent);

    expect(dias[0]).toContain('lunes: hecho');
    expect(dias[1]).toContain('martes: cubierto por un congelamiento');
    expect(dias[2]).toContain('miércoles: hoy');
    expect(dias[3]).toContain('jueves: sin actividad');
  });

  it('las letras de los dias son decorativas: lo que se anuncia es el texto', () => {
    const { container } = render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} />);

    const letras = container.querySelectorAll('.racha-semana__letra');

    expect(letras).toHaveLength(7);
    expect(letras[2]?.textContent).toBe('X');

    for (const letra of letras) {
      expect(letra).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('une con una barra los dias hechos que van seguidos', () => {
    const { container } = render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} />);

    // Lunes y martes estan hechos: una sola union. Martes y miercoles no, porque hoy aun no.
    expect(container.querySelectorAll('.racha-semana__dia--une')).toHaveLength(1);
  });

  it('una semana entera hecha tiene seis uniones', () => {
    const entera = SEMANA_DE_PRUEBA.map((dia) => ({ ...dia, estado: 'hecho' as const }));
    const { container } = render(<SemanaDeLaRacha semana={entera} />);

    expect(container.querySelectorAll('.racha-semana__dia--une')).toHaveLength(6);
  });

  it('un dia cubierto por un congelamiento tambien se une con sus vecinos', () => {
    const { container } = render(
      <SemanaDeLaRacha
        semana={[
          { dia: '2026-10-19', estado: 'hecho' },
          { dia: '2026-10-20', estado: 'cubierto' },
          { dia: '2026-10-21', estado: 'hecho' },
          ...SEMANA_DE_PRUEBA.slice(3),
        ]}
      />,
    );

    expect(container.querySelectorAll('.racha-semana__dia--une')).toHaveLength(2);
  });

  it('con `intensa` la lista lo marca para brillar mas', () => {
    render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} intensa />);

    expect(screen.getByRole('list', { name: 'Tu semana' })).toHaveClass('racha-semana--intensa');
  });

  it('sin `intensa` no lleva la marca', () => {
    render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} />);

    expect(screen.getByRole('list', { name: 'Tu semana' })).not.toHaveClass(
      'racha-semana--intensa',
    );
  });

  it('una semana que no son siete dias no se pinta: es un servidor viejo o un dato roto', () => {
    const { container } = render(<SemanaDeLaRacha semana={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('el texto nunca habla de perdida ni de castigo', () => {
    const { container } = render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} />);

    expect(container.textContent).not.toMatch(/perdi|rompi|fall|apag|castig|error|racha rota/iu);
  });

  it('no tiene fallos de accesibilidad', async () => {
    render(<SemanaDeLaRacha semana={MIERCOLES_SIN_HACER} />);

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
