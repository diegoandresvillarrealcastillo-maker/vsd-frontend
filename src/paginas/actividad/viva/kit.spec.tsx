import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fallosDeAccesibilidad } from '../../../pruebas/axe.ts';
import { BarraDeAccion, BotonPrincipal, BotonSecundario } from './BarraDeAccion.tsx';
import { BarraDeProgreso } from './BarraDeProgreso.tsx';
import { Chispas } from './Chispas.tsx';
import { Contador } from './Contador.tsx';
import { FondoVivo } from './FondoVivo.tsx';
import { HeroeDeLaActividad } from './HeroeDeLaActividad.tsx';
import { OpcionGrande } from './OpcionGrande.tsx';
import { PasoAnimado } from './PasoAnimado.tsx';
import { PasosDeInicio } from './PasosDeInicio.tsx';
import { VozDeLaMascota } from './VozDeLaMascota.tsx';

/**
 * El kit de las actividades vivas (SCRUM-173): lo que comparten todas para que sean faciles de
 * hacer. Cada pieza se prueba por lo que promete a quien la usa, no por como esta hecha.
 */
const usuario = userEvent.setup({ delay: null });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BarraDeProgreso', () => {
  it('es una barra de progreso con lo hecho y el total, y dice en que paso va', () => {
    render(<BarraDeProgreso paso={2} total={5} hechos={1} etiqueta="Pregunta" />);

    const barra = screen.getByRole('progressbar', { name: 'Avance de la actividad' });

    expect(barra).toHaveAttribute('aria-valuenow', '1');
    expect(barra).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('Pregunta 2 de 5')).toBeInTheDocument();
  });

  it('nunca dice un paso mayor que el total', () => {
    render(<BarraDeProgreso paso={9} total={3} hechos={3} />);

    expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument();
  });

  it('marca una rayita entre pasos, una menos que el total', () => {
    const { container } = render(<BarraDeProgreso paso={1} total={5} hechos={0} />);

    expect(container.querySelectorAll('.viva-progreso__corte')).toHaveLength(4);
  });

  it('con muchos pasos no marca rayitas: serian ruido', () => {
    const { container } = render(<BarraDeProgreso paso={1} total={15} hechos={0} />);

    expect(container.querySelectorAll('.viva-progreso__corte')).toHaveLength(0);
  });

  it('las estrellas cuentan lo hecho, o lo que se les pase', () => {
    const { container, rerender } = render(<BarraDeProgreso paso={2} total={5} hechos={2} />);

    expect(container.querySelector('.viva-progreso__cuenta')).toHaveAttribute('data-n', '2');

    rerender(<BarraDeProgreso paso={2} total={5} hechos={2} estrellas={1} />);

    expect(container.querySelector('.viva-progreso__cuenta')).toHaveAttribute('data-n', '1');
  });

  it('las estrellas son adorno: no las lee un lector de pantalla', () => {
    const { container } = render(<BarraDeProgreso paso={1} total={3} hechos={1} />);

    expect(container.querySelector('.viva-progreso__estrellas')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('con total cero no se rompe', () => {
    render(<BarraDeProgreso paso={0} total={0} hechos={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '0');
  });
});

describe('OpcionGrande', () => {
  function Prueba({ tipo }: { tipo: 'radio' | 'checkbox' }) {
    const [marcada, setMarcada] = useState(false);

    return (
      <OpcionGrande
        tipo={tipo}
        nombre="cosa"
        valor="a"
        marcada={marcada}
        alCambiar={() => setMarcada((antes) => !antes)}
        texto="Una cosa"
        adorno="🙂"
      />
    );
  }

  it('es un radio de verdad, con su nombre', async () => {
    render(<Prueba tipo="radio" />);

    const radio = screen.getByRole('radio', { name: 'Una cosa' });

    expect(radio).not.toBeChecked();

    await usuario.click(radio);

    expect(radio).toBeChecked();
  });

  it('o una casilla de verdad', async () => {
    render(<Prueba tipo="checkbox" />);

    await usuario.click(screen.getByRole('checkbox', { name: 'Una cosa' }));

    expect(screen.getByRole('checkbox', { name: 'Una cosa' })).toBeChecked();
  });

  it('al marcarla se pinta del color del modulo, abre un aro y suelta chispas', async () => {
    const { container } = render(<Prueba tipo="radio" />);

    expect(container.querySelector('.viva-opcion--marcada')).toBeNull();
    expect(container.querySelector('.viva-chispas')).toBeNull();

    await usuario.click(screen.getByRole('radio'));

    expect(container.querySelector('.viva-opcion--marcada')).not.toBeNull();
    expect(container.querySelector('.viva-opcion__onda')).not.toBeNull();
    expect(container.querySelector('.viva-chispas')).not.toBeNull();
  });

  it('el adorno es decorativo: el nombre accesible es solo el texto', () => {
    render(<Prueba tipo="radio" />);

    expect(screen.getByRole('radio')).toHaveAccessibleName('Una cosa');
  });

  it('vibra al elegir, donde el telefono lo permite', async () => {
    const vibrar = vi.fn();
    const original = window.matchMedia;

    Object.defineProperty(navigator, 'vibrate', { value: vibrar, configurable: true });
    window.matchMedia = () => ({ matches: false }) as MediaQueryList;

    try {
      render(<Prueba tipo="radio" />);
      await usuario.click(screen.getByRole('radio'));

      expect(vibrar).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = original;
      Reflect.deleteProperty(navigator, 'vibrate');
    }
  });

  it('no falla donde no hay vibracion', async () => {
    Reflect.deleteProperty(navigator, 'vibrate');

    render(<Prueba tipo="radio" />);
    await usuario.click(screen.getByRole('radio'));

    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('una opcion deshabilitada no se puede elegir', () => {
    render(
      <OpcionGrande
        tipo="radio"
        nombre="x"
        valor="a"
        marcada={false}
        alCambiar={() => undefined}
        texto="No disponible"
        deshabilitada
      />,
    );

    expect(screen.getByRole('radio')).toBeDisabled();
  });
});

describe('Contador', () => {
  function Prueba({ inicial = 7 }: { inicial?: number }) {
    const [valor, setValor] = useState(inicial);

    return (
      <Contador
        etiqueta="Horas"
        valor={valor}
        alCambiar={setValor}
        minimo={0}
        maximo={12}
        paso={0.5}
        unidad="h"
      />
    );
  }

  it('el campo sigue siendo un numero de verdad, con su etiqueta', () => {
    render(<Prueba />);

    expect(screen.getByLabelText('Horas')).toHaveValue(7);
  });

  it('el mas y el menos mueven de a un paso', async () => {
    render(<Prueba />);

    await usuario.click(screen.getByRole('button', { name: 'Más: Horas' }));
    expect(screen.getByLabelText('Horas')).toHaveValue(7.5);

    await usuario.click(screen.getByRole('button', { name: 'Menos: Horas' }));
    await usuario.click(screen.getByRole('button', { name: 'Menos: Horas' }));
    expect(screen.getByLabelText('Horas')).toHaveValue(6.5);
  });

  it('en el minimo no deja bajar, pero si subir', () => {
    render(<Prueba inicial={0} />);

    expect(screen.getByRole('button', { name: 'Menos: Horas' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Más: Horas' })).toBeEnabled();
  });

  it('en el maximo no deja subir', () => {
    render(<Prueba inicial={12} />);

    expect(screen.getByRole('button', { name: 'Más: Horas' })).toBeDisabled();
  });

  it('se puede teclear el numero', async () => {
    render(<Prueba />);

    const campo = screen.getByLabelText('Horas');

    await usuario.clear(campo);
    await usuario.type(campo, '9');

    expect(campo).toHaveValue(9);
  });
});

describe('VozDeLaMascota', () => {
  it('dice el mensaje, y una segunda linea si la hay', () => {
    render(<VozDeLaMascota mascota={null} mensaje="Hola, aqui estoy." ademas="Con calma." />);

    expect(screen.getByText('Hola, aqui estoy.')).toBeInTheDocument();
    expect(screen.getByText('Con calma.')).toBeInTheDocument();
  });

  it('se anuncia sin interrumpir, salvo que se pida lo contrario', () => {
    const { container, rerender } = render(<VozDeLaMascota mascota={null} mensaje="Hola" />);

    expect(container.querySelector('.viva-voz__globo')).toHaveAttribute('aria-live', 'polite');

    rerender(<VozDeLaMascota mascota={null} mensaje="Hola" anunciar={false} />);

    expect(container.querySelector('.viva-voz__globo')).not.toHaveAttribute('aria-live');
  });

  it('el texto nuevo aparece enseguida, sin esperar a que salga el anterior', () => {
    const { rerender } = render(<VozDeLaMascota mascota={null} mensaje="Uno" />);

    rerender(<VozDeLaMascota mascota={null} mensaje="Dos" />);

    expect(screen.getByText('Dos')).toBeInTheDocument();
    expect(screen.queryByText('Uno')).not.toBeInTheDocument();
  });

  it('un acierto tine el globo; un «casi» no lo pinta de ningun color de error', () => {
    const { container, rerender } = render(
      <VozDeLaMascota mascota={null} mensaje="¡Eso es!" resultado="acierto" />,
    );

    expect(container.querySelector('.viva-voz__globo')).toHaveAttribute(
      'data-resultado',
      'acierto',
    );

    rerender(<VozDeLaMascota mascota={null} mensaje="¡Casi!" resultado="casi" />);

    expect(container.querySelector('.viva-voz__globo')).toHaveAttribute('data-resultado', 'casi');
  });

  it('la cara es decorativa y la expresion cambia el dibujo', () => {
    const { container, rerender } = render(<VozDeLaMascota mascota={null} mensaje="Hola" />);

    const normal = container.querySelector('img')?.getAttribute('src');

    expect(container.querySelector('.viva-voz__mascota')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');

    rerender(<VozDeLaMascota mascota={null} mensaje="Hola" expresion="celebrando" />);

    expect(container.querySelector('img')?.getAttribute('src')).not.toBe(normal);
  });

  it('no tiene fallos de accesibilidad', async () => {
    const { container } = render(
      <VozDeLaMascota mascota={null} mensaje="Hola" ademas="Con calma" />,
    );

    expect(await fallosDeAccesibilidad(container)).toEqual([]);
  });
});

describe('BarraDeAccion', () => {
  it('el boton principal envia el formulario y puede estar apagado', async () => {
    const enviar = vi.fn((evento: { preventDefault: () => void }) => evento.preventDefault());

    render(
      <form onSubmit={enviar}>
        <BarraDeAccion>
          <BotonPrincipal tipo="submit">Seguir</BotonPrincipal>
        </BarraDeAccion>
      </form>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('apagado no hace nada, y dice por que con aria-describedby', async () => {
    const alPulsar = vi.fn();

    render(
      <>
        <p id="pista">Elige una opcion.</p>
        <BotonPrincipal alPulsar={alPulsar} deshabilitado descritoPor="pista">
          Seguir
        </BotonPrincipal>
      </>,
    );

    const boton = screen.getByRole('button', { name: 'Seguir' });

    await usuario.click(boton);

    expect(alPulsar).not.toHaveBeenCalled();
    expect(boton).toHaveAccessibleDescription('Elige una opcion.');
  });

  it('el secundario hace lo suyo y no envia el formulario', async () => {
    const alPulsar = vi.fn();
    const enviar = vi.fn();

    render(
      <form onSubmit={enviar}>
        <BotonSecundario alPulsar={alPulsar}>Atrás</BotonSecundario>
      </form>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Atrás' }));

    expect(alPulsar).toHaveBeenCalledTimes(1);
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe('PasoAnimado', () => {
  it('lleva el titulo del paso y lo relaciona con su seccion', () => {
    render(
      <PasoAnimado clave="uno" direccion={1} titulo="¿Como vas?" ayuda="Piensa en hoy.">
        <p>Contenido</p>
      </PasoAnimado>,
    );

    expect(screen.getByRole('region', { name: '¿Como vas?' })).toBeInTheDocument();
    expect(screen.getByText('Piensa en hoy.')).toBeInTheDocument();
  });

  it('al cambiar de paso el foco pasa al titulo nuevo; al abrir, no se toca', async () => {
    const { rerender } = render(
      <PasoAnimado clave="uno" direccion={1} titulo="Primero">
        <button type="button">Algo</button>
      </PasoAnimado>,
    );

    expect(document.body).toHaveFocus();

    rerender(
      <PasoAnimado clave="dos" direccion={1} titulo="Segundo">
        <button type="button">Algo</button>
      </PasoAnimado>,
    );

    expect(await screen.findByRole('heading', { name: 'Segundo' })).toHaveFocus();
  });
});

describe('PasosDeInicio', () => {
  it('numera los pasos en una lista ordenada', () => {
    render(<PasosDeInicio pasos={['Mira.', 'Espera.', 'Escribe.']} />);

    expect(screen.getAllByRole('listitem').map((uno) => uno.textContent)).toEqual([
      '1Mira.',
      '2Espera.',
      '3Escribe.',
    ]);
  });
});

describe('HeroeDeLaActividad', () => {
  it('lleva el encabezado de primer nivel con el nombre, la categoria y la descripcion', () => {
    render(
      <HeroeDeLaActividad
        modulo="bienestar"
        categoria="Bienestar"
        nombre="Cómo dormiste anoche"
        descripcion="Cuatro preguntas rápidas."
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cómo dormiste anoche' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bienestar')).toBeInTheDocument();
    expect(screen.getByText('Cuatro preguntas rápidas.')).toBeInTheDocument();
  });

  it('sin descripcion ni modulo conocido tambien se pinta', () => {
    render(<HeroeDeLaActividad modulo={undefined} categoria="Otra" nombre="Algo" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Algo' })).toBeInTheDocument();
  });
});

describe('Adornos', () => {
  it('las chispas y el fondo no los lee un lector de pantalla', () => {
    const { container } = render(
      <>
        <Chispas />
        <FondoVivo />
      </>,
    );

    expect(container.querySelector('.viva-chispas')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.viva-fondo')).toHaveAttribute('aria-hidden', 'true');
  });

  it('las chispas son doce, siempre las mismas direcciones', () => {
    const { container, rerender } = render(<Chispas />);

    const una = [...container.querySelectorAll('i')].map((i) => i.getAttribute('style'));

    rerender(<Chispas />);

    const otra = [...container.querySelectorAll('i')].map((i) => i.getAttribute('style'));

    expect(una).toHaveLength(12);
    expect(otra).toEqual(una);
  });

  it('el alcance acerca o aleja las chispas', () => {
    const { container: cerca } = render(<Chispas alcance={0.5} />);
    const { container: lejos } = render(<Chispas alcance={1} />);

    const dx = (raiz: HTMLElement) =>
      Number.parseInt(raiz.querySelector('i')?.style.getPropertyValue('--dx') ?? '0', 10);

    expect(Math.abs(dx(cerca))).toBeLessThan(Math.abs(dx(lejos)));
  });
});
