import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import {
  elegirFrase,
  frasesDelMomento,
  momentoDeLaFrase,
  reiniciarLasFrases,
  siguienteFrase,
} from './bancoDeFrases.ts';
import { FRASES_POR_MOMENTO, MOMENTOS } from './frasesDeLaMascota.ts';
import { PERSONAJES } from './personajes.ts';

/**
 * Cual frase sale y en que orden (SCRUM-129): al azar, sin repetir ninguna hasta
 * agotar todas las del momento.
 */

/** Un generador con semilla: el azar de las pruebas tiene que ser repetible. */
function conSemilla(semilla: number): () => number {
  let estado = semilla;

  return () => {
    estado = (estado + 0x6d2b79f5) | 0;

    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  reiniciarLasFrases();
});

afterEach(() => {
  vi.restoreAllMocks();
  reiniciarLasFrases();
});

describe('frasesDelMomento', () => {
  it('un momento suma las suyas y las generales', () => {
    const frases = frasesDelMomento('noche');

    expect(frases).toEqual([...FRASES_POR_MOMENTO.noche, ...FRASES_POR_MOMENTO.general]);
  });

  it('las propias de un personaje solo entran en el momento general', () => {
    const propias = PERSONAJES.sparky.frases;

    expect(frasesDelMomento('general', propias)).toEqual([
      ...FRASES_POR_MOMENTO.general,
      ...propias,
    ]);

    for (const momento of MOMENTOS.filter((otro) => otro !== 'general')) {
      expect(frasesDelMomento(momento, propias)).not.toContain(propias[0]);
    }
  });

  it.each(MOMENTOS)('en «%s» ninguna frase esta dos veces', (momento) => {
    const frases = frasesDelMomento(momento, PERSONAJES.fungito.frases);

    expect(new Set(frases).size).toBe(frases.length);
  });
});

describe('elegirFrase', () => {
  const OPCIONES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

  /** Saca `veces` frases seguidas, guardando lo dicho entre una y otra. */
  function sacar(veces: number, aleatorio: () => number, opciones: readonly string[] = OPCIONES) {
    let dichas: readonly string[] = [];
    const salidas: string[] = [];

    for (let i = 0; i < veces; i += 1) {
      const elegida = elegirFrase(opciones, dichas, aleatorio);

      salidas.push(elegida.frase);
      dichas = elegida.dichas;
    }

    return salidas;
  }

  it('no repite ninguna hasta agotar todas', () => {
    for (let semilla = 1; semilla <= 50; semilla += 1) {
      const vuelta = sacar(OPCIONES.length, conSemilla(semilla));

      expect([...vuelta].sort()).toEqual([...OPCIONES]);
    }
  });

  it('cada vuelta completa trae todas, una vez cada una', () => {
    const salidas = sacar(OPCIONES.length * 4, conSemilla(7));

    for (let vuelta = 0; vuelta < 4; vuelta += 1) {
      const tramo = salidas.slice(vuelta * OPCIONES.length, (vuelta + 1) * OPCIONES.length);

      expect([...tramo].sort()).toEqual([...OPCIONES]);
    }
  });

  it('al empezar otra vuelta no repite justo la ultima que se dijo', () => {
    for (let semilla = 1; semilla <= 200; semilla += 1) {
      const salidas = sacar(OPCIONES.length * 3, conSemilla(semilla));

      for (let i = 1; i < salidas.length; i += 1) {
        expect(salidas[i], `semilla ${semilla}, posicion ${i}`).not.toBe(salidas[i - 1]);
      }
    }
  });

  it('no sale siempre en el mismo orden', () => {
    const ordenes = new Set(
      Array.from({ length: 30 }, (_valor, semilla) =>
        sacar(OPCIONES.length, conSemilla(semilla + 1)).join(''),
      ),
    );

    expect(ordenes.size).toBeGreaterThan(10);
  });

  it('con una sola opcion, la repite y no se cuelga', () => {
    expect(sacar(3, conSemilla(1), ['unica'])).toEqual(['unica', 'unica', 'unica']);
  });

  it('con dos opciones, se van alternando', () => {
    const salidas = sacar(6, conSemilla(3), ['x', 'y']);

    expect(salidas.slice(0, 2).sort()).toEqual(['x', 'y']);
    expect(salidas[2]).not.toBe(salidas[1]);
  });

  it('ignora lo dicho que ya no esta entre las opciones', () => {
    // Una frase de otro personaje, o de una version anterior del banco.
    const { frase, dichas } = elegirFrase(['a', 'b'], ['ya-no-existe', 'a'], conSemilla(1));

    expect(frase).toBe('b');
    expect(dichas).toEqual(['a', 'b']);
  });

  it('aguanta un azar en los extremos: 0, 0.999… y hasta 1', () => {
    for (const valor of [0, 0.5, 0.9999999, 1]) {
      const { frase } = elegirFrase(OPCIONES, [], () => valor);

      expect(OPCIONES).toContain(frase);
    }
  });

  it('con el azar siempre en cero, recorre todas igual', () => {
    // Un azar roto no puede dejar frases sin salir ni repetir una.
    expect([...sacar(OPCIONES.length, () => 0)].sort()).toEqual([...OPCIONES]);
  });
});

