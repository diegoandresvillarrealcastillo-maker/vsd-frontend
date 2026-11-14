import { describe, expect, it } from 'vitest';

import { edadEn, evaluarLaFecha, fechaMaximaDelCampo, fechaMinimaDelCampo } from './edad.ts';

const HOY = '2026-10-08';

describe('edadEn', () => {
  it('a un dia de cumplir 18 todavia tiene 17', () => {
    expect(edadEn('2008-10-09', HOY)).toBe(17);
  });

  it('el dia que cumple 18 ya tiene 18, y el siguiente tambien', () => {
    expect(edadEn('2008-10-08', HOY)).toBe(18);
    expect(edadEn('2008-10-07', HOY)).toBe(18);
  });

  it('17 anos y 364 dias es 17', () => {
    expect(edadEn('2008-12-31', HOY)).toBe(17);
  });

  it('los nacidos un 29 de febrero cumplen el 1 de marzo si el ano no es bisiesto', () => {
    expect(edadEn('2008-02-29', '2026-02-28')).toBe(17);
    expect(edadEn('2008-02-29', '2026-03-01')).toBe(18);
    expect(edadEn('2008-02-29', '2028-02-29')).toBe(20);
  });
});

describe('evaluarLaFecha', () => {
  it('sin nada escrito es vacia', () => {
    expect(evaluarLaFecha('', HOY)).toBe('vacia');
    expect(evaluarLaFecha('   ', HOY)).toBe('vacia');
  });

  it('un adulto es mayor', () => {
    expect(evaluarLaFecha('1998-03-14', HOY)).toBe('mayor');
  });

  it('quien cumple 18 hoy es mayor, y quien los cumple manana es menor', () => {
    expect(evaluarLaFecha('2008-10-08', HOY)).toBe('mayor');
    expect(evaluarLaFecha('2008-10-09', HOY)).toBe('menor');
  });

  it('un menor es menor', () => {
    expect(evaluarLaFecha('2015-05-05', HOY)).toBe('menor');
  });

  it.each(['ayer', '14/03/1998', '1998-3-14', '1998-03-14T00:00:00Z', '1998-02-30', '2025-02-29'])(
    'lo que no es una fecha real es invalida: %s',
    (texto) => {
      expect(evaluarLaFecha(texto, HOY)).toBe('invalida');
    },
  );

  it('una fecha de hoy o del futuro es invalida', () => {
    expect(evaluarLaFecha(HOY, HOY)).toBe('invalida');
    expect(evaluarLaFecha('2030-01-01', HOY)).toBe('invalida');
  });

  it('admite hasta 120 anos y rechaza a quien tendria 121', () => {
    expect(evaluarLaFecha('1906-10-08', HOY)).toBe('mayor');
    expect(evaluarLaFecha('1905-10-08', HOY)).toBe('invalida');
  });

  it('por defecto cuenta con el dia de hoy', () => {
    expect(evaluarLaFecha('1998-03-14')).toBe('mayor');
    expect(evaluarLaFecha('2999-01-01')).toBe('invalida');
  });
});

describe('Los limites del campo de fecha', () => {
  it('el primer dia es hace 120 anos', () => {
    expect(fechaMinimaDelCampo(HOY)).toBe('1906-10-08');
  });

  it('el ultimo dia es ayer', () => {
    expect(fechaMaximaDelCampo(HOY)).toBe('2026-10-07');
    expect(fechaMaximaDelCampo('2026-03-01')).toBe('2026-02-28');
    expect(fechaMaximaDelCampo('2026-01-01')).toBe('2025-12-31');
  });
});
