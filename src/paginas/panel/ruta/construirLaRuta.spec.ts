import { describe, expect, it } from 'vitest';

import type { ProgresoDelModulo } from '../../../infraestructura/api/progreso.ts';
import { construirLaRuta, META_DEL_DIA } from './construirLaRuta.ts';

function modulo(
  nombre: ProgresoDelModulo['modulo'],
  hoy: readonly { id: string; hecha: boolean }[],
  sugeridas: readonly string[] = [],
): ProgresoDelModulo {
  return {
    modulo: nombre,
    sesiones: 3,
    etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
    hoy: hoy.map((una) => ({ id: una.id, nombre: `Actividad ${una.id}`, hecha: una.hecha })),
    sugeridas: sugeridas.map((id) => ({ id, nombre: `Actividad ${id}`, hecha: false })),
  };
}

function ids(actividades: readonly { id: string }[] | undefined): string[] {
  return (actividades ?? []).map((una) => una.id);
}

describe('construirLaRuta', () => {
  it('sin actividades hoy no hay nodos, pero el modulo activo sigue en la ruta', () => {
    const ruta = construirLaRuta([modulo('bienestar', [])]);

    expect(ruta.modulos.map((uno) => uno.modulo)).toEqual(['bienestar']);
    expect(ruta.nodos).toEqual([]);
    expect(ruta).toMatchObject({
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

    expect(ruta.nodos.map((nodo) => nodo.estado)).toEqual(['hecha', 'siguiente', 'pendiente']);
    expect(ruta.hechas).toBe(1);
    expect(ruta.total).toBe(3);
    expect(ruta.planCompleto).toBe(false);
  });

  it('respeta el orden del servidor entre modulos', () => {
    const ruta = construirLaRuta([
      modulo('emociones', [{ id: 'x', hecha: false }]),
      modulo('cognicion', [{ id: 'y', hecha: false }]),
    ]);

    expect(ruta.modulos.map((uno) => uno.modulo)).toEqual(['emociones', 'cognicion']);
    expect(ruta.siguiente?.actividad.id).toBe('x');
  });

  it('con todo hecho el plan esta completo y no queda ninguna siguiente', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [
        { id: 'a', hecha: true },
        { id: 'b', hecha: true },
      ]),
    ]);

    expect(ruta.planCompleto).toBe(true);
    expect(ruta.siguiente).toBeUndefined();
  });

  it('cada actividad conserva su modulo', () => {
    const ruta = construirLaRuta([modulo('bienestar', [{ id: 'a', hecha: false }])]);

    expect(ruta.nodos[0]?.modulo).toBe('bienestar');
  });

  it('lo hecho se cuenta aparte de lo que falta', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [
        { id: 'a', hecha: true },
        { id: 'b', hecha: false },
      ]),
    ]);

    expect(ruta.idsHechos).toEqual(['a']);
  });
});

describe('construirLaRuta: la meta del dia son unas tres actividades', () => {
  const seis = (prefijo: string) =>
    Array.from({ length: 6 }, (_, i) => ({ id: `${prefijo}${i + 1}`, hecha: false }));

  it('la meta es de tres', () => {
    expect(META_DEL_DIA).toBe(3);
  });

  it('con tres modulos toca una de cada uno, no las dieciocho', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', seis('c')),
      modulo('bienestar', seis('b')),
      modulo('emociones', seis('e')),
    ]);

    expect(ruta.total).toBe(3);
    expect(ids(ruta.nodos.map((nodo) => nodo.actividad))).toEqual(['c1', 'b1', 'e1']);
    expect(ruta.siguiente?.actividad.id).toBe('c1');
  });

  it('con un solo modulo tocan tres de ese', () => {
    const ruta = construirLaRuta([modulo('cognicion', seis('c'))]);

    expect(ids(ruta.modulos[0]?.hoy)).toEqual(['c1', 'c2', 'c3']);
    expect(ruta.total).toBe(3);
  });

  it('con dos modulos se reparte de a una por vuelta', () => {
    const ruta = construirLaRuta([modulo('cognicion', seis('c')), modulo('bienestar', seis('b'))]);

    expect(ids(ruta.modulos[0]?.hoy)).toEqual(['c1', 'c2']);
    expect(ids(ruta.modulos[1]?.hoy)).toEqual(['b1']);
  });

  it('un modulo con poco no deja huecos: lo que sobra lo toma el otro', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [{ id: 'c1', hecha: false }]),
      modulo('bienestar', seis('b')),
    ]);

    expect(ids(ruta.modulos[0]?.hoy)).toEqual(['c1']);
    expect(ids(ruta.modulos[1]?.hoy)).toEqual(['b1', 'b2']);
  });

  it('lo ya hecho entra primero: hacer una actividad no cambia cual es la de cada modulo', () => {
    const antes = construirLaRuta([modulo('cognicion', seis('c')), modulo('bienestar', seis('b'))]);
    const despues = construirLaRuta([
      modulo(
        'cognicion',
        seis('c').map((una) => (una.id === 'c1' ? { ...una, hecha: true } : una)),
      ),
      modulo('bienestar', seis('b')),
    ]);

    expect(ids(despues.modulos[0]?.hoy)).toEqual(ids(antes.modulos[0]?.hoy));
    expect(despues.hechas).toBe(1);
    expect(despues.total).toBe(3);
  });

  it('lo que no entra en la meta no se pierde: pasa a las sugeridas', () => {
    const ruta = construirLaRuta([modulo('cognicion', seis('c'), ['x'])]);

    expect(ids(ruta.modulos[0]?.sugeridas)).toEqual(['c4', 'c5', 'c6', 'x']);
  });

  it('con las tres hechas el plan esta completo aunque el servidor tenga mas', () => {
    const ruta = construirLaRuta([
      modulo(
        'cognicion',
        seis('c').map((una, i) => ({ ...una, hecha: i < 3 })),
      ),
    ]);

    expect(ruta.planCompleto).toBe(true);
    expect(ruta.siguiente).toBeUndefined();
  });

  it('una sola hecha ya cuenta, aunque falten dos', () => {
    const ruta = construirLaRuta([
      modulo('cognicion', [{ id: 'c1', hecha: true }, ...seis('c').slice(1)]),
      modulo('bienestar', seis('b')),
    ]);

    expect(ruta.hechas).toBe(1);
    expect(ruta.planCompleto).toBe(false);
  });
});
