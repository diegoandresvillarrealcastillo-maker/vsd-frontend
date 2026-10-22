import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { BarraDeProgresoDeLaRacha } from './BarraDeProgresoDeLaRacha.tsx';

/**
 * La barra de progreso hacia el proximo hito (SCRUM-243).
 *
 * Parte del ultimo hito logrado y llega al siguiente, asi que a los 12 dias, entre el hito de 7 y el
 * de 14, va por el 71 %.
 */
describe('BarraDeProgresoDeLaRacha', () => {
  it('dice cuanto lleva, hacia donde va y cuanto falta', () => {
    render(<BarraDeProgresoDeLaRacha dias={12} hitoAnterior={7} proximoHito={14} />);

    const barra = screen.getByRole('progressbar', { name: 'Progreso hacia tu próximo hito' });

    expect(barra).toHaveAttribute('aria-valuemin', '7');
    expect(barra).toHaveAttribute('aria-valuemax', '14');
    expect(barra).toHaveAttribute('aria-valuenow', '12');
    expect(barra).toHaveAttribute('aria-valuetext', '12 de 14 días');
    expect(screen.getByText('Faltan 2 días')).toBeInTheDocument();
  });

  it('el relleno mide lo que avanzo entre un hito y el otro', () => {
    const { container } = render(
      <BarraDeProgresoDeLaRacha dias={12} hitoAnterior={7} proximoHito={14} />,
    );

    const relleno = container.querySelector<HTMLElement>('.racha-progreso__relleno');

    // (12 - 7) / (14 - 7) = 0,714...: se anima con `transform`, no con `width`.
    expect(relleno?.style.transform).toMatch(/^scaleX\(0\.71/);
  });

  it('un solo dia que falta se dice en singular', () => {
    render(<BarraDeProgresoDeLaRacha dias={13} hitoAnterior={7} proximoHito={14} />);

    expect(screen.getByText('Falta 1 día')).toBeInTheDocument();
  });

  it('sin ningun hito logrado parte de cero', () => {
    const { container } = render(
      <BarraDeProgresoDeLaRacha dias={1} hitoAnterior={0} proximoHito={3} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0');
    expect(
      container.querySelector<HTMLElement>('.racha-progreso__relleno')?.style.transform,
    ).toMatch(/^scaleX\(0\.33/);
  });

  it('nunca pasa del final ni baja del principio', () => {
    const { container, rerender } = render(
      <BarraDeProgresoDeLaRacha dias={20} hitoAnterior={7} proximoHito={14} />,
    );

    expect(container.querySelector<HTMLElement>('.racha-progreso__relleno')?.style.transform).toBe(
      'scaleX(1)',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '14');

    rerender(<BarraDeProgresoDeLaRacha dias={2} hitoAnterior={7} proximoHito={14} />);

    expect(container.querySelector<HTMLElement>('.racha-progreso__relleno')?.style.transform).toBe(
      'scaleX(0)',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
  });

  it('sin proximo hito (un servidor viejo) no se pinta', () => {
    const { container } = render(
      <BarraDeProgresoDeLaRacha dias={12} hitoAnterior={0} proximoHito={0} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('si el proximo hito no esta por delante del anterior, no se pinta: seria un dato roto', () => {
    const { container } = render(
      <BarraDeProgresoDeLaRacha dias={12} hitoAnterior={14} proximoHito={14} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('no tiene fallos de accesibilidad', async () => {
    render(<BarraDeProgresoDeLaRacha dias={12} hitoAnterior={7} proximoHito={14} />);

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
