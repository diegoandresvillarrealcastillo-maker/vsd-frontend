import { describe, expect, it } from 'vitest';

import type { SesionPublicada } from '../../infraestructura/api/sesionesPublicadas.ts';
import {
  ordenarActividadesParaPersona,
  ordenarSesionesParaPersona,
} from './ordenPersonalDeSesiones.ts';

function sesion(
  actividad: string,
  frecuencia: SesionPublicada['frecuencia'] = { tipo: 'rotativa' },
  idSesion = `sesion-${actividad}`,
): SesionPublicada {
  return {
    id: idSesion,
    idActividad: actividad,
    titulo: `Sesión de ${actividad}`,
    actividad,
    nivel: 1,
    ...(frecuencia === undefined ? {} : { frecuencia }),
  };
}

describe('ordenPersonalDeSesiones', () => {
  it('mantiene las actividades diarias fijas en su posición y mezcla las rotativas entre ellas', () => {
    const sesiones = [
      sesion('rotativa-a'),
      sesion('horas-de-sueno', { tipo: 'diaria' }),
      sesion('rotativa-b'),
      sesion('rotativa-c'),
      sesion('diaria-emociones', { tipo: 'diaria' }),
      sesion('rotativa-d'),
    ];

    const orden = ordenarActividadesParaPersona(sesiones, 'persona-a', 'bienestar');

    expect(orden.map(({ idActividad }) => idActividad)).toHaveLength(sesiones.length);
    expect(orden[1]?.idActividad).toBe('horas-de-sueno');
    expect(orden[4]?.idActividad).toBe('diaria-emociones');
    expect(
      orden.map(({ idActividad }) => idActividad).filter((id) => id.startsWith('rotativa-')),
    ).not.toEqual(['rotativa-a', 'rotativa-b', 'rotativa-c', 'rotativa-d']);
  });

  it('conserva el mismo orden por persona y genera otro para un perfil distinto', () => {
    const sesiones = Array.from({ length: 12 }, (_, indice) => sesion(`actividad-${indice + 1}`));
    const primero = ordenarActividadesParaPersona(sesiones, 'persona-a', 'cognicion');
    const repetido = ordenarActividadesParaPersona(sesiones, 'persona-a', 'cognicion');
    const otraPersona = ordenarActividadesParaPersona(sesiones, 'persona-b', 'cognicion');

    expect(repetido.map(({ idActividad }) => idActividad)).toEqual(
      primero.map(({ idActividad }) => idActividad),
    );
    expect(otraPersona.map(({ idActividad }) => idActividad)).not.toEqual(
      primero.map(({ idActividad }) => idActividad),
    );
  });

  it('representa cada actividad una vez aunque tenga varias sesiones publicadas', () => {
    const sesiones = [
      sesion('actividad-a', { tipo: 'rotativa' }, 'a-1'),
      sesion('actividad-a', { tipo: 'rotativa' }, 'a-2'),
      sesion('actividad-b'),
    ];

    const orden = ordenarActividadesParaPersona(sesiones, 'persona-a', 'emociones');

    expect(orden).toHaveLength(2);
    expect(orden.find(({ idActividad }) => idActividad === 'actividad-a')?.sesiones).toHaveLength(
      2,
    );
  });

  it('el árbol de prueba conserva todas las sesiones, incluidas las variantes de una actividad', () => {
    const sesiones = [
      sesion('actividad-a', { tipo: 'rotativa' }, 'a-1'),
      sesion('actividad-a', { tipo: 'rotativa' }, 'a-2'),
      sesion('actividad-b', { tipo: 'diaria' }, 'b-diaria'),
      sesion('actividad-c', { tipo: 'rotativa' }, 'c-1'),
    ];

    const orden = ordenarSesionesParaPersona(sesiones, 'persona-a', 'bienestar');

    expect(orden).toHaveLength(sesiones.length);
    expect(new Set(orden.map(({ id }) => id))).toEqual(new Set(sesiones.map(({ id }) => id)));
    expect(orden[2]?.id).toBe('b-diaria');
  });
});
