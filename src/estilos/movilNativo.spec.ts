import { describe, expect, it } from 'vitest';

import ACTIVIDAD from './actividad.css?raw';
import GLOBAL from './global.css?raw';

/**
 * Lo que hace que la aplicacion se sienta instalada en un telefono y no como una pagina web (SCRUM-239).
 *
 * jsdom no calcula el diseno ni tiene dedo, asi que aqui solo se vigilan las promesas del CSS: son pocas,
 * una linea cada una y faciles de quitar sin darse cuenta. Lo que ninguna prueba puede decir es como se
 * *siente* en un telefono de verdad; eso se mira con uno en la mano.
 */

/** Todos los archivos de estilos, por nombre. */
const HOJAS = import.meta.glob('./*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function sinComentarios(hoja: string): string {
  return hoja.replace(/\/\*[\s\S]*?\*\//g, '');
}

interface Regla {
  readonly selector: string;
  readonly cuerpo: string;
  /** Los `@media` que la contienen, de fuera hacia dentro. */
  readonly dentroDe: readonly string[];
}

/** Las reglas de una hoja con el `@media` o `@supports` que las contiene, sin importar cuanto se anide. */
function reglas(hoja: string): Regla[] {
  const texto = sinComentarios(hoja);
  const resultado: Regla[] = [];
  const abiertas: { cabecera: string; inicio: number }[] = [];
  let cabecera = '';

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;

    if (c === '{') {
      abiertas.push({ cabecera: cabecera.trim(), inicio: i + 1 });
      cabecera = '';
    } else if (c === '}') {
      const cerrada = abiertas.pop();

      if (cerrada !== undefined && !cerrada.cabecera.startsWith('@')) {
        resultado.push({
          selector: cerrada.cabecera,
          cuerpo: texto.slice(cerrada.inicio, i),
          dentroDe: abiertas.map((a) => a.cabecera).filter((a) => a.startsWith('@')),
        });
      }

      cabecera = '';
    } else if (c === ';') {
      cabecera = '';
    } else {
      cabecera += c;
    }
  }

  return resultado;
}

/** Las partes de un selector separadas por coma, sin partir lo que va dentro de parentesis. */
function partes(selector: string): string[] {
  const resultado: string[] = [];
  let nivel = 0;
  let actual = '';

  for (const c of selector) {
    if (c === '(' || c === '[') nivel++;
    if (c === ')' || c === ']') nivel--;

    if (c === ',' && nivel === 0) {
      resultado.push(actual.trim());
      actual = '';
    } else {
      actual += c;
    }
  }

  resultado.push(actual.trim());

  return resultado.filter((p) => p !== '');
}

