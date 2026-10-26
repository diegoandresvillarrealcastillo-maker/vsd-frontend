import { beforeEach, describe, expect, it, vi } from 'vitest';

import { soltarEsteNavegadorDelServidor } from './notificaciones.ts';

const { llamarALaApi } = vi.hoisted(() => ({ llamarALaApi: vi.fn() }));

vi.mock('./clienteHttp.ts', () => ({ llamarALaApi }));

const ENDPOINT = 'https://push.example.com/este-navegador';

beforeEach(() => {
  llamarALaApi.mockReset();
  llamarALaApi.mockResolvedValue(undefined);
});

describe('soltarEsteNavegadorDelServidor (SCRUM-271)', () => {
  it('pide borrar la suscripcion con la direccion de este navegador', async () => {
    await soltarEsteNavegadorDelServidor(ENDPOINT);

    expect(llamarALaApi).toHaveBeenCalledWith('/api/notificaciones/suscripciones', {
      metodo: 'DELETE',
      cuerpo: { endpoint: ENDPOINT },
    });
  });

  it('pasa la senal de cancelacion cuando se la dan, para que la llamada pueda cortarse', async () => {
    const control = new AbortController();

    await soltarEsteNavegadorDelServidor(ENDPOINT, control.signal);

    expect(llamarALaApi).toHaveBeenCalledWith('/api/notificaciones/suscripciones', {
      metodo: 'DELETE',
      cuerpo: { endpoint: ENDPOINT },
      senal: control.signal,
    });
  });
});
