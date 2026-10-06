import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fijarLaZonaDeLaCuenta,
  formatoEn,
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
