import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HTML from '../../index.html?raw';
import {
  DATOS_DE_LA_CARGA,
  ETIQUETAS_DE_LA_CARGA,
  LARGO_MAXIMO_DE_UN_DATO,
} from './datosDeLaCarga.ts';
import { PantallaDeCarga } from './PantallaDeCarga.tsx';

/** El index.html tal como lo lee un navegador: sin los saltos de linea que le pone el formateador. */
const HTML_CORRIDO = HTML.replace(/\s+/g, ' ');

describe('Los datos de la pantalla de carga (SCRUM-283)', () => {
  it('son ocho, que es en cuantas partes iguales reparte el tiempo la animacion', () => {
    expect(DATOS_DE_LA_CARGA).toHaveLength(8);
    expect(HTML).toContain('--vsd-datos: 8;');
    expect(HTML.match(/<li class="vsd-carga__dato"/g)).toHaveLength(8);
    // Cada cuadro de la animacion dura un octavo: 12,5 %.
    expect(HTML).toMatch(/12\.5%,\s*100% \{/);
    // Y cada visita empieza por uno de los ocho al azar.
    expect(HTML).toContain('Math.floor(Math.random() * 8) * 5');
  });

  it('se alternan un dato curioso y algo de VSD Health, para que se vean los dos', () => {
    expect(DATOS_DE_LA_CARGA.map((dato) => dato.tipo)).toEqual([
      'curioso',
      'app',
      'curioso',
      'app',
      'curioso',
      'app',
      'curioso',
      'app',
    ]);
  });

  it.each(DATOS_DE_LA_CARGA.map((dato, indice) => ({ ...dato, indice })))(
    'el dato $indice esta igual en el index.html, con su etiqueta y en el mismo lugar',
    ({ tipo, texto, indice }) => {
      const esperado = `<li class="vsd-carga__dato" style="--i: ${indice}"> <span class="vsd-carga__etiqueta">${ETIQUETAS_DE_LA_CARGA[tipo]}</span> <span class="vsd-carga__frase"> ${texto} </span> </li>`;

      // Prettier puede dejar el texto pegado a las etiquetas o con espacios: no importa para el navegador.
      expect(HTML_CORRIDO.replace(/> </g, '><').replace(/> /g, '>').replace(/ </g, '<')).toContain(
        esperado.replace(/> </g, '><').replace(/> /g, '>').replace(/ </g, '<'),
      );
    },
  );

  it.each(DATOS_DE_LA_CARGA)('«$texto» cabe en tres lineas y termina en punto', ({ texto }) => {
    expect(texto.length).toBeLessThanOrEqual(LARGO_MAXIMO_DE_UN_DATO);
    expect(texto.endsWith('.')).toBe(true);
  });

  it('ninguno habla de salud: son cultura general o lo que la aplicacion hace', () => {
    const textos = DATOS_DE_LA_CARGA.filter((dato) => dato.tipo === 'curioso').map(
      (dato) => dato.texto,
    );

    for (const texto of textos) {
      expect(texto).not.toMatch(
        /diagn[oó]stic|s[ií]ntoma|tratamiento|medic|enfermedad|ansiedad|depresi[oó]n|terapia/i,
      );
    }
  });

  it('se dibujan en el componente, escondidos del lector de pantalla', () => {
    const { container } = render(<PantallaDeCarga mensaje="Cargando" />);

    const lista = container.querySelector('.vsd-carga__datos');
    const dibujados = [...container.querySelectorAll('.vsd-carga__frase')].map(
      (nodo) => nodo.textContent,
    );

    expect(lista).toHaveAttribute('aria-hidden', 'true');
    expect(dibujados).toEqual(DATOS_DE_LA_CARGA.map((dato) => dato.texto));
  });
});

describe('PantallaDeCarga (SCRUM-283)', () => {
  it('dice que carga, se anuncia y esconde el dibujo del lector de pantalla', () => {
    const { container } = render(<PantallaDeCarga mensaje="Comprobando la sesión" />);

    const estado = screen.getByRole('status');

    expect(estado).toHaveTextContent('Comprobando la sesión');
    expect(estado).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.vsd-carga__pista')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lleva la mascota y la barra', () => {
    const { container } = render(<PantallaDeCarga mensaje="Cargando" />);

    expect(container.querySelector('.vsd-carga__corredor .vsd-carga__img')).not.toBeNull();
    expect(container.querySelector('.vsd-carga__barra .vsd-carga__relleno')).not.toBeNull();
  });

  it('en linea y tardia suma sus clases; sola no suma ninguna', () => {
    const sola = render(<PantallaDeCarga mensaje="a" />).container.firstElementChild;
    const otra = render(<PantallaDeCarga mensaje="b" enLinea tardio />).container.firstElementChild;

    expect(sola).toHaveClass('vsd-carga');
    expect(sola).not.toHaveClass('vsd-carga--en-linea');
    expect(sola).not.toHaveClass('vsd-carga--tardio');
    expect(otra).toHaveClass('vsd-carga', 'vsd-carga--en-linea', 'vsd-carga--tardio');
  });

  it('usa clases que existen en los estilos del index.html (los dos se ven igual)', () => {
    const { container } = render(<PantallaDeCarga mensaje="Cargando" enLinea tardio />);
    const clases = new Set(
      [...container.querySelectorAll('[class]')].flatMap((nodo) => [...nodo.classList]),
    );

    for (const clase of clases) {
      expect(HTML, `.${clase} no esta en los estilos del index.html`).toContain(`.${clase}`);
    }
  });

  it('lo que se anima no obliga al navegador a recalcular la pagina: solo transform y opacity', () => {
    const cuadros = [...HTML.matchAll(/@keyframes vsd-carga-[a-z]+ \{([\s\S]*?)\n {6}\}\n/g)]
      .map((coincidencia) => coincidencia[1] ?? '')
      .join('\n');

    expect(cuadros).toContain('transform');
    expect(cuadros).not.toMatch(/\b(left|right|top|bottom|width|height|margin|padding)\s*:/);
  });

  describe('con «menos movimiento»', () => {
    const [normal = '', reducido = ''] = HTML.split('@media (prefers-reduced-motion: reduce)');
    // Lo que aparece tarde (`--tardio`) solo cambia de opacidad: no es movimiento.
    const SOLO_OPACIDAD = ['.vsd-carga--tardio'];

    /** Cada regla de los estilos normales que tiene una animacion propia. */
    const animados = [...normal.matchAll(/([^{}]+)\{[^{}]*\banimation:\s*vsd-carga-/g)]
      .map((coincidencia) => (coincidencia[1] ?? '').trim().split('\n').pop()?.trim() ?? '')
      .filter((selector) => selector.startsWith('.vsd-carga') && !SOLO_OPACIDAD.includes(selector));

    it('el index.html tiene el bloque', () => {
      expect(reducido).not.toBe('');
      expect(animados.length).toBeGreaterThanOrEqual(6);
    });

    it.each(animados)('%s se queda quieto', (selector) => {
      expect(reducido, `${selector} sigue animandose con «menos movimiento»`).toContain(selector);
    });
  });
});
