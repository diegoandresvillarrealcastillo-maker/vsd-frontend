import { describe, expect, it } from 'vitest';

import ESCRITURA_BREVE from './escrituraBreve.css?raw';

/**
 * Los estilos de «Tres cosas buenas» (SCRUM-211, ficha EMO-02).
 *
 * jsdom no pinta, asi que no se puede comprobar lo que se ve. Lo que si se puede es vigilar las
 * promesas hechas en el CSS: que el grupo de campos no traiga el borde de fabrica de un `fieldset`,
 * que cada campo sea mas bajo que el campo unico para que varios quepan en un telefono, y que no
 * haya ningun color propio (los colores, la tarjeta y los atajos son del kit de las actividades).
 */

const SIN_COMENTARIOS = ESCRITURA_BREVE.replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo del primer bloque que empieza con `selector {`, sin los comentarios. */
function bloque(selector: string): string {
  const inicio = SIN_COMENTARIOS.indexOf(`${selector} {`);

  if (inicio < 0) {
    throw new Error(`No hay un bloque «${selector}».`);
  }

  return SIN_COMENTARIOS.slice(
    SIN_COMENTARIOS.indexOf('{', inicio) + 1,
    SIN_COMENTARIOS.indexOf('}', inicio),
  );
}

function px(cuerpo: string, propiedad: string): number {
  return Number(new RegExp(`${propiedad}:\\s*([\\d.]+)px`).exec(cuerpo)?.[1]);
}

describe('el grupo de campos', () => {
  it('es un fieldset sin su borde ni su relleno de fabrica', () => {
    const grupo = bloque('.escritura');

    expect(grupo).toMatch(/border:\s*0/);
    expect(grupo).toMatch(/padding:\s*0/);
    expect(grupo).toMatch(/margin:\s*0/);
  });

  it('puede ser mas angosto que su contenido: un fieldset no se encoge por si solo', () => {
    expect(bloque('.escritura')).toMatch(/min-width:\s*0/);
  });

  it('cada campo deja aire entre el texto y su cuenta', () => {
    const campo = bloque('.escritura__campo');

    expect(campo).toMatch(/display:\s*grid/);
    expect(px(campo, 'gap')).toBeGreaterThanOrEqual(8);
  });
});

describe('cada campo de texto', () => {
  const texto = () => bloque('.viva-texto.escritura__texto');

  it('es mas bajo que el campo unico (150 px), para que varios quepan en un telefono', () => {
    expect(px(texto(), 'min-height')).toBeLessThan(150);
  });

  it('pero deja ver dos lineas de texto y se toca sin esfuerzo (44 px o mas)', () => {
    expect(px(texto(), 'min-height')).toBeGreaterThanOrEqual(72);
  });

  it('gana al estilo del campo unico: lleva las dos clases, y no depende del orden de los archivos', () => {
    expect(SIN_COMENTARIOS).toMatch(/\.viva-texto\.escritura__texto\s*\{/);
  });
});

describe('los colores', () => {
  it('no hay ninguno propio: ni hexadecimales, ni rgb, ni hsl', () => {
    expect(SIN_COMENTARIOS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(SIN_COMENTARIOS).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i);
  });
});
