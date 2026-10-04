import { describe, expect, it } from 'vitest';

import {
  agruparPorDia,
  diaEnColombia,
  diasAntes,
  horaEnColombia,
  minutosParaEditar,
  nombreDelDia,
} from './calendarioDelDiario.ts';

describe('Los dias del diario, en hora de Colombia', () => {
  it('a las 9 p. m. de Bogota todavia es el mismo dia, aunque en UTC ya sea el siguiente', () => {
    expect(diaEnColombia(new Date('2026-10-03T02:00:00Z'))).toBe('2026-10-02');
    expect(diaEnColombia(new Date('2026-10-03T05:00:00Z'))).toBe('2026-10-03');
  });

  it('cuenta dias hacia atras, tambien cruzando meses', () => {
    expect(diasAntes('2026-10-03', 1)).toBe('2026-10-02');
    expect(diasAntes('2026-10-03', 29)).toBe('2026-09-04');
    expect(diasAntes('2026-03-01', 1)).toBe('2026-02-28');
  });

  it('la hora se ensena en Colombia', () => {
    expect(horaEnColombia('2026-10-03T01:14:00Z')).toMatch(/^8:14\s?p/);
  });

  it('nombra hoy, ayer y los demas dias con su fecha', () => {
    expect(nombreDelDia('2026-10-03', '2026-10-03')).toBe('Hoy');
    expect(nombreDelDia('2026-10-02', '2026-10-03')).toBe('Ayer');
    expect(nombreDelDia('2026-09-27', '2026-10-03')).toMatch(/^Domingo.*27.*septiembre/);
  });
});

describe('Los minutos para editar', () => {
  const HASTA = '2026-10-03T15:00:00.000Z';

  it('redondea hacia arriba: con medio minuto queda 1', () => {
    expect(minutosParaEditar(HASTA, new Date('2026-10-03T14:59:30Z'))).toBe(1);
    expect(minutosParaEditar(HASTA, new Date('2026-10-03T14:00:00Z'))).toBe(60);
  });

  it('cuando ya paso es cero', () => {
    expect(minutosParaEditar(HASTA, new Date('2026-10-03T15:00:00Z'))).toBe(0);
    expect(minutosParaEditar(HASTA, new Date('2026-10-03T16:00:00Z'))).toBe(0);
  });
});

describe('agruparPorDia', () => {
  it('los dias del mas reciente al mas antiguo, y cada uno por hora', () => {
    const grupos = agruparPorDia([
      { dia: '2026-10-02', creadaEn: '2026-10-02T20:00:00Z' },
      { dia: '2026-10-03', creadaEn: '2026-10-03T12:00:00Z' },
      { dia: '2026-10-02', creadaEn: '2026-10-02T13:00:00Z' },
    ]);

    expect(grupos.map(({ dia }) => dia)).toEqual(['2026-10-03', '2026-10-02']);
    expect(grupos[1]?.anotaciones.map(({ creadaEn }) => creadaEn)).toEqual([
      '2026-10-02T13:00:00Z',
      '2026-10-02T20:00:00Z',
    ]);
  });
});
