import { beforeEach, describe, expect, it, vi } from 'vitest';

import { traerElCatalogoConCopia } from './catalogoLocal.ts';
import { precargarElDiario } from './diarioLocal.ts';
import { precargarLasLecturas } from './precarga.ts';

vi.mock('./catalogoLocal.ts', () => ({ traerElCatalogoConCopia: vi.fn() }));
vi.mock('./diarioLocal.ts', () => ({ precargarElDiario: vi.fn() }));

const traer = vi.mocked(traerElCatalogoConCopia);
const traerElDiario = vi.mocked(precargarElDiario);

beforeEach(() => {
  traer.mockReset();
  traerElDiario.mockReset();
  traerElDiario.mockResolvedValue(undefined);
});

describe('precargarLasLecturas (SCRUM-138)', () => {
  it('lee el catalogo para dejarlo guardado', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });

    await precargarLasLecturas();

    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('lee los ultimos dias del diario para dejarlos guardados (SCRUM-139)', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });

    await precargarLasLecturas();

    expect(traerElDiario).toHaveBeenCalledTimes(1);
  });

  it('si el catalogo falla, el diario se lee igual, y al reves', async () => {
    traer.mockRejectedValue(new TypeError('Failed to fetch'));

    await precargarLasLecturas();

    expect(traerElDiario).toHaveBeenCalledTimes(1);

    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });
    traerElDiario.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('un fallo del diario que se lanza sin esperar a nadie tampoco se escapa', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });
    traerElDiario.mockImplementation(() => {
      throw new Error('fallo sincrono');
    });

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
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
