import { describe, expect, it } from 'vitest';

import PANEL_VIVO from './panelVivo.css?raw';

/**
 * El panel con relieve y el arbol con vida (SCRUM-310).
 *
 * jsdom no pinta ni dispara `:hover`, asi que se vigila lo que si se puede leer: que no haya colores
 * propios, que lo que se mueve solo use lo barato, que con «reducir movimiento» todo se quede quieto
 * y que cada clase que la hoja nombra exista de verdad (el panel y el mapa estan en otros archivos).
 */

const OTRAS_HOJAS = import.meta.glob<string>('./*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const HOJA = PANEL_VIVO.replace(/\/\*[\s\S]*?\*\//g, '');

/** El texto de un bloque `{ ... }` que empieza en `inicio`, con sus llaves. */
function bloqueDesde(texto: string, inicio: number): string {
  let profundidad = 0;

  for (let i = texto.indexOf('{', inicio); i < texto.length; i++) {
    profundidad += texto[i] === '{' ? 1 : texto[i] === '}' ? -1 : 0;

    if (profundidad === 0) {
      return texto.slice(inicio, i + 1);
    }
  }

  throw new Error('Un bloque no cierra');
}

/** Todos los `@media` que empiezan con `prefijo`, y la hoja sin ellos. */
function mediosQue(prefijo: string, texto = HOJA): { bloques: string[]; resto: string } {
  const bloques: string[] = [];
  let resto = texto;
  let inicio = resto.indexOf(`@media ${prefijo}`);

  while (inicio !== -1) {
    const bloque = bloqueDesde(resto, inicio);

    bloques.push(bloque);
    resto = resto.slice(0, inicio) + resto.slice(inicio + bloque.length);
    inicio = resto.indexOf(`@media ${prefijo}`);
  }

  return { bloques, resto };
}

const { bloques: SIN_MOVIMIENTO, resto: FUERA_DE_SIN_MOVIMIENTO } = mediosQue(
  '(prefers-reduced-motion: reduce)',
);

/** Sin saltos de linea ni espacios de mas: prettier parte los `:is(...)` largos en varias lineas. */
function plano(texto: string): string {
  return texto.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

const SIN_MOVIMIENTO_TEXTO = plano(SIN_MOVIMIENTO.join('\n'));

/** Las reglas `selector { cuerpo }`, sin las de dentro de un `@keyframes` (`0%`, `from`, `to`). */
function reglasDe(texto: string): { selector: string; cuerpo: string }[] {
  const sinCuadros = texto.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

  return [...sinCuadros.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, selector, cuerpo]) => ({
    selector: plano(selector!),
    cuerpo: cuerpo!,
  }));
}

function regla(selector: string): string {
  const unica = reglasDe(HOJA).find((r) => r.selector === selector);

  if (unica === undefined) {
    throw new Error(`No hay una regla ${selector}`);
  }

  return unica.cuerpo;
}

