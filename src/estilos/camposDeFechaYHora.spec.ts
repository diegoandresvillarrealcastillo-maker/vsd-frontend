import { describe, expect, it } from 'vitest';

import GLOBAL from './global.css?raw';
import VIVA from './viva.css?raw';

/**
 * Los campos nativos de fecha y hora en un iPhone (SCRUM-199).
 *
 * En un iPhone real, la caja de la hora de «Como dormiste anoche» sobresalia ~36 px del borde
 * de su tarjeta aunque ya tenia `width: 100%` y `box-sizing: border-box`: los controles de
 * fecha y hora de iOS Safari no respetan bien el ancho dentro de una rejilla.
 *
 * jsdom no calcula el diseno, asi que no puede medir el desborde: lo que vigila esta prueba son
 * las reglas que lo evitan y que ningun campo de fecha u hora nuevo quede fuera de ellas. La
 * medida real, antes y despues, esta en la descripcion del PR (hecha en un iPhone).
 */

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** El interior (con llaves balanceadas) del bloque que empieza en `cabecera {`. */
function bloque(hoja: string, cabecera: string): string {
  const texto = sinComentarios(hoja);
  const inicio = texto.indexOf(`${cabecera} {`);

  if (inicio === -1) {
    throw new Error(`No hay un bloque ${cabecera}`);
  }

  let profundidad = 0;

  for (let i = inicio + cabecera.length + 1; i < texto.length; i += 1) {
    if (texto[i] === '{') {
      profundidad += 1;
    } else if (texto[i] === '}') {
      profundidad -= 1;

      if (profundidad === 0) {
        return texto.slice(inicio + cabecera.length + 2, i);
      }
    }
  }

  throw new Error(`El bloque ${cabecera} no se cierra`);
}

/** La primera regla (selector y declaraciones) cuyo selector cumple `coincide`. */
function buscarRegla(interior: string, coincide: (selector: string) => boolean) {
  for (const regla of interior.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (regla[1] ?? '').replace(/\s+/g, ' ').trim();

    if (coincide(selector)) {
      return { selector, declaraciones: (regla[2] ?? '').replace(/\s+/g, ' ').trim() };
    }
  }

  throw new Error('No hay una regla que cumpla lo pedido');
}

/** La regla de los campos temporales: la que lleva `[type=` en su selector. */
function reglaDeLosCampos() {
  return buscarRegla(bloque(GLOBAL, SOLO_IOS), (selector) => selector.includes('[type='));
}

const SOLO_IOS = '@supports (-webkit-touch-callout: none)';

describe('Los campos nativos de fecha y hora no se salen de su tarjeta en iOS', () => {
  const regla = reglaDeLosCampos;

  it('hay una regla propia de iOS, para no tocar el escritorio ni Android', () => {
    expect(() => bloque(GLOBAL, SOLO_IOS)).not.toThrow();
  });

  it('puede encogerse y nunca pasa del ancho de su contenedor', () => {
    const { declaraciones } = regla();

    expect(declaraciones).toContain('min-width: 0');
    expect(declaraciones).toContain('max-width: 100%');
  });

  it('deja de ser un control nativo, que es el que ignora el ancho', () => {
    const { declaraciones } = regla();

    expect(declaraciones).toContain('-webkit-appearance: none');
    expect(declaraciones).toMatch(/(^|[ ;])appearance: none/);
  });

  it('no se queda en cero de alto cuando esta vacio', () => {
    expect(regla().declaraciones).toMatch(/min-height:\s*[\d.]+rem/);
  });

  it('va en `:where`: no pesa mas que las reglas de cada campo, que mandan', () => {
    // Sin esto, `input[type='time']` (0,1,1) le ganaria a `.perfil__hora { width: 8.5rem }`.
    expect(regla().selector).toMatch(/^:where\(/);
  });

  it('cubre la fecha y la hora', () => {
    const { selector } = regla();

    expect(selector).toMatch(/type=["']date["']/);
    expect(selector).toMatch(/type=["']time["']/);
  });
});

describe('La rejilla de las tarjetas de las actividades', () => {
  it('su columna se puede encoger por debajo de lo que mide su contenido', () => {
    // Una rejilla con la columna `auto` no deja que un hijo sea mas angosto que su contenido.
    const { declaraciones } = buscarRegla(
      sinComentarios(VIVA),
      (selector) => selector === '.viva-tarjeta',
    );

    expect(declaraciones).toContain('grid-template-columns: minmax(0, 1fr)');
  });
});

describe('Ningun campo temporal nuevo queda fuera de la regla', () => {
  const FUENTES = import.meta.glob<string>(['../**/*.tsx', '!../**/*.spec.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  const TIPOS_TEMPORALES = ['date', 'time', 'datetime-local', 'month', 'week'];

  it('todo `type` temporal que usa la app esta en el selector', () => {
    const { selector } = reglaDeLosCampos();
    const usados = new Set<string>();

    for (const fuente of Object.values(FUENTES)) {
      for (const encontrado of fuente.matchAll(/\btype=["']([a-z-]+)["']/g)) {
        const tipo = encontrado[1];

        if (tipo !== undefined && TIPOS_TEMPORALES.includes(tipo)) {
          usados.add(tipo);
        }
      }
    }

    // Si esto fuera vacio, la prueba no estaria mirando nada.
    expect([...usados].sort()).toEqual(['date', 'time']);

    for (const tipo of usados) {
      expect(selector, `falta type="${tipo}" en la regla de iOS`).toMatch(
        new RegExp(`type=["']${tipo}["']`),
      );
    }
  });
});
