import { describe, expect, it } from 'vitest';

import {
  esPersonaje,
  FORMA_DE_LA_MASCOTA_PROPIA,
  mascotaParaMostrar,
  nombreAlElegir,
  nombreDeFabrica,
  NOMBRE_DE_LA_MASCOTA_PROPIA,
  PERSONAJE_POR_DEFECTO,
  PERSONAJES,
  PERSONAJES_EN_ORDEN,
  type Expresion,
} from './personajes.ts';
import { sprite } from './sprites.ts';

const EXPRESIONES: readonly Expresion[] = ['normal', 'feliz', 'celebrando', 'dormida'];

describe('los personajes', () => {
  it('son cinco, y cada uno tiene sus cuatro dibujos', () => {
    expect(PERSONAJES_EN_ORDEN).toEqual(['fungito', 'sparky', 'ori', 'gato', 'obsidian']);

    for (const personaje of PERSONAJES_EN_ORDEN) {
      for (const expresion of EXPRESIONES) {
        expect(sprite(personaje, expresion), `${personaje}-${expresion}`).toMatch(
          new RegExp(`${personaje}-${expresion}.*\\.webp`),
        );
      }
    }
  });

  it('cada uno trae frases propias y ninguna se repite entre personajes', () => {
    const todas = PERSONAJES_EN_ORDEN.flatMap((personaje) => PERSONAJES[personaje].frases);

    for (const personaje of PERSONAJES_EN_ORDEN) {
      expect(PERSONAJES[personaje].frases.length).toBeGreaterThanOrEqual(3);
    }

    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe('mascotaParaMostrar', () => {
  it('sin mascota guardada, acompaña Fungito', () => {
    expect(mascotaParaMostrar(null)).toEqual({
      personaje: 'fungito',
      nombre: 'Fungito',
      propia: false,
    });
  });

  it('dibuja el personaje guardado con el nombre que le pusieron', () => {
    expect(mascotaParaMostrar({ forma: 'obsidian', nombre: 'Roca' })).toEqual({
      personaje: 'obsidian',
      nombre: 'Roca',
      propia: false,
    });
  });

  it('quien todavia tiene guardada a Trama (SCRUM-121) ve a Fungito, con su nombre', () => {
    // Pasa entre que se despliega este cambio y se aplica la migracion que la
    // pasa a Fungito, o con una cuenta que la guardo desde otro dispositivo.
    expect(mascotaParaMostrar({ forma: 'trama', nombre: 'Hilo' })).toEqual({
      personaje: 'fungito',
      nombre: 'Hilo',
      propia: false,
    });
    expect(esPersonaje('trama')).toBe(false);
  });

  it('una forma que no conoce se dibuja como Fungito, pero conserva el nombre', () => {
    // Una mascota del modelo anterior, o un personaje que llegue despues.
    expect(
      mascotaParaMostrar({
        forma: 'brote',
        color: '#a2d9b6',
        accesorio: 'ninguno',
        nombre: 'Luma',
      }),
    ).toEqual({ personaje: 'fungito', nombre: 'Luma', propia: false });
  });

  describe('la mascota propia (SCRUM-122)', () => {
    it('la forma propia dice que es la propia, y conserva el nombre', () => {
      expect(mascotaParaMostrar({ forma: 'propia', nombre: 'Luma' })).toEqual({
        personaje: 'fungito',
        nombre: 'Luma',
        propia: true,
      });
    });

    it('mientras no llega su dibujo, el personaje que se pinta es Fungito', () => {
      expect(mascotaParaMostrar({ forma: 'propia', nombre: 'Luma' }).personaje).toBe(
        PERSONAJE_POR_DEFECTO,
      );
    });

    it('no es un personaje de la lista: no tiene sprites ni frases', () => {
      expect(esPersonaje(FORMA_DE_LA_MASCOTA_PROPIA)).toBe(false);
      expect(PERSONAJES_EN_ORDEN).not.toContain(FORMA_DE_LA_MASCOTA_PROPIA);
    });

    it('solo la forma exacta es la propia', () => {
      for (const forma of ['Propia', 'propia ', 'propias', 'mia', 'fungito']) {
        expect(mascotaParaMostrar({ forma, nombre: 'X' }).propia).toBe(false);
      }
    });

    it('el nombre con el que llega es «Mi mascota»', () => {
      expect(NOMBRE_DE_LA_MASCOTA_PROPIA).toBe('Mi mascota');
    });
  });
});

describe('nombreDeFabrica', () => {
  it('cada personaje llega con su nombre', () => {
    for (const id of PERSONAJES_EN_ORDEN) {
      expect(nombreDeFabrica(id)).toBe(PERSONAJES[id].nombre);
    }
  });

  it('la mascota propia llega como «Mi mascota»', () => {
    expect(nombreDeFabrica(FORMA_DE_LA_MASCOTA_PROPIA)).toBe('Mi mascota');
  });
});

describe('nombreAlElegir', () => {
  it('con el nombre de fabrica de la que tenia, cambia con la mascota', () => {
    expect(nombreAlElegir('Fungito', 'fungito', 'sparky')).toBe('Sparky');
    expect(nombreAlElegir('Fungito', 'fungito', FORMA_DE_LA_MASCOTA_PROPIA)).toBe('Mi mascota');
    expect(nombreAlElegir('Mi mascota', FORMA_DE_LA_MASCOTA_PROPIA, 'ori')).toBe('Ori');
  });

  it('con el nombre vacio o en blanco, tambien', () => {
    expect(nombreAlElegir('', 'fungito', 'gato')).toBe('Ojo de Gato');
    expect(nombreAlElegir('   ', 'ori', 'obsidian')).toBe('Obsidian');
  });

  it('con un nombre que le puso la persona, se respeta tal cual', () => {
    expect(nombreAlElegir('Luma', 'fungito', 'sparky')).toBe('Luma');
    expect(nombreAlElegir(' Luma ', 'fungito', FORMA_DE_LA_MASCOTA_PROPIA)).toBe(' Luma ');
  });

  it('el nombre de fabrica de otra mascota, no el de la que tenia, tambien se respeta', () => {
    // Quien le puso «Sparky» a Fungito lo eligio: no se le cambia.
    expect(nombreAlElegir('Sparky', 'fungito', 'ori')).toBe('Sparky');
  });

  it('se compara sin los espacios de los lados', () => {
    expect(nombreAlElegir('  Fungito ', 'fungito', 'sparky')).toBe('Sparky');
  });
});
