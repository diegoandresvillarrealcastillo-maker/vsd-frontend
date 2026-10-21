import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Mascota } from '../infraestructura/api/cuenta.ts';
import type { Racha } from '../infraestructura/api/racha.ts';
import { sprite } from '../mascota/sprites.ts';
import { fallosDeAccesibilidad } from '../pruebas/axe.ts';
import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { CelebracionDeLaRacha } from './CelebracionDeLaRacha.tsx';
import type { MomentoDeLaRacha } from './momentoDeLaRacha.ts';

/**
 * La pantalla de celebracion de la racha (SCRUM-243).
 *
 * Es lo primero que ve la persona al terminar su primera actividad del dia, asi que se vigila lo que
 * no se puede romper sin que nadie lo note: que sea un dialogo de verdad (rol, nombre, foco y
 * Escape), que diga la verdad (el contador va de N-1 a N), que cada hito tenga su escena, y que la
 * mascota que se ve sea la elegida en la cuenta, con su cara de celebracion.
 */
const GATO: Mascota = { forma: 'gato', nombre: 'Ojo de Gato' };

const usuario = userEvent.setup({ delay: null });

function pintar(
  momento: MomentoDeLaRacha,
  racha: Racha,
  { alCerrar = vi.fn(), mascota = GATO }: { alCerrar?: () => void; mascota?: Mascota | null } = {},
) {
  const resultado = render(
    <div className="actividad">
      <CelebracionDeLaRacha momento={momento} racha={racha} mascota={mascota} alCerrar={alCerrar} />
    </div>,
  );

  return { ...resultado, alCerrar };
}