describe('siguienteFrase', () => {
  it('recorre todas las de un momento sin repetir ninguna, y despues empieza otra vuelta', () => {
    const aleatorio = conSemilla(11);
    const total = frasesDelMomento('noche').length;

    const vuelta = Array.from({ length: total }, () => siguienteFrase('noche', [], aleatorio));

    expect(new Set(vuelta).size).toBe(total);
    expect([...vuelta].sort()).toEqual([...frasesDelMomento('noche')].sort());

    const siguiente = siguienteFrase('noche', [], aleatorio);

    expect(frasesDelMomento('noche')).toContain(siguiente);
    expect(siguiente).not.toBe(vuelta[vuelta.length - 1]);
  });

  it('cada momento lleva su propia cuenta', () => {
    const aleatorio = conSemilla(5);
    const total = frasesDelMomento('manana').length;

    // Agotar la manana no gasta las del diario.
    for (let i = 0; i < total; i += 1) {
      siguienteFrase('manana', [], aleatorio);
    }

    const delDiario = Array.from({ length: frasesDelMomento('diario').length }, () =>
      siguienteFrase('diario', [], aleatorio),
    );

    expect(new Set(delDiario).size).toBe(frasesDelMomento('diario').length);
  });

  it('las propias del personaje salen en el momento general', () => {
    const propias = PERSONAJES.obsidian.frases;
    const total = frasesDelMomento('general', propias).length;
    const salidas = Array.from({ length: total }, () =>
      siguienteFrase('general', propias, conSemilla(2)),
    );

    for (const propia of propias) {
      expect(salidas).toContain(propia);
    }
  });

  describe('lo dicho se recuerda entre visitas', () => {
    it('queda guardado en el navegador, sin nada de la persona', () => {
      siguienteFrase('manana', [], conSemilla(1));

      const guardado = JSON.parse(localStorage.getItem('vsd-h:mascota-frases') ?? '{}') as {
        manana?: string[];
      };

      expect(Object.keys(guardado)).toEqual(['manana']);
      expect(guardado.manana).toHaveLength(1);
      expect(frasesDelMomento('manana')).toContain(guardado.manana?.[0]);
    });

    it('al volver (pagina nueva, misma memoria del navegador) no repite lo ya dicho', () => {
      const aleatorio = conSemilla(21);
      const total = frasesDelMomento('racha').length;
      const primera = Array.from({ length: 10 }, () => siguienteFrase('racha', [], aleatorio));

      // Una visita nueva no tiene nada en memoria: solo lo que quedo guardado.
      const resto = Array.from({ length: total - 10 }, () =>
        siguienteFrase('racha', [], aleatorio),
      );

      expect(new Set([...primera, ...resto]).size).toBe(total);
    });

    it('un guardado roto o ajeno se ignora, y no rompe nada', () => {
      for (const roto of ['no es json', '[1,2,3]', '"hola"', 'null', '{"manana":[1,2]}']) {
        localStorage.setItem('vsd-h:mascota-frases', roto);

        expect(frasesDelMomento('manana')).toContain(siguienteFrase('manana', [], conSemilla(1)));
      }
    });

    it('lo guardado de un banco anterior no cuenta: lo que ya no existe se ignora', () => {
      localStorage.setItem(
        'vsd-h:mascota-frases',
        JSON.stringify({ manana: ['una frase que ya no esta', 'otra que tampoco'] }),
      );

      const salida = siguienteFrase('manana', [], conSemilla(1));

      expect(frasesDelMomento('manana')).toContain(salida);
    });

    it('sin almacenamiento, el orden vale mientras dure la pestana', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Sin almacenamiento');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Sin almacenamiento');
      });

      const aleatorio = conSemilla(8);
      const total = frasesDelMomento('actividad').length;
      const vuelta = Array.from({ length: total }, () =>
        siguienteFrase('actividad', [], aleatorio),
      );

      expect(new Set(vuelta).size).toBe(total);
    });
  });
});

describe('momentoDeLaFrase', () => {
  /** La hora de Bogota, que son las de las pruebas: 05:00 alli son las 10:00 UTC. */
  const aLas = (hora: number, minuto = 0) => new Date(Date.UTC(2026, 9, 3, hora + 5, minuto));

  it.each([
    [0, 'noche'],
    [4, 'noche'],
    [5, 'manana'],
    [8, 'manana'],
    [11, 'manana'],
    [12, 'general'],
    [15, 'general'],
    [19, 'general'],
    [20, 'noche'],
    [23, 'noche'],
  ])('a las %i:00 es «%s»', (hora, esperado) => {
    expect(momentoDeLaFrase(undefined, aLas(hora))).toBe(esperado);
  });

  it('los limites: 4:59 aun es noche y 11:59 aun es manana', () => {
    expect(momentoDeLaFrase(undefined, aLas(4, 59))).toBe('noche');
    expect(momentoDeLaFrase(undefined, aLas(11, 59))).toBe('manana');
    expect(momentoDeLaFrase(undefined, aLas(19, 59))).toBe('general');
  });

  it.each(['actividad', 'racha', 'diario'] as const)(
    'si la pantalla pide «%s», gana a la hora',
    (pedido) => {
      expect(momentoDeLaFrase(pedido, aLas(8))).toBe(pedido);
      expect(momentoDeLaFrase(pedido, aLas(23))).toBe(pedido);
    },
  );

  it('pedir «general» deja que mande la hora', () => {
    expect(momentoDeLaFrase('general', aLas(8))).toBe('manana');
  });

  it('la hora es la de la zona de la persona, no la del servidor ni la de UTC', () => {
    // El mismo instante: 07:00 en Bogota (manana), 21:00 en Tokio (noche).
    const instante = aLas(7);

    expect(momentoDeLaFrase(undefined, instante)).toBe('manana');

    fijarLaZonaDeLaCuenta('Asia/Tokyo');

    expect(momentoDeLaFrase(undefined, instante)).toBe('noche');
  });
});