describe('Ningun :hover se queda pegado al tocar', () => {
  // Un telefono no tiene cursor, asi que el navegador finge un hover al primer toque y lo deja puesto hasta que
  // se toca otra cosa: una opcion queda «iluminada» como si fuera la elegida o la correcta. En las actividades,
  // donde nada debe parecer un acierto o un error, es justo lo que no puede pasar.
  it.each(Object.entries(HOJAS))(
    '%s: todo :hover va dentro de @media (hover: hover)',
    (nombre, hoja) => {
      const sueltos: string[] = [];

      for (const regla of reglas(hoja)) {
        const conHover = partes(regla.selector).filter(
          // `:not(:hover)` es «cuando no hay cursor»: ese si debe valer con el dedo.
          (parte) => parte.includes(':hover') && !/:not\([^)]*:hover/.test(parte),
        );
        const protegida = regla.dentroDe.some((m) => /@media[^{]*\(hover:\s*hover\)/.test(m));

        if (conHover.length > 0 && !protegida) {
          sueltos.push(conHover.join(', '));
        }
      }

      expect(sueltos, nombre).toEqual([]);
    },
  );
});

describe('Lo basico de un telefono, una vez, para todo', () => {
  const base = sinComentarios(GLOBAL);

  /** El cuerpo de la primera regla `html` (sola) de la hoja global. */
  function html(): string {
    return (
      reglas(GLOBAL).find((r) => r.selector === 'html' && r.dentroDe.length === 0)?.cuerpo ?? ''
    );
  }

  it('el toque no pinta el destello gris del navegador', () => {
    // Ya se quito de unos cuantos juegos; en el resto de la aplicacion se vera igual mientras no este aqui.
    expect(html()).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
  });

  it('un doble toque rapido no hace zoom: los juegos se tocan varias veces seguidas', () => {
    // `manipulation` quita el zoom por doble toque y conserva el zoom de pellizco, que es accesibilidad.
    expect(html()).toMatch(/touch-action:\s*manipulation/);
  });

  it('girar el telefono no agranda la letra', () => {
    expect(html()).toMatch(/-webkit-text-size-adjust:\s*100%/);
  });

  it('lo que es un control no se selecciona al dejar el dedo puesto, pero el texto si', () => {
    const controles = reglas(GLOBAL).find(
      (r) =>
        r.dentroDe.length === 0 &&
        /^button\b/.test(r.selector) &&
        /user-select:\s*none/.test(r.cuerpo),
    );

    expect(controles, 'no hay una regla de button con user-select: none').toBeDefined();
    expect(controles?.cuerpo).toMatch(/-webkit-user-select:\s*none/);
    // Nunca en el cuerpo de la pagina: ahi la gente copia direcciones, mensajes y numeros.
    expect(base).not.toMatch(/\bbody\s*\{[^}]*user-select:\s*none/);
  });
});

describe('Los campos de texto no hacen zoom en iOS', () => {
  // iOS Safari amplia la pagina al enfocar un campo con letra menor de 16 px, y no la devuelve al salir: la
  // persona se queda mirando un diseno cortado. Arreglarlo con `maximum-scale=1` es quitar el zoom a quien lo
  // necesita; lo que se arregla es la letra.
  const SELECTOR_DE_CAMPO = /(^|[\s>+~,])(input|textarea|select)\b|__entrada\b/;

  function tamanoEnRem(valor: string): number | undefined {
    const rem = /^([\d.]+)rem$/.exec(valor.trim());
    const px = /^([\d.]+)px$/.exec(valor.trim());

    if (rem?.[1] !== undefined) return Number(rem[1]);
    if (px?.[1] !== undefined) return Number(px[1]) / 16;

    return undefined;
  }

  it.each(Object.entries(HOJAS))(
    '%s: ningun campo de texto declara menos de 16 px',
    (nombre, hoja) => {
      const chicos: string[] = [];

      for (const regla of reglas(hoja)) {
        if (
          !SELECTOR_DE_CAMPO.test(regla.selector) ||
          /::placeholder|::after|::before/.test(regla.selector)
        ) {
          continue;
        }

        // Las reglas de campos de fecha y hora, de rango o de casilla no son de texto.
        if (/type=['"]?(checkbox|radio|range|color|file)/.test(regla.selector)) {
          continue;
        }

        const declarado = /(?:^|[;\s])font-size:\s*([^;]+)/.exec(regla.cuerpo)?.[1];
        const tamano = declarado === undefined ? undefined : tamanoEnRem(declarado);

        if (tamano !== undefined && tamano < 1) {
          chicos.push(`${regla.selector} { font-size: ${declarado?.trim() ?? ''} }`);
        }
      }

      expect(chicos, nombre).toEqual([]);
    },
  );
});

describe('El marco de una actividad respeta la muesca y la barra de gestos', () => {
  function marco(): string {
    return (
      reglas(ACTIVIDAD).find((r) => r.selector === '.actividad' && r.dentroDe.length === 0)
        ?.cuerpo ?? ''
    );
  }

  it('con el telefono de lado, el contenido no queda debajo de la muesca ni de la isla', () => {
    // Con `viewport-fit=cover` la pagina llega hasta el borde. Sin esto, en horizontal el texto de la izquierda
    // queda tapado por la muesca. En vertical los valores son 0 y no cambia nada.
    expect(marco()).toMatch(/padding-left:\s*env\(safe-area-inset-left/);
    expect(marco()).toMatch(/padding-right:\s*env\(safe-area-inset-right/);
  });

  it('el ultimo boton no queda debajo de la barra de gestos', () => {
    expect(marco()).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom/);
  });
});

describe('Un gesto en un juego no recarga la pagina', () => {
  it('mientras hay una actividad abierta, arrastrar hacia abajo desde arriba no dispara «tirar para recargar»', () => {
    // Recargar a mitad de una actividad pierde lo que se llevaba hecho. `contain` deja el rebote propio del
    // sistema y solo impide que el gesto llegue a recargar.
    const regla = reglas(ACTIVIDAD).find((r) => r.selector === 'html:has(.actividad)');

    expect(regla, 'no hay una regla html:has(.actividad)').toBeDefined();
    expect(regla?.cuerpo).toMatch(/overscroll-behavior-y:\s*contain/);
  });
});
