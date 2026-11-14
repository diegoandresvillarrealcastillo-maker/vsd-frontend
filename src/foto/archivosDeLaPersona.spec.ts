import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  olvidarLosArchivosDeLaPersona,
  sincronizarLosArchivosDeLaPersona,
} from './archivosDeLaPersona.ts';
import { olvidarLaFoto, sincronizarLaFoto } from './fotoDePerfil.ts';
import { olvidarLaMascotaPropia, sincronizarLaMascotaPropia } from './mascotaPropia.ts';

vi.mock('./fotoDePerfil.ts', () => ({ sincronizarLaFoto: vi.fn(), olvidarLaFoto: vi.fn() }));
vi.mock('./mascotaPropia.ts', () => ({
  sincronizarLaMascotaPropia: vi.fn(),
  olvidarLaMascotaPropia: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('los archivos de la persona (SCRUM-120 y SCRUM-122)', () => {
  const CUENTA = {
    id: 'una-cuenta',
    foto: { actualizadaEl: '2026-10-09T15:30:00.000Z' },
    mascotaPropia: { actualizadaEl: '2026-10-12T09:00:00.000Z' },
  };

  it('cuando llega una cuenta, se la entrega a los dos', () => {
    sincronizarLosArchivosDeLaPersona(CUENTA);

    expect(sincronizarLaFoto).toHaveBeenCalledExactlyOnceWith(CUENTA);
    expect(sincronizarLaMascotaPropia).toHaveBeenCalledExactlyOnceWith(CUENTA);
  });

  it('cuando termina la sesion, los dos se olvidan', () => {
    olvidarLosArchivosDeLaPersona();

    expect(olvidarLaFoto).toHaveBeenCalledOnce();
    expect(olvidarLaMascotaPropia).toHaveBeenCalledOnce();
  });

  it('una cuenta sin ninguno tambien se entrega: es lo que hace que se dejen de mostrar', () => {
    const vacia = { id: 'una-cuenta', foto: null, mascotaPropia: null };

    sincronizarLosArchivosDeLaPersona(vacia);

    expect(sincronizarLaFoto).toHaveBeenCalledWith(vacia);
    expect(sincronizarLaMascotaPropia).toHaveBeenCalledWith(vacia);
  });
});
