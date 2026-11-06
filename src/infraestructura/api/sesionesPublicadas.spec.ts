import { beforeEach, describe, expect, it, vi } from 'vitest';

import { llamarALaApi } from './clienteHttp.ts';
import { consultarSesionesHechas } from './sesionesPublicadas.ts';

vi.mock('./clienteHttp.ts', () => ({ llamarALaApi: vi.fn() }));

beforeEach(() => {
  vi.mocked(llamarALaApi).mockReset();
});

describe('consultarSesionesHechas', () => {
  it('consulta solo el módulo solicitado y conserva los IDs de sesión', async () => {
    const hechas = ['sesion-1', 'sesion-58'];
    vi.mocked(llamarALaApi).mockResolvedValue(hechas);

    await expect(consultarSesionesHechas('bienestar')).resolves.toEqual(hechas);
    expect(llamarALaApi).toHaveBeenCalledWith('/api/progreso/bienestar/sesiones-hechas', {});
  });

  it('propaga la señal de cancelación para no aplicar una respuesta de otra vista', async () => {
    const control = new AbortController();
    vi.mocked(llamarALaApi).mockResolvedValue([]);

    await consultarSesionesHechas('emociones', control.signal);

    expect(llamarALaApi).toHaveBeenCalledWith('/api/progreso/emociones/sesiones-hechas', {
      senal: control.signal,
    });
  });
});
