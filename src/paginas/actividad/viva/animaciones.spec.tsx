import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { LogroDeLaActividad } from '../LogroDeLaActividad.tsx';
import { BotonPrincipal } from './BarraDeAccion.tsx';
import { Contador } from './Contador.tsx';
import { FondoVivo } from './FondoVivo.tsx';
import { HeroeDeLaActividad } from './HeroeDeLaActividad.tsx';

/**
 * Los adornos que dan movimiento a las actividades (SCRUM-173): formas que flotan, flechas, un
 * reflejo en la cabecera, estrellitas en el logro y un numero que salta. Todos son decoracion:
 * lo que importa es que no estorben a un lector de pantalla y que no cambien lo que dice nadie.
 */
const usuario = userEvent.setup({ delay: null });

describe('FondoVivo', () => {
  it('pinta ocho formas que suben, todas decorativas', () => {
    const { container } = render(<FondoVivo modulo="bienestar" />);

    expect(container.querySelectorAll('.viva-fondo__flota')).toHaveLength(8);
    expect(container.querySelector('.viva-fondo')).toHaveAttribute('aria-hidden', 'true');
  });

  it('cada modulo flota con su propia forma: hojas, destellos o corazones', () => {
    const dibujo = (modulo: 'bienestar' | 'cognicion' | 'emociones' | undefined) =>
      render(<FondoVivo modulo={modulo} />).container.querySelector('.viva-fondo__flota svg')
        ?.innerHTML;

    const hojas = dibujo('bienestar');
    const destellos = dibujo('cognicion');
    const corazones = dibujo('emociones');

    expect(new Set([hojas, destellos, corazones]).size).toBe(3);
    // Sin modulo conocido flotan destellos, como en cognicion.
    expect(dibujo(undefined)).toBe(destellos);
  });

  it('las formas siempre estan en el mismo sitio: no dependen del azar', () => {
    const posiciones = () =>
      [...render(<FondoVivo modulo="emociones" />).container.querySelectorAll('.viva-fondo__flota')]
        .map((forma) => forma.getAttribute('style'))
        .join('|');

    expect(posiciones()).toBe(posiciones());
  });

  it('no aporta nada que leer', () => {
    const { container } = render(<FondoVivo modulo="cognicion" />);

    expect(container.textContent).toBe('');
  });
});

describe('BotonPrincipal con flecha', () => {
  it('la flecha es adorno: el nombre del boton sigue siendo solo su texto', () => {
    const { container } = render(<BotonPrincipal conFlecha>Continuar</BotonPrincipal>);

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    expect(container.querySelector('.viva-boton__flecha')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sin la peticion no lleva flecha', () => {
    const { container } = render(<BotonPrincipal>Terminar</BotonPrincipal>);

    expect(container.querySelector('.viva-boton__flecha')).toBeNull();
  });

  it('no tiene fallos de accesibilidad', async () => {
    const { container } = render(<BotonPrincipal conFlecha>Continuar</BotonPrincipal>);

    expect(await fallosDeAccesibilidad(container)).toEqual([]);
  });
});

describe('HeroeDeLaActividad, el reflejo', () => {
  it('lleva un reflejo decorativo que no se lee', () => {
    const { container } = render(
      <HeroeDeLaActividad modulo="bienestar" categoria="Bienestar" nombre="Algo" />,
    );

    expect(container.querySelector('.viva-heroe__brillo')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Contador, el numero que salta', () => {
  function Prueba() {
    const [valor, setValor] = useState(7);

    return <Contador etiqueta="Horas" valor={valor} alCambiar={setValor} minimo={0} maximo={12} />;
  }

  it('al abrir no salta, y salta cada vez que lo mueve un boton', async () => {
    const { container } = render(<Prueba />);

    expect(container.querySelector('.viva-contador__valor')).not.toHaveAttribute('data-pulso');

    await usuario.click(screen.getByRole('button', { name: 'Más: Horas' }));

    expect(container.querySelector('.viva-contador__valor')).toHaveAttribute('data-pulso');
  });

  it('teclear el numero no vuelve a montar el campo: no se pierde el foco', async () => {
    render(<Prueba />);

    const campo = screen.getByLabelText('Horas');

    await usuario.click(campo);
    await usuario.keyboard('{Backspace}5');

    expect(screen.getByLabelText('Horas')).toBe(campo);
    expect(campo).toHaveFocus();
  });
});

describe('LogroDeLaActividad, las estrellitas', () => {
  it('al celebrar suben siete estrellitas decorativas', () => {
    const { container } = render(<LogroDeLaActividad celebrar />);

    const estrellas = container.querySelectorAll('.viva-logro__estrella');

    expect(estrellas).toHaveLength(7);
    for (const estrella of estrellas) {
      expect(estrella).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('al acompanar no hay estrellitas: sale serena', () => {
    const { container } = render(<LogroDeLaActividad celebrar={false} />);

    expect(container.querySelectorAll('.viva-logro__estrella')).toHaveLength(0);
  });
});
