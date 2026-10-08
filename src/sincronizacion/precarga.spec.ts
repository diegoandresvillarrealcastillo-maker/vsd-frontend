import { beforeEach, describe, expect, it, vi } from 'vitest';

import { traerElCatalogoConCopia } from './catalogoLocal.ts';
import { precargarLasLecturas } from './precarga.ts';

vi.mock('./catalogoLocal.ts', () => ({ traerElCatalogoConCopia: vi.fn() }));

const traer = vi.mocked(traerElCatalogoConCopia);

beforeEach(() => {
  traer.mockReset();
});

describe('precargarLasLecturas (SCRUM-138)', () => {
  it('lee el catalogo para dejarlo guardado', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });

    await precargarLasLecturas();

    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('sin conexion no falla ni molesta: es una comodidad', async () => {
    traer.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
  });

  it('un error del servidor tampoco', async () => {
    traer.mockRejectedValue(new Error('500'));

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
  });

  it('un error que se lanza sin esperar a nadie tampoco se escapa', async () => {
    traer.mockImplementation(() => {
      throw new Error('fallo sincrono');
    });

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
  });
});