describe('panelVivo.css', () => {
  it('no tiene colores propios: todo sale de los tokens, y asi sirve a los dos temas', () => {
    expect(HOJA).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  describe('lo que se mueve solo', () => {
    const CUADROS = [...HOJA.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].map((m) => ({
      nombre: m[1]!,
      texto: bloqueDesde(HOJA, m.index),
    }));

    it('hay movimientos propios', () => {
      expect(CUADROS.length).toBeGreaterThanOrEqual(6);
    });

    it.each(CUADROS)('$nombre solo anima transform y opacity: lo barato de pintar', ({ texto }) => {
      const propiedades = [...texto.matchAll(/(?:^|[{;\s])([a-z-]+)\s*:/g)].map((m) => m[1]!);

      for (const propiedad of propiedades) {
        expect(['transform', 'opacity'], propiedad).toContain(propiedad);
      }
    });

    it('todo lo que anima por su cuenta se apaga con «reducir movimiento»', () => {
      const animados = reglasDe(FUERA_DE_SIN_MOVIMIENTO).filter(({ cuerpo }) =>
        /(?:^|[\s;])animation:/.test(cuerpo),
      );

      expect(animados.length).toBeGreaterThanOrEqual(8);

      for (const { selector } of animados) {
        for (const parte of selector.split(',').map((s) => s.trim())) {
          expect(SIN_MOVIMIENTO_TEXTO, `${parte} sigue animado`).toContain(parte);
        }
      }

      expect(SIN_MOVIMIENTO_TEXTO).toMatch(/animation:\s*none/);
    });

    it('cada modulo se mueve a lo suyo: tres movimientos distintos', () => {
      const nombres = ['bienestar', 'cognicion', 'emociones'].map(
        (modulo) => /animation:\s*([\w-]+)/.exec(regla(`.mapa-fondo--${modulo} svg`))?.[1],
      );

      expect(nombres.every((nombre) => nombre !== undefined)).toBe(true);
      expect(new Set(nombres).size).toBe(3);
    });
  });

  describe('el fondo del mapa', () => {
    it('es adorno: no recibe toques y queda detras de la ventana que se desplaza', () => {
      const fondo = regla('.mapa-fondo');

      expect(fondo).toMatch(/position:\s*absolute/);
      expect(fondo).toMatch(/pointer-events:\s*none/);
      expect(fondo).toMatch(/z-index:\s*0/);
      expect(regla('.mapa__escena .mapa__ventana')).toMatch(/z-index:\s*1/);
      expect(regla('.mapa__escena .mapa__ventana')).toMatch(/background:\s*transparent/);
    });

    it('lo que sube se recorta en la escena y no estira la pagina', () => {
      expect(regla('.mapa__escena')).toMatch(/overflow:\s*hidden/);
    });
  });

  describe('los puntos del arbol', () => {
    it('ningun punto toca `transform`: la fila ya lo usa para el zigzag y se perderia', () => {
      const puntos = reglasDe(HOJA).filter(
        ({ selector }) =>
          /\.sendero__punto|\.mapa__punto-hecho/.test(selector) &&
          !/\bsvg\b|::after/.test(selector),
      );

      expect(puntos.length).toBeGreaterThanOrEqual(3);

      for (const { selector, cuerpo } of puntos) {
        expect(cuerpo, selector).not.toMatch(/(?:^|[\s;])transform:/);
      }
    });

    it('al pasar el cursor un dia hecho crece un 15 %, y solo donde hay cursor', () => {
      const conCursor = mediosQue('(hover: hover) and (pointer: fine)').bloques.join('\n');

      expect(conCursor).toMatch(/\.mapa__punto-hecho:hover[^{]*\{[^}]*scale:\s*1\.15/);
      expect(
        mediosQue('(hover: hover) and (pointer: fine)', FUERA_DE_SIN_MOVIMIENTO).resto,
      ).not.toMatch(/:hover/);
      // El `:hover` sin escala de «reducir movimiento» tambien vale solo con cursor.
      expect(SIN_MOVIMIENTO.some((b) => b.split('{')[0]!.includes('(hover: hover)'))).toBe(true);
    });

    it('al pulsarlo o enfocarlo con el teclado tambien responde, con `scale`', () => {
      expect(HOJA).toMatch(/\.mapa__punto-hecho:focus-visible[^{]*\{[^}]*scale:\s*1\.1\b/);
      expect(HOJA).toMatch(/\.mapa__punto-hecho:active[^{]*\{[^}]*scale:\s*0\.95/);
    });

    it('con «reducir movimiento» no hay escala, ni al pasar, ni al pulsar, ni al enfocar', () => {
      expect(SIN_MOVIMIENTO_TEXTO).toMatch(/:active[^{]*\{ scale: none/);
      expect(SIN_MOVIMIENTO_TEXTO).toMatch(/:hover[^{]*\{ scale: none/);
      expect(SIN_MOVIMIENTO_TEXTO).toMatch(/:focus-visible[^{]*\{ scale: none/);
      expect(SIN_MOVIMIENTO_TEXTO).not.toMatch(/scale:\s*\d/);
    });
  });

  describe('las cajas con relieve', () => {
    const CAJAS = [
      ':root .ruta, :root .app__avance',
      ':root .app__recomendado',
      ':root :is(.acordeon-modulo, .tarjeta-modulo:not(.tarjeta-modulo--por-activar))',
    ];

    it.each(CAJAS)(
      '%s lleva borde degradado de 1,5 px, con tokens, y sombra en capas',
      (selector) => {
        const cuerpo = plano(regla(selector));

        expect(cuerpo).toMatch(/border:\s*1\.5px solid transparent/);
        expect(cuerpo).toMatch(/linear-gradient\(135deg[^;]*border-box/);
        expect(cuerpo).toMatch(/padding-box/);
        expect(cuerpo).toMatch(/box-shadow:[^;]*,/);
        expect(cuerpo).toMatch(/var\(--app-[a-z-]+\)|var\(--modulo-[a-z]+\)/);
      },
    );

    it('la tarjeta de un modulo conserva su salto de 3 px al pasar el cursor, con sombra de color', () => {
      const conCursor = mediosQue('(hover: hover) and (pointer: fine)').bloques.join('\n');

      expect(conCursor).toMatch(/\.tarjeta-modulo:hover[^{]*\{[^}]*box-shadow:/);
    });
  });

  describe('las clases que nombra', () => {
    const NUEVAS = new Set([
      'mapa__escena',
      'sendero__punto--hito',
      'mapa-fondo',
      'mapa-fondo--bienestar',
      'mapa-fondo--cognicion',
      'mapa-fondo--emociones',
      'mapa-fondo__mancha',
      'mapa-fondo__forma',
    ]);

    const CLASES = [...new Set([...HOJA.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]!))];

    it('nombra las nuevas y las que ya existian', () => {
      expect(CLASES).toEqual(
        expect.arrayContaining(['mapa-fondo', 'sendero__punto--hito', 'ruta', 'tarjeta-modulo']),
      );
    });

    it.each(CLASES.filter((clase) => !NUEVAS.has(clase)))(
      'la clase .%s ya existe en otra hoja',
      (clase) => {
        const existe = Object.entries(OTRAS_HOJAS).some(
          ([ruta, hoja]) =>
            !ruta.endsWith('panelVivo.css') &&
            new RegExp(String.raw`\.${clase}(?![\w-])`).test(hoja),
        );

        expect(existe, `.${clase} no esta en ninguna otra hoja`).toBe(true);
      },
    );
  });
});
