import { describe, expect, it } from 'vitest';

import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { siguienteActividad } from './siguienteActividad.ts';

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

describe('siguienteActividad', () => {
  it('primero lo que falta en el mismo modulo, sin cambiar de modulo', () => {
    const siguiente = siguienteActividad(
      [
        modulo('cognicion', [
          { id: 'a', hecha: true },
          { id: 'b', hecha: false },
        ]),
        modulo('bienestar', [{ id: 'c', hecha: false }]),
      ],
      'a',
    );

    expect(siguiente).toEqual({
      id: 'b',
      nombre: 'Actividad b',
      modulo: 'cognicion',
      cambiaDeModulo: false,
    });
  });

  it('si ese modulo ya no tiene nada, pasa al que le sigue y lo dice', () => {
    const siguiente = siguienteActividad(
      [
        modulo('cognicion', [{ id: 'a', hecha: false }]),
        modulo('bienestar', [{ id: 'b', hecha: true }]),
        modulo('emociones', [{ id: 'c', hecha: false }]),
      ],
      'b',
    );

    // Tras bienestar viene emociones, no cognicion (que esta antes).
    expect(siguiente).toMatchObject({ id: 'c', modulo: 'emociones', cambiaDeModulo: true });
  });

  it('despues del ultimo modulo da la vuelta al primero', () => {
    const siguiente = siguienteActividad(
      [
        modulo('cognicion', [{ id: 'a', hecha: false }]),
        modulo('bienestar', [{ id: 'b', hecha: true }]),
      ],
      'b',
    );

    expect(siguiente).toMatchObject({ id: 'a', modulo: 'cognicion', cambiaDeModulo: true });
  });

  it('con todo hecho no hay siguiente', () => {
    const siguiente = siguienteActividad(
      [
        modulo('cognicion', [{ id: 'a', hecha: true }]),
        modulo('bienestar', [{ id: 'b', hecha: true }]),
      ],
      'b',
    );

    expect(siguiente).toBeUndefined();
  });

  it('no repite la que se acaba de hacer aunque la copia la tenga todavia pendiente', () => {
    const siguiente = siguienteActividad(
      [
        modulo('cognicion', [
          { id: 'a', hecha: false },
          { id: 'b', hecha: false },
        ]),
      ],
      'a',
    );

    expect(siguiente).toMatchObject({ id: 'b' });
  });

  it('sigue la misma meta del dia que el panel: tres, no todo lo que manda el servidor', () => {
    const hoy = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, hecha: id <= 'c' }));
    const siguiente = siguienteActividad([modulo('cognicion', hoy)], 'a');

    // La meta son a, b y c, y las tres estan hechas: d, e y f son sugerencias, no «siguiente».
    expect(siguiente).toBeUndefined();
  });

  it('una actividad sugerida tambien sabe de que modulo es', () => {
    const siguiente = siguienteActividad(
      [
        modulo('cognicion', [{ id: 'a', hecha: false }]),
        modulo('bienestar', [{ id: 'b', hecha: false }], ['extra']),
      ],
      'extra',
    );

    expect(siguiente).toMatchObject({ id: 'b', modulo: 'bienestar', cambiaDeModulo: false });
  });

  it('si no se sabe de que modulo es, ofrece lo primero que falta sin decir que cambia', () => {
    const siguiente = siguienteActividad([modulo('cognicion', [{ id: 'a', hecha: false }])], 'x');

    expect(siguiente).toMatchObject({ id: 'a', cambiaDeModulo: false });
  });

  it('sin modulos activos no hay siguiente', () => {
    expect(siguienteActividad([], 'a')).toBeUndefined();
  });
});
