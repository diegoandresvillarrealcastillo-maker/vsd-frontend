import { describe, expect, it } from 'vitest';

import APLICACION from './aplicacion.css?raw';
import CONEXION from './conexion.css?raw';
import LEGAL from './legal.css?raw';

/**
 * Lo que mide una auditoria a 320, 375 y 430 px y no se debe romper (SCRUM-179).
 *
 * jsdom no calcula el diseno, asi que no puede medir un desborde: lo que vigila son las reglas
 * que lo evitan, que son pocas y faciles de quitar sin darse cuenta. Cada una tiene detras una
 * medida real en un navegador, que esta en la descripcion del PR.
 */

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Las declaraciones de la regla de un selector al nivel de la hoja. */
function regla(hoja: string, selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const bloque = new RegExp(String.raw`^${escapado}\s*\{([^}]*)\}`, 'm').exec(
    sinComentarios(hoja),
  )?.[1];

  if (bloque === undefined) {
    throw new Error(`No hay una regla para ${selector}`);
  }

  return bloque.replace(/\s+/g, ' ').trim();
}

describe('Las paginas legales parten las cadenas largas', () => {
  it('un correo largo no ensancha la pagina: el contenido se parte donde haga falta', () => {
    // A 320 px, el correo del responsable (sin espacios) hacia que /privacidad y /terminos
    // se desplazaran de lado: 24 px de mas. `anywhere` baja tambien el ancho minimo del
    // contenido, que es lo que evita que el flex del contenedor lo ensanche.
    const reglas = regla(LEGAL, '.legal__principal');

    expect(reglas).toContain('overflow-wrap: anywhere');
    expect(reglas).toContain('min-width: 0');
  });
});

describe('La hoja inferior respeta la barra de gestos y la barra del navegador', () => {
  it('deja sitio abajo para la zona segura', () => {
    expect(regla(APLICACION, '.hoja__caja')).toMatch(
      /padding:[^;]*calc\([^)]*env\(safe-area-inset-bottom/,
    );
  });

  it('su alto maximo sigue a la ventana visible (dvh), con vh de respaldo', () => {
    const reglas = regla(APLICACION, '.hoja__caja');

    expect(reglas).toMatch(/max-height:\s*85vh;\s*max-height:\s*85dvh/);
  });
});

describe('Los bordes laterales respetan el notch con el telefono de lado', () => {
  it.each(['.app__barra-interior', '.app__contenido'])(
    '%s no queda debajo del notch',
    (selector) => {
      const reglas = regla(APLICACION, selector);

      expect(reglas).toMatch(/padding-left:\s*max\([^)]*env\(safe-area-inset-left/);
      expect(reglas).toMatch(/padding-right:\s*max\([^)]*env\(safe-area-inset-right/);
    },
  );
});

describe('Un plegable cerrado (280 px)', () => {
  it('las entradas del dock se pueden encoger: cuatro no caben a 64 px cada una', () => {
    const bloque = /@media \(max-width: 18rem\) \{([\s\S]*?)\n\}/.exec(
      sinComentarios(APLICACION),
    )?.[1];

    expect(bloque, 'no hay un @media (max-width: 18rem)').toBeDefined();
    expect(bloque).toMatch(/\.app__nav-inferior-enlace\s*\{[^}]*min-width:\s*0/);
  });
});

describe('Ninguna altura depende de 100vh a secas', () => {
  /** Las declaraciones que usan `100vh` y no tienen, en su regla, una hermana con `dvh`. */
  function sinRespaldo(hoja: string): string[] {
    const malas: string[] = [];

    for (const bloque of sinComentarios(hoja).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const cuerpo = bloque[2] ?? '';

      if (/\b100vh\b/.test(cuerpo) && !/\b100dvh\b/.test(cuerpo)) {
        malas.push((bloque[1] ?? '').trim());
      }
    }

    return malas;
  }

  it.each([
    ['aplicacion.css', APLICACION],
    ['conexion.css', CONEXION],
  ])('%s: cada 100vh trae su 100dvh', (_nombre, hoja) => {
    expect(sinRespaldo(hoja)).toEqual([]);
  });
});