describe('CelebracionDeLaRacha', () => {
  describe('es un dialogo', () => {
    it('tiene rol de dialogo, es modal y su nombre dice los dias seguidos', () => {
      pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 12 }));

      const dialogo = screen.getByRole('dialog', { name: '¡12 días seguidos!' });

      expect(dialogo).toHaveAttribute('aria-modal', 'true');
    });

    it('con un solo dia lo dice en singular', () => {
      pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 1 }));

      expect(screen.getByRole('dialog', { name: '¡1 día seguido!' })).toBeInTheDocument();
    });

    it('en un hito, el nombre dice los dias y como se llama el hito', () => {
      pintar({ tipo: 'hito', hito: 14 }, rachaDePrueba({ dias: 14 }));

      expect(screen.getByRole('dialog', { name: '¡14 días! Dos semanas' })).toBeInTheDocument();
    });

    it('el foco va al boton «Seguir»', () => {
      pintar({ tipo: 'dia' }, rachaDePrueba());

      expect(screen.getByRole('button', { name: 'Seguir' })).toHaveFocus();
    });

    it('el boton cierra', async () => {
      const { alCerrar } = pintar({ tipo: 'dia' }, rachaDePrueba());

      await usuario.click(screen.getByRole('button', { name: 'Seguir' }));

      expect(alCerrar).toHaveBeenCalledTimes(1);
    });

    it('Escape cierra', async () => {
      const { alCerrar } = pintar({ tipo: 'dia' }, rachaDePrueba());

      await usuario.keyboard('{Escape}');

      expect(alCerrar).toHaveBeenCalledTimes(1);
    });

    it('Tab no saca el foco del dialogo: el boton es lo unico que se puede tocar', async () => {
      pintar({ tipo: 'dia' }, rachaDePrueba());

      await usuario.tab();

      expect(screen.getByRole('button', { name: 'Seguir' })).toHaveFocus();
    });

    it('nada se cierra solo: sin tocar nada el dialogo sigue ahi', async () => {
      vi.useFakeTimers();

      try {
        const { alCerrar } = pintar({ tipo: 'dia' }, rachaDePrueba());

        await vi.advanceTimersByTimeAsync(60_000);

        expect(alCerrar).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('dice la verdad', () => {
    it('el contador va de un dia menos a los dias de ahora', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 12 }));

      expect(container.querySelector('.racha-celebracion__cifra-vieja')?.textContent).toBe('11');
      expect(container.querySelector('.racha-celebracion__cifra-nueva')?.textContent).toBe('12');
    });

    it('las cifras son decorativas: lo que se anuncia es el titulo', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 12 }));

      expect(container.querySelector('.racha-celebracion__cifra')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('el primer dia parte de cero', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 1 }));

      expect(container.querySelector('.racha-celebracion__cifra-vieja')?.textContent).toBe('0');
      expect(container.querySelector('.racha-celebracion__cifra-nueva')?.textContent).toBe('1');
    });

    it('muestra la semana con los dias que manda el servidor', () => {
      pintar({ tipo: 'dia' }, rachaDePrueba());

      expect(screen.getByRole('list', { name: 'Tu semana' })).toBeInTheDocument();
    });

    it('sin semana (un servidor viejo) la celebracion sale igual, sin la fila', () => {
      pintar({ tipo: 'dia' }, rachaDePrueba({ semana: [] }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Tu semana' })).not.toBeInTheDocument();
    });
  });

  describe('la mascota', () => {
    it('es la de la cuenta, con su cara de celebracion', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba());

      const imagen = container.querySelector('.viva-voz__cara img');

      expect(imagen?.getAttribute('src')).toBe(sprite('gato', 'celebrando'));
    });

    it('sin mascota guardada, es la de siempre', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba(), { mascota: null });

      expect(container.querySelector('.viva-voz__cara img')?.getAttribute('src')).toBe(
        sprite('fungito', 'celebrando'),
      );
    });

    it('dice una frase de la racha, con los numeros de verdad', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 20 }));

      // A 20 dias el proximo hito esta lejos: no es «cerca del hito», es un dia normal.
      expect(container.querySelector('.viva-voz__globo')?.textContent).toContain('20 días');
    });

    it('cuando el hito esta cerca, dice cuanto falta', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 12 }));

      const frase = container.querySelector('.viva-voz__globo')?.textContent ?? '';

      expect(frase).toMatch(/2 días/);
      expect(frase).toMatch(/14/);
    });

    it('el primer dia usa una frase de comienzo', () => {
      const { container } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 1 }));

      expect(container.querySelector('.viva-voz__globo')?.textContent).not.toMatch(/\{|\}/);
      expect(container.querySelector('.viva-voz__globo')?.textContent?.length).toBeGreaterThan(10);
    });

    it('en un hito dice la frase del hito', () => {
      const { container } = pintar({ tipo: 'hito', hito: 14 }, rachaDePrueba({ dias: 14 }));

      expect(container.querySelector('.viva-voz__globo')?.textContent).toMatch(/dos semanas/i);
    });
  });

  describe('cada hito tiene su escena', () => {
    /** Los adornos que suma cada escena, de la mas sencilla a la mas rica: cada una suma a la anterior. */
    const ADORNOS = {
      confeti: '.confeti',
      orbita: '.racha-celebracion__orbita',
      rayos: '.racha-celebracion__rayos',
      halo: '.racha-celebracion__halo',
      fuegos: '.racha-celebracion__fuegos',
      lluvia: '.racha-celebracion__lluvia',
      estrella: '.racha-celebracion__estrella',
    } as const;

    type Adorno = keyof typeof ADORNOS;

    it.each<[string, MomentoDeLaRacha, number, string, Adorno[]]>([
      ['un dia normal', { tipo: 'dia' }, 12, 'dia', []],
      ['3 dias', { tipo: 'hito', hito: 3 }, 3, 'chispa', []],
      ['7 dias', { tipo: 'hito', hito: 7 }, 7, 'semana', ['confeti']],
      ['14 dias', { tipo: 'hito', hito: 14 }, 14, 'dosSemanas', ['confeti', 'orbita']],
      ['30 dias', { tipo: 'hito', hito: 30 }, 30, 'mes', ['confeti', 'orbita', 'rayos']],
      [
        '50 dias',
        { tipo: 'hito', hito: 50 },
        50,
        'cincuenta',
        ['confeti', 'orbita', 'rayos', 'halo'],
      ],
      [
        '100 dias',
        { tipo: 'hito', hito: 100 },
        100,
        'cien',
        ['confeti', 'orbita', 'rayos', 'halo', 'fuegos'],
      ],
      [
        '200 dias',
        { tipo: 'hito', hito: 200 },
        200,
        'doscientos',
        ['confeti', 'orbita', 'rayos', 'halo', 'fuegos', 'lluvia'],
      ],
      [
        '365 dias',
        { tipo: 'hito', hito: 365 },
        365,
        'ano',
        ['confeti', 'orbita', 'rayos', 'halo', 'fuegos', 'lluvia', 'estrella'],
      ],
      [
        '730 dias',
        { tipo: 'hito', hito: 730 },
        730,
        'ano',
        ['confeti', 'orbita', 'rayos', 'halo', 'fuegos', 'lluvia', 'estrella'],
      ],
    ])('%s: la escena y sus adornos', (_nombre, momento, dias, escena, esperados) => {
      const { container } = pintar(momento, rachaDePrueba({ dias }));

      expect(screen.getByRole('dialog')).toHaveAttribute('data-escena', escena);

      for (const [adorno, selector] of Object.entries(ADORNOS)) {
        const hay = container.querySelector(selector) !== null;

        expect(hay, `${adorno} en ${escena}`).toBe(esperados.includes(adorno as Adorno));
      }
    });

    it('desde la semana, la cadena de la semana brilla mas', () => {
      pintar({ tipo: 'hito', hito: 7 }, rachaDePrueba({ dias: 7 }));

      expect(screen.getByRole('list', { name: 'Tu semana' })).toHaveClass('racha-semana--intensa');
    });

    it('un dia normal no brilla de mas', () => {
      pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 12 }));

      expect(screen.getByRole('list', { name: 'Tu semana' })).not.toHaveClass(
        'racha-semana--intensa',
      );
    });

    it('la llama se pinta con el nivel de la racha, y al menos como llama encendida', () => {
      const { container, rerender } = pintar({ tipo: 'dia' }, rachaDePrueba({ dias: 3, nivel: 0 }));

      // Con menos de 7 dias la barra muestra un ascua; la celebracion la enciende.
      expect(container.querySelector('.llama--nivel-1')).not.toBeNull();

      rerender(
        <div className="actividad">
          <CelebracionDeLaRacha
            momento={{ tipo: 'hito', hito: 100 }}
            racha={rachaDePrueba({ dias: 100, nivel: 3 })}
            mascota={GATO}
            alCerrar={vi.fn()}
          />
        </div>,
      );

      expect(container.querySelector('.llama--nivel-3')).not.toBeNull();
    });
  });

  describe('el tono', () => {
    it.each<[string, MomentoDeLaRacha, Racha]>([
      ['un dia', { tipo: 'dia' }, rachaDePrueba({ dias: 12 })],
      ['el primer dia', { tipo: 'dia' }, rachaDePrueba({ dias: 1 })],
      ['un hito', { tipo: 'hito', hito: 14 }, rachaDePrueba({ dias: 14 })],
      ['un aniversario', { tipo: 'hito', hito: 730 }, rachaDePrueba({ dias: 730, nivel: 4 })],
    ])('nunca habla de perdida ni de castigo: %s', (_nombre, momento, racha) => {
      const { container } = pintar(momento, racha);

      expect(container.textContent).not.toMatch(/perdi|rompi|fall|apag|castig|error|racha rota/iu);
    });
  });

  it('no tiene fallos de accesibilidad', async () => {
    pintar({ tipo: 'hito', hito: 14 }, rachaDePrueba({ dias: 14 }));

    expect(await fallosDeAccesibilidad()).toEqual([]);
  });
});
