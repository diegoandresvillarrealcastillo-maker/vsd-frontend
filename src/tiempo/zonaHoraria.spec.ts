import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fijarLaZonaDeLaCuenta,
  formatoEn,
  horaLocal,
  nombreDeLaZona,
  olvidarLaZonaDeLaCuenta,
  ZONA_POR_DEFECTO,
  zonaActual,
  zonaDelDispositivo,
} from './zonaHoraria.ts';

// La preparacion de las pruebas fija la de Colombia; aqui se parte de cero.
beforeEach(() => {
  olvidarLaZonaDeLaCuenta();
});

afterEach(() => {
  olvidarLaZonaDeLaCuenta();
  vi.restoreAllMocks();
});

describe('zonaDelDispositivo', () => {
  it('devuelve la que informa el navegador', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Europe/Madrid',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(zonaDelDispositivo()).toBe('Europe/Madrid');
  });

  it('si el navegador no la sabe decir, usa la de Colombia', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: '',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(zonaDelDispositivo()).toBe(ZONA_POR_DEFECTO);
  });

  it('si Intl falla, usa la de Colombia en lugar de romper', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
      throw new Error('sin Intl');
    });

    expect(zonaDelDispositivo()).toBe(ZONA_POR_DEFECTO);
  });
});

describe('zonaActual', () => {
  it('mientras la cuenta no se ha cargado, es la del dispositivo', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Tokyo',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(zonaActual()).toBe('Asia/Tokyo');
  });

  it('con la cuenta cargada, es la de la cuenta, aunque el dispositivo diga otra', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Tokyo',
    } as Intl.ResolvedDateTimeFormatOptions);

    fijarLaZonaDeLaCuenta('Europe/Madrid');

    expect(zonaActual()).toBe('Europe/Madrid');
  });

  it('al salir, la zona de esa cuenta se olvida', () => {
    fijarLaZonaDeLaCuenta('Europe/Madrid');
    olvidarLaZonaDeLaCuenta();

    expect(zonaActual()).not.toBe('Europe/Madrid');
  });
});

describe('formatoEn', () => {
  const INSTANTE = new Date('2026-10-03T02:00:00Z');
  const DIA = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;

  it('el mismo instante es un dia distinto segun la zona', () => {
    expect(formatoEn('America/Bogota', 'en-CA', DIA).format(INSTANTE)).toBe('2026-10-02');
    expect(formatoEn('Europe/Madrid', 'en-CA', DIA).format(INSTANTE)).toBe('2026-10-03');
    expect(formatoEn('Asia/Tokyo', 'en-CA', DIA).format(INSTANTE)).toBe('2026-10-03');
  });

  it('el mismo pedido devuelve el mismo formateador', () => {
    expect(formatoEn('Europe/Madrid', 'en-CA', DIA)).toBe(formatoEn('Europe/Madrid', 'en-CA', DIA));
  });

  it('una zona que el navegador no conoce cae en la de Colombia en lugar de lanzar', () => {
    expect(formatoEn('Marte/Olympus', 'en-CA', DIA).format(INSTANTE)).toBe('2026-10-02');
  });
});

describe('nombreDeLaZona', () => {
  const OCTUBRE = new Date('2026-10-06T15:00:00Z');

  it('dice la zona en palabras, no como identificador', () => {
    expect(nombreDeLaZona('America/Bogota', OCTUBRE)).toBe('hora estándar de Colombia');
    expect(nombreDeLaZona('Asia/Tokyo', OCTUBRE)).toBe('hora estándar de Japón');
  });

  it('sigue el horario de verano de esa fecha', () => {
    expect(nombreDeLaZona('Europe/Madrid', OCTUBRE)).toBe('hora de verano de Europa central');
    expect(nombreDeLaZona('Europe/Madrid', new Date('2026-12-06T15:00:00Z'))).toBe(
      'hora estándar de Europa central',
    );
  });

  it('sin zona dada, usa la de la cuenta', () => {
    fijarLaZonaDeLaCuenta('America/Bogota');

    expect(nombreDeLaZona()).toBe('hora estándar de Colombia');
  });

  it('una zona que el navegador no conoce se devuelve tal cual, sin lanzar', () => {
    expect(nombreDeLaZona('Marte/Olympus', OCTUBRE)).toBe('Marte/Olympus');
  });
});

describe('horaLocal', () => {
  // 02:30 UTC del 4 de octubre: 21:30 del 3 en Bogota, 04:30 en Madrid, 11:30 en
  // Tokio. Cada persona vive una hora distinta del mismo instante.
  const INSTANTE = new Date('2026-10-04T02:30:00Z');

  it.each([
    ['America/Bogota', 21],
    ['Europe/Madrid', 4],
    ['Asia/Tokyo', 11],
    ['UTC', 2],
  ])('en %s son las %i', (zona, hora) => {
    expect(horaLocal(INSTANTE, zona)).toBe(hora);
  });

  it('sin zona usa la de la cuenta, y la medianoche es la hora 0, no la 24', () => {
    fijarLaZonaDeLaCuenta('America/Bogota');

    expect(horaLocal(new Date('2026-10-04T05:15:00Z'))).toBe(0);
    expect(horaLocal(new Date('2026-10-04T04:59:00Z'))).toBe(23);
  });
});
