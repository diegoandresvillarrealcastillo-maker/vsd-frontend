import { describe, expect, it } from 'vitest';

import { nuevaOperacion, type Operacion } from './cola.ts';
import { estadoDeUnCambio } from './estadoDeUnCambio.ts';

const AHORA = new Date('2026-10-07T12:00:00.000Z');

function operacion(cambios: Partial<Operacion> = {}): Operacion {
  return {
    ...nuevaOperacion(
      { operationId: 'op-1', tipo: 'pendiente.crear', entidad: 'pendiente:op-1', payload: {} },
      new Date('2026-10-07T11:00:00.000Z'),
    ),
    ...cambios,
  };
}

describe('estadoDeUnCambio', () => {
  it('lo que espera esta en este equipo', () => {
    expect(estadoDeUnCambio(operacion(), false, AHORA)).toBe('en_este_equipo');
  });

  it('lo que se esta enviando esta guardando', () => {
    expect(estadoDeUnCambio(operacion({ estado: 'enviando' }), false, AHORA)).toBe('guardando');
  });

  it('lo que la API rechazo es un error', () => {
    expect(estadoDeUnCambio(operacion({ estado: 'requiere_atencion' }), true, AHORA)).toBe('error');
  });

  it('lo que choco con otro dispositivo es un conflicto, distinto de un error', () => {
    expect(estadoDeUnCambio(operacion({ estado: 'conflicto' }), true, AHORA)).toBe('conflicto');
  });

  it('una pendiente mientras el motor envia esta guardando', () => {
    expect(estadoDeUnCambio(operacion(), true, AHORA)).toBe('guardando');
  });

  it('una que espera su proximo reintento no esta guardando aunque el motor envie otra cosa', () => {
    expect(
      estadoDeUnCambio(operacion({ proximoIntento: '2026-10-07T12:05:00.000Z' }), true, AHORA),
    ).toBe('en_este_equipo');
  });

  it('una cuyo reintento ya toco, o justo toca, si esta guardando', () => {
    expect(
      estadoDeUnCambio(operacion({ proximoIntento: '2026-10-07T11:59:00.000Z' }), true, AHORA),
    ).toBe('guardando');
    expect(
      estadoDeUnCambio(operacion({ proximoIntento: '2026-10-07T12:00:00.000Z' }), true, AHORA),
    ).toBe('guardando');
  });

  it('una que espera su turno sin que el motor este enviando sigue en este equipo', () => {
    expect(
      estadoDeUnCambio(operacion({ proximoIntento: '2026-10-07T11:59:00.000Z' }), false, AHORA),
    ).toBe('en_este_equipo');
  });
});
