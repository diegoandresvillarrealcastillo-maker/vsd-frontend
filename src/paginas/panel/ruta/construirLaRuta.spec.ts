import { describe, expect, it } from 'vitest';

import type { ProgresoDelModulo } from '../../../infraestructura/api/progreso.ts';
import { construirLaRuta, desplazamientoDelNodo } from './construirLaRuta.ts';

function modulo(
  nombre: ProgresoDelModulo['modulo'],
  hoy: readonly { id: string; hecha: boolean }[],
): ProgresoDelModulo {
  return {
    modulo: nombre,
    sesiones: 3,
    etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
    hoy: hoy.map((una) => ({ id: una.id, nombre: `Actividad ${una.id}`, hecha: una.hecha })),
  };
}

describe('construirLaRuta', () => {
  it('sin actividades hoy no hay tramos ni plan completo', () => {
    const ruta = construirLaRuta([modulo('bienestar', [])]);

    expect(ruta).toEqual({
      tramos: [],
      nodos: [],
      siguiente: undefined,
      idsHechos: [],
      hechas: 0,
      total: 0,
      planCompleto: false,
    });
  });

  it('la primera sin hacer es la siguiente, y las demas quedan pendientes', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [
        { id: 'a', hecha: true },
        { id: 'b', hecha: false },
      ]),
      modulo('bienestar', [{ id: 'c', hecha: false }]),
    ]);

    expect(ruta.tramos.flatMap((tramo) => tramo.nodos.map((nodo) => nodo.estado))).toEqual([
      'hecha',
      'siguiente',
      'pendiente',
    ]);
    expect(ruta.hechas).toBe(1);
    expect(ruta.total).toBe(3);
    expect(ruta.planCompleto).toBe(false);
  });

  it('respeta el orden del servidor y agrupa por modulo', () => {
    const ruta = construirLaRuta([
      modulo('emociones', [{ id: 'x', hecha: false }]),
      modulo('cognicion', [{ id: 'y', hecha: false }]),
    ]);

    expect(ruta.tramos.map((tramo) => tramo.progreso.modulo)).toEqual(['emociones', 'cognicion']);
  });

  it('un modulo sin actividades hoy no abre un tramo vacio', () => {
    const ruta = construirLaRuta([
      modulo('bienestar', []),
      modulo('cognicion', [{ id: 'a', hecha: false }]),
    ]);

    expect(ruta.tramos).toHaveLength(1);
    expect(ruta.tramos[0]?.progreso.modulo).toBe('cognicion');
  });

  it('con todo hecho el plan esta completo y no queda ninguna siguiente', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [
        { id: 'a', hecha: true },
        { id: 'b', hecha: true },
      ]),
    ]);

    expect(ruta.planCompleto).toBe(true);
    expect(ruta.tramos.flatMap((tramo) => tramo.nodos).some((n) => n.estado === 'siguiente')).toBe(
      false,
    );
  });

  it('cada nodo sabe su lugar en todo el camino, a traves de los modulos', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [
        { id: 'a', hecha: true },
        { id: 'b', hecha: false },
      ]),
      modulo('bienestar', [{ id: 'c', hecha: false }]),
    ]);

    expect(ruta.nodos.map((nodo) => nodo.indice)).toEqual([0, 1, 2]);
    expect(ruta.siguiente?.actividad.id).toBe('b');
    expect(ruta.idsHechos).toEqual(['a']);
  });

  it('cada actividad conserva su modulo', () => {
    const ruta = construirLaRuta([modulo('bienestar', [{ id: 'a', hecha: false }])]);

    expect(ruta.tramos[0]?.nodos[0]?.modulo).toBe('bienestar');
  });
});

describe('desplazamientoDelNodo', () => {
  it('el primer punto queda centrado y el camino serpentea a los dos lados', () => {
    const desplazamientos = Array.from({ length: 8 }, (_, i) => desplazamientoDelNodo(i));

    expect(desplazamientos[0]).toBe(0);
    expect(desplazamientos.some((valor) => valor > 0)).toBe(true);
    expect(desplazamientos.some((valor) => valor < 0)).toBe(true);
  });

  it('ninguno se sale de lo que cabe en una pantalla de movil', () => {
    for (let i = 0; i < 60; i += 1) {
      expect(Math.abs(desplazamientoDelNodo(i))).toBeLessThanOrEqual(68);
    }
  });
});
