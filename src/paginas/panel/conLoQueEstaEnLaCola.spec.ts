import { describe, expect, it } from 'vitest';

import type { ProgresoDelModulo } from '../../infraestructura/api/progreso.ts';
import { nuevaOperacion, type Operacion } from '../../sincronizacion/cola.ts';
import { diaEnLaZona, fijarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { conLoQueEstaEnLaCola } from './conLoQueEstaEnLaCola.ts';

fijarLaZonaDeLaCuenta('America/Bogota');

const HOY = '2026-10-07';
const DE_HOY = '2026-10-07T15:00:00.000Z';

function modulo(
  hechas: [string, boolean][] = [['a-1', false]],
  extra: Partial<ProgresoDelModulo> = {},
): ProgresoDelModulo {
  return {
    modulo: 'bienestar',
    sesiones: 3,
    etapa: { numero: 1, esTemporada: false, sesionesHechas: 3, sesionesDeLaEtapa: 5 },
    hoy: hechas.map(([id, hecha]) => ({ id, nombre: `Actividad ${id}`, hecha })),
    ...extra,
  };
}

let contador = 0;

function resultado(
  activityId: string,
  completedAt: string,
  payload: unknown = undefined,
): Operacion {
  contador += 1;

  return nuevaOperacion(
    {
      operationId: `op-${String(contador)}`,
      tipo: 'resultado.registrar',
      entidad: `resultado:${String(contador)}`,
      payload: payload === undefined ? { activityId, completedAt } : payload,
    },
    new Date('2026-10-07T11:30:00.000Z'),
  );
}

describe('conLoQueEstaEnLaCola', () => {
  it('lo que se hizo hoy y esta en la cola sale como hecho en lo que toca hoy', () => {
    const visto = conLoQueEstaEnLaCola(
      [
        modulo([
          ['a-1', false],
          ['a-2', false],
        ]),
      ],
      [resultado('a-2', DE_HOY)],
      HOY,
      null,
    );

    expect(visto[0]?.hoy.map((a) => [a.id, a.hecha])).toEqual([
      ['a-1', false],
      ['a-2', true],
    ]);
  });

  it('lo primero que se hizo hoy en el modulo cuenta como una sesion mas, con la etapa que le toca', () => {
    const [visto] = conLoQueEstaEnLaCola([modulo()], [resultado('a-1', DE_HOY)], HOY, null);

    expect(visto).toMatchObject({
      sesiones: 4,
      etapa: { numero: 1, esTemporada: false, sesionesHechas: 4, sesionesDeLaEtapa: 5 },
    });
  });

  it('esa sesion puede cerrar la etapa y pasar a la siguiente, como diria el servidor', () => {
    const [visto] = conLoQueEstaEnLaCola(
      [
        modulo([['a-1', false]], {
          sesiones: 4,
          etapa: { numero: 1, esTemporada: false, sesionesHechas: 4, sesionesDeLaEtapa: 5 },
        }),
      ],
      [resultado('a-1', DE_HOY)],
      HOY,
      null,
    );

    expect(visto).toMatchObject({
      sesiones: 5,
      etapa: { numero: 2, esTemporada: false, sesionesHechas: 0, sesionesDeLaEtapa: 10 },
    });
  });

  it('si ya habia algo hecho hoy, el dia ya contaba: no se suma otra sesion', () => {
    const [visto] = conLoQueEstaEnLaCola(
      [
        modulo([
          ['a-1', true],
          ['a-2', false],
        ]),
      ],
      [resultado('a-2', DE_HOY)],
      HOY,
      null,
    );

    expect(visto?.sesiones).toBe(3);
    expect(visto?.hoy.map((a) => a.hecha)).toEqual([true, true]);
  });

  it('dos hechas hoy sin nada antes suman una sola sesion', () => {
    const [visto] = conLoQueEstaEnLaCola(
      [
        modulo([
          ['a-1', false],
          ['a-2', false],
        ]),
      ],
      [resultado('a-1', DE_HOY), resultado('a-2', DE_HOY)],
      HOY,
      null,
    );

    expect(visto?.sesiones).toBe(4);
  });

  it('cada modulo cuenta lo suyo: lo hecho en uno no suma sesiones en otro', () => {
    const visto = conLoQueEstaEnLaCola(
      [modulo([['a-1', false]]), modulo([['b-1', false]], { modulo: 'emociones', sesiones: 7 })],
      [resultado('a-1', DE_HOY)],
      HOY,
      null,
    );

    expect(visto.map((m) => m.sesiones)).toEqual([4, 7]);
    expect(visto[1]?.hoy[0]?.hecha).toBe(false);
  });

  it('lo ya enviado tambien: la copia puede ser de antes de enviarlo', () => {
    const [visto] = conLoQueEstaEnLaCola([modulo()], [resultado('a-1', DE_HOY)], HOY, null);

    expect(visto?.hoy[0]?.hecha).toBe(true);
  });

  it('lo hecho otro dia no cuenta como hecho hoy ni suma una sesion', () => {
    const original = [modulo()];
    const visto = conLoQueEstaEnLaCola(
      original,
      [resultado('a-1', '2026-10-06T15:00:00.000Z')],
      HOY,
      null,
    );

    expect(visto).toBe(original);
  });

  it('el dia se cuenta en la zona de la persona, no en UTC', () => {
    // 3 a. m. UTC del 8 es todavia el 7 en Bogota.
    const [visto] = conLoQueEstaEnLaCola(
      [modulo()],
      [resultado('a-1', '2026-10-08T03:00:00.000Z')],
      HOY,
      null,
    );

    expect(visto?.hoy[0]?.hecha).toBe(true);
    expect(diaEnLaZona(new Date('2026-10-08T03:00:00.000Z'))).toBe(HOY);
  });

  it('una actividad que no toca hoy no se inventa', () => {
    const original = [modulo()];
    const visto = conLoQueEstaEnLaCola(original, [resultado('a-otra', DE_HOY)], HOY, null);

    // Nada cambia: ni lo hecho ni las sesiones.
    expect(visto).toEqual(original);
  });

  it('sin nada en la cola devuelve lo mismo, tal cual', () => {
    const original = [modulo()];

    expect(conLoQueEstaEnLaCola(original, [], HOY, null)).toBe(original);
  });

  it('una copia de otro dia no se toca: lo que toca hoy en ella es lo de ese dia', () => {
    const original = [modulo()];
    const visto = conLoQueEstaEnLaCola(
      original,
      [resultado('a-1', DE_HOY)],
      HOY,
      '2026-10-06T15:00:00.000Z',
    );

    expect(visto).toBe(original);
  });

  it('una copia de hoy si', () => {
    const [visto] = conLoQueEstaEnLaCola(
      [modulo()],
      [resultado('a-1', DE_HOY)],
      HOY,
      '2026-10-07T13:00:00.000Z',
    );

    expect(visto?.hoy[0]?.hecha).toBe(true);
  });

  it('una operacion con un payload que no se entiende se deja fuera', () => {
    const original = [modulo()];
    const visto = conLoQueEstaEnLaCola(
      original,
      [
        resultado('a-1', DE_HOY, 'texto'),
        resultado('a-1', DE_HOY, null),
        resultado('a-1', 'ayer'),
        resultado('a-1', DE_HOY, { activityId: 5, completedAt: DE_HOY }),
        resultado('a-1', DE_HOY, { activityId: 'a-1', completedAt: 5 }),
      ],
      HOY,
      null,
    );

    expect(visto).toBe(original);
  });
});
