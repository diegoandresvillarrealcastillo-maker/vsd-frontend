import { afterEach, describe, expect, it, vi } from 'vitest';

import { olvidarLaRutaAbierta, recordarLaRutaAbierta, rutaAbierta } from './memoriaDeLaRuta.ts';

const CUENTA = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  olvidarLaRutaAbierta(CUENTA);
  vi.restoreAllMocks();
});

describe('memoriaDeLaRuta', () => {
  it('sin nada guardado no hay ningun modulo abierto', () => {
    expect(rutaAbierta(CUENTA)).toBeNull();
  });

  it('recuerda el ultimo modulo que se abrio, por cuenta', () => {
    recordarLaRutaAbierta(CUENTA, 'cognicion');

    expect(rutaAbierta(CUENTA)).toBe('cognicion');
    expect(rutaAbierta('22222222-2222-4222-8222-222222222222')).toBeNull();
  });

  it('al cerrar el modulo deja de recordarlo', () => {
    recordarLaRutaAbierta(CUENTA, 'bienestar');
    recordarLaRutaAbierta(CUENTA, null);

    expect(rutaAbierta(CUENTA)).toBeNull();
  });

  it('ignora un valor que no es un modulo conocido', () => {
    localStorage.setItem(`vsd-h:ruta-abierta:${CUENTA}`, 'otra-cosa');

    expect(rutaAbierta(CUENTA)).toBeNull();
  });

  it('sin almacenamiento no falla: simplemente no recuerda', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });

    expect(() => recordarLaRutaAbierta(CUENTA, 'emociones')).not.toThrow();
    expect(rutaAbierta(CUENTA)).toBeNull();
  });
});
