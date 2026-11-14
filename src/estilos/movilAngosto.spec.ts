import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';

/**
 * Lo que no se debe romper en un telefono angosto: nada se sale de la pantalla y la foto de
 * perfil es siempre un circulo (SCRUM-175).
 *
 * jsdom no calcula el diseño, asi que no puede medir un desborde. Lo que si puede hacer es vigilar
 * las reglas que lo evitan, que son pocas y faciles de quitar sin darse cuenta. Cada una tiene
 * detras una medida real en un navegador a 320 px, que esta en la descripcion del PR.
 */

const SIN_COMENTARIOS = APLICACION.replace(/\/\*[\s\S]*?\*\//g, '');

/** Las declaraciones de la regla de un selector al nivel de la hoja (no las de un `@media`). */
function declaraciones(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const bloque = new RegExp(String.raw`^${escapado}\s*\{([^}]*)\}`, 'm').exec(SIN_COMENTARIOS)?.[1];

  if (bloque === undefined) {
    throw new Error(`No hay una regla para ${selector} en aplicacion.css`);
  }

  return bloque.replace(/\s+/g, ' ').trim();
}

/** Las declaraciones de un selector dentro del `@media` de las pantallas angostas. */
function enPantallaAngosta(selector: string): string {
  const media = /@media \(max-width: 22\.5rem\) \{([\s\S]*?)\n\}/.exec(SIN_COMENTARIOS)?.[1];

  if (media === undefined) {
    throw new Error('No hay un @media (max-width: 22.5rem) en aplicacion.css');
  }

  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const bloque = new RegExp(String.raw`${escapado}\s*\{([^}]*)\}`).exec(media)?.[1];

  if (bloque === undefined) {
    throw new Error(`No hay una regla para ${selector} en la pantalla angosta`);
  }

  return bloque.replace(/\s+/g, ' ').trim();
}

describe('La foto de perfil es siempre un circulo', () => {
  it.each(['.app__avatar', '.perfil__foto-marco'])(
    '%s es cuadrado, no se encoge en una fila apretada y recorta en circulo',
    (selector) => {
      const reglas = declaraciones(selector);

      expect(reglas).toContain('flex: none');
      expect(reglas).toContain('aspect-ratio: 1');
      expect(reglas).toContain('border-radius: 50%');
      expect(reglas).toContain('overflow: hidden');
    },
  );

  it('el boton del avatar no conserva el relleno que le pone el navegador', () => {
    // Con el relleno de un `button` (1px 6px) la foto al 100% quedaba en 28 x 38 dentro del
    // circulo de 40: un rectangulo vertical con el fondo asomando a los lados.
    expect(declaraciones('.app__avatar')).toContain('padding: 0');
  });

  it.each(['.app__avatar-foto', '.perfil__foto-imagen'])(
    '%s llena el circulo, lo recorta ella misma y no se deforma',
    (selector) => {
      const reglas = declaraciones(selector);

      expect(reglas).toContain('width: 100%');
      expect(reglas).toContain('height: 100%');
      expect(reglas).toContain('border-radius: 50%');
      expect(reglas).toContain('object-fit: cover');
    },
  );
});

describe('Nada se sale de la pantalla a 320 px', () => {
  it('los apartados del perfil son una columna que se encoge', () => {
    // Con la pista `auto` por defecto, la columna crecia hasta lo mas ancho de adentro (la palabra
    // «Recomendaciones» del interruptor del diario) y empujaba la pagina 6 px a la derecha.
    expect(declaraciones('.perfil__apartado')).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('el nombre de un interruptor puede ser mas angosto que su palabra mas larga', () => {
    const reglas = declaraciones('.perfil__modulo-nombre');

    expect(reglas).toContain('min-width: 0');
    expect(reglas).toContain('overflow-wrap: anywhere');
  });

  it.each(['.perfil__interruptor', '.tarjeta-modulo__icono'])(
    '%s no se aplasta: es el texto el que cede el lugar',
    (selector) => {
      expect(declaraciones(selector)).toContain('flex: none');
    },
  );

  it('en 360 px o menos se le quita aire al perfil para que el texto entre', () => {
    expect(enPantallaAngosta('.perfil')).toContain('padding-inline: 0.875rem');
    expect(enPantallaAngosta('.perfil__apartado')).toContain('padding: 1rem');
    expect(enPantallaAngosta('.perfil__modulo-nombre')).toContain('font-size: 0.9375rem');
  });
});
