import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { consultarElHistorial } from './historial.ts';

const { llamarALaApi } = vi.hoisted(() => ({ llamarALaApi: vi.fn() }));

vi.mock('./clienteHttp.ts', () => ({ llamarALaApi }));

describe('consultarElHistorial (SCRUM-184)', () => {
  beforeEach(() => {
    llamarALaApi.mockResolvedValue({ hechos: [], siguientePagina: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pide el historial del modulo, sin parametros si no se dan', async () => {
    await consultarElHistorial('bienestar');

    expect(llamarALaApi).toHaveBeenCalledWith('/api/progreso/bienestar/historial', {});
  });

  it('pasa el limite y la pagina, y escapa lo que es del servidor', async () => {
    await consultarElHistorial('cognicion', { limite: 20, pagina: 'abc_-DEF' });

    expect(llamarALaApi).toHaveBeenCalledWith(
      '/api/progreso/cognicion/historial?limite=20&pagina=abc_-DEF',
      {},
    );
  });

  it('lleva la senal para poder cancelar', async () => {
    const control = new AbortController();

    await consultarElHistorial('emociones', { senal: control.signal });

    expect(llamarALaApi).toHaveBeenCalledWith('/api/progreso/emociones/historial', {
      senal: control.signal,
    });
  });

  it('devuelve lo que dijo el servidor', async () => {
    const hecho = {
      id: 'h1',
      actividad: { id: 'a1', nombre: 'Parejas' },
      dia: '2026-10-02',
      hechaEn: '2026-10-02T15:00:00.000Z',
    };

    llamarALaApi.mockResolvedValue({ hechos: [hecho], siguientePagina: 'siguiente' });

    await expect(consultarElHistorial('cognicion')).resolves.toEqual({
      hechos: [hecho],
      siguientePagina: 'siguiente',
    });
  });

  it('una respuesta que no es lo que se espera no rompe: sin hechos y sin mas paginas', async () => {
    llamarALaApi.mockResolvedValue({ hechos: 'no', siguientePagina: 7 });

    await expect(consultarElHistorial('cognicion')).resolves.toEqual({
      hechos: [],
      siguientePagina: null,
    });
  });
});
