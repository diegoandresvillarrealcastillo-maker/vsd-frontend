import { describe, expect, it } from 'vitest';

import type { CambioSinEnviar } from '../../sincronizacion/loGuardadoEnEsteEquipo.ts';
import { armarLaExportacion } from './exportacion.ts';

const CAMBIO: CambioSinEnviar = {
  operationId: 'op-1',
  tipo: 'diario.escribir',
  estado: 'pendiente',
  creadaEn: '2026-10-08T10:00:00.000Z',
  contenido: { dia: '2026-10-08' },
};

describe('armarLaExportacion (SCRUM-142)', () => {
  it('sin nada sin enviar, es lo que dijo el servidor, tal cual', () => {
    const delServidor = { cuenta: { correo: 'ana@ejemplo.test' }, diario: [] };

    expect(armarLaExportacion(delServidor, [])).toBe(delServidor);
  });

  it('con cambios sin enviar, suma una clave aparte y deja lo del servidor intacto', () => {
    const delServidor = { cuenta: { correo: 'ana@ejemplo.test' }, diario: [{ id: 'a' }] };

    expect(armarLaExportacion(delServidor, [CAMBIO])).toEqual({
      cuenta: { correo: 'ana@ejemplo.test' },
      diario: [{ id: 'a' }],
      sinEnviarDesdeEsteEquipo: [CAMBIO],
    });
  });

  it('no cambia el objeto del servidor', () => {
    const delServidor = { cuenta: {} };

    armarLaExportacion(delServidor, [CAMBIO]);

    expect(delServidor).toEqual({ cuenta: {} });
  });

  it('lo que no es un objeto se conserva entero, aparte, y no se pierde', () => {
    expect(armarLaExportacion('algo', [CAMBIO])).toEqual({
      servidor: 'algo',
      sinEnviarDesdeEsteEquipo: [CAMBIO],
    });
    expect(armarLaExportacion([1, 2], [CAMBIO])).toEqual({
      servidor: [1, 2],
      sinEnviarDesdeEsteEquipo: [CAMBIO],
    });
    expect(armarLaExportacion(null, [CAMBIO])).toEqual({
      servidor: null,
      sinEnviarDesdeEsteEquipo: [CAMBIO],
    });
  });

  it('lo que sigue sin enviar va en el orden en que llega', () => {
    const otro: CambioSinEnviar = { ...CAMBIO, operationId: 'op-2' };

    expect(armarLaExportacion({}, [CAMBIO, otro])).toEqual({
      sinEnviarDesdeEsteEquipo: [CAMBIO, otro],
    });
  });
});
