import { describe, expect, it } from 'vitest';

import {
  mascotaParaMostrar,
  PERSONAJES,
  PERSONAJES_EN_ORDEN,
  type Expresion,
} from './personajes.ts';
import { sprite } from './sprites.ts';

const EXPRESIONES: readonly Expresion[] = ['normal', 'feliz', 'celebrando', 'dormida'];

describe('los personajes', () => {
  it('son seis, y cada uno tiene sus cuatro dibujos', () => {
    expect(PERSONAJES_EN_ORDEN).toHaveLength(6);

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
    expect(mascotaParaMostrar(null)).toEqual({ personaje: 'fungito', nombre: 'Fungito' });
  });

  it('dibuja el personaje guardado con el nombre que le pusieron', () => {
    expect(mascotaParaMostrar({ forma: 'obsidian', nombre: 'Roca' })).toEqual({
      personaje: 'obsidian',
      nombre: 'Roca',
    });
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
    ).toEqual({ personaje: 'fungito', nombre: 'Luma' });
  });
});
