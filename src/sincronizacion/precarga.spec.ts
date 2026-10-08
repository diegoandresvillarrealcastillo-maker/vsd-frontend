import { beforeEach, describe, expect, it, vi } from 'vitest';

import { traerElCatalogoConCopia } from './catalogoLocal.ts';
import { precargarElDiario } from './diarioLocal.ts';
import { precargarElPanel } from './panelLocal.ts';
import { precargarLasLecturas } from './precarga.ts';
import { precargarElSemaforo } from './semaforoLocal.ts';

vi.mock('./catalogoLocal.ts', () => ({ traerElCatalogoConCopia: vi.fn() }));
vi.mock('./diarioLocal.ts', () => ({ precargarElDiario: vi.fn() }));
vi.mock('./panelLocal.ts', () => ({ precargarElPanel: vi.fn() }));
vi.mock('./semaforoLocal.ts', () => ({ precargarElSemaforo: vi.fn() }));

const traer = vi.mocked(traerElCatalogoConCopia);
const traerElDiario = vi.mocked(precargarElDiario);
const traerElSemaforo = vi.mocked(precargarElSemaforo);
const traerElPanel = vi.mocked(precargarElPanel);

beforeEach(() => {
  traer.mockReset();
  traerElDiario.mockReset();
  traerElDiario.mockResolvedValue(undefined);
  traerElSemaforo.mockReset();
  traerElSemaforo.mockResolvedValue(undefined);
  traerElPanel.mockReset();
  traerElPanel.mockResolvedValue(undefined);
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

  it('lee el semaforo de pendientes para dejarlo guardado (SCRUM-140)', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });

    await precargarLasLecturas();

    expect(traerElSemaforo).toHaveBeenCalledTimes(1);
  });

  it('lee el panel con el sendero para dejarlo guardado (SCRUM-140)', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });

    await precargarLasLecturas();

    expect(traerElPanel).toHaveBeenCalledTimes(1);
  });

  it('si el panel falla, lo demas se lee igual, y al reves', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });
    traerElPanel.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
    expect(traer).toHaveBeenCalledTimes(1);
    expect(traerElDiario).toHaveBeenCalledTimes(1);
    expect(traerElSemaforo).toHaveBeenCalledTimes(1);

    traerElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));
    traerElPanel.mockResolvedValue(undefined);

    await precargarLasLecturas();

    expect(traerElPanel).toHaveBeenCalledTimes(2);
  });

  it('un fallo del panel que se lanza sin esperar a nadie tampoco se escapa', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });
    traerElPanel.mockImplementation(() => {
      throw new Error('fallo sincrono');
    });

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
  });

  it('si el semaforo falla, lo demas se lee igual, y al reves', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });
    traerElSemaforo.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
    expect(traer).toHaveBeenCalledTimes(1);
    expect(traerElDiario).toHaveBeenCalledTimes(1);

    traer.mockRejectedValue(new TypeError('Failed to fetch'));
    traerElDiario.mockRejectedValue(new TypeError('Failed to fetch'));
    traerElSemaforo.mockResolvedValue(undefined);

    await precargarLasLecturas();

    expect(traerElSemaforo).toHaveBeenCalledTimes(2);
  });

  it('un fallo del semaforo que se lanza sin esperar a nadie tampoco se escapa', async () => {
    traer.mockResolvedValue({ valor: [], deLaCopia: false, guardadoEn: null });
    traerElSemaforo.mockImplementation(() => {
      throw new Error('fallo sincrono');
    });

    await expect(precargarLasLecturas()).resolves.toBeUndefined();
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
