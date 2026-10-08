import { describe, expect, it } from 'vitest';

import type { Pendiente } from '../infraestructura/api/pendientes.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { describirCambios, describirPendiente } from './choques.ts';

fijarLaZonaDeLaCuenta('America/Bogota');

const HOY = '2026-10-07';

function pendiente(extra: Partial<Pendiente> = {}): Pendiente {
  return {
    id: 'p-1',
    texto: 'Llamar a la EPS',
    nivel: 'urgente',
    hecho: false,
    posponerHasta: null,
    fechaLimite: null,
    version: 2,
    creadoEn: '2026-10-05T10:00:00.000Z',
    editadoEn: '2026-10-05T10:00:00.000Z',
    ...extra,
  };
}

describe('describirPendiente', () => {
  it('dice el texto, para cuando es, si esta hecho y que no tiene fecha limite', () => {
    expect(describirPendiente(pendiente(), HOY)).toEqual([
      'Texto: «Llamar a la EPS»',
      'Para cuándo: Urgente',
      'Sin hacer',
      'Sin fecha límite',
    ]);
  });

  it('lo hecho lo dice', () => {
    expect(describirPendiente(pendiente({ hecho: true }), HOY)).toContain('Hecho');
  });

  it('cada nivel con su nombre', () => {
    expect(describirPendiente(pendiente({ nivel: 'prioridad' }), HOY)).toContain(
      'Para cuándo: Prioridad',
    );
    expect(describirPendiente(pendiente({ nivel: 'aplazable' }), HOY)).toContain(
      'Para cuándo: Aplazable',
    );
  });

  it('la fecha limite, en palabras y en minusculas', () => {
    expect(describirPendiente(pendiente({ fechaLimite: '2026-10-07' }), HOY)).toContain(
      'Fecha límite: vence hoy',
    );
    expect(describirPendiente(pendiente({ fechaLimite: '2026-10-06' }), HOY)).toContain(
      'Fecha límite: venció ayer',
    );
  });

  it('lo pospuesto dice hasta cuando, en el dia de la persona', () => {
    // 3 a. m. del 14 en UTC es todavia el 13 en Bogota.
    expect(
      describirPendiente(pendiente({ posponerHasta: '2026-10-14T03:00:00.000Z' }), HOY),
    ).toContain('Pospuesto hasta el martes, 13 de octubre');
  });
});

describe('describirCambios', () => {
  it('eliminarlo es lo unico que dice', () => {
    expect(describirCambios({ texto: 'x', hecho: true }, true, HOY)).toEqual(['Eliminarlo']);
  });

  it('solo dice lo que cambia', () => {
    expect(describirCambios({ nivel: 'aplazable' }, false, HOY)).toEqual(['Pasa a Aplazable']);
    expect(describirCambios({}, false, HOY)).toEqual([]);
  });

  it('el texto, entre comillas', () => {
    expect(describirCambios({ texto: 'Lo mio' }, false, HOY)).toEqual(['Texto: «Lo mio»']);
  });

  it('hecho y deshecho', () => {
    expect(describirCambios({ hecho: true }, false, HOY)).toEqual(['Marcarlo como hecho']);
    expect(describirCambios({ hecho: false }, false, HOY)).toEqual([
      'Volver a ponerlo como pendiente',
    ]);
  });

  it('poner y quitar la fecha limite', () => {
    expect(describirCambios({ fechaLimite: '2026-10-08' }, false, HOY)).toEqual([
      'Fecha límite: vence mañana',
    ]);
    expect(describirCambios({ fechaLimite: null }, false, HOY)).toEqual(['Quitar la fecha límite']);
  });

  it('posponer y dejar de posponer', () => {
    expect(describirCambios({ posponerHasta: '2026-10-14T15:00:00.000Z' }, false, HOY)).toEqual([
      'Posponerlo hasta el miércoles, 14 de octubre',
    ]);
    expect(describirCambios({ posponerHasta: null }, false, HOY)).toEqual(['Dejar de posponerlo']);
  });

  it('varios cambios, uno por linea y en el mismo orden', () => {
    expect(
      describirCambios(
        { posponerHasta: null, hecho: true, texto: 'Otro', nivel: 'urgente' },
        false,
        HOY,
      ),
    ).toEqual(['Texto: «Otro»', 'Pasa a Urgente', 'Marcarlo como hecho', 'Dejar de posponerlo']);
  });
});
