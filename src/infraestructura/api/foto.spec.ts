import { afterEach, describe, expect, it, vi } from 'vitest';

import { llamarALaApi, pedirBytesALaApi } from './clienteHttp.ts';
import { guardarLaFoto, pedirLaFoto, quitarLaFoto } from './foto.ts';

vi.mock('./clienteHttp.ts', () => ({
  llamarALaApi: vi.fn(),
  pedirBytesALaApi: vi.fn(),
}));

const CUENTA = { id: 'una-cuenta', foto: { actualizadaEl: '2026-10-09T15:30:00.000Z' } };

afterEach(() => {
  vi.clearAllMocks();
});

describe('la foto de perfil por HTTP (SCRUM-120)', () => {
  describe('guardarLaFoto', () => {
    it('manda el archivo con PUT a la ruta de la foto, sin identificador de persona', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue(CUENTA);

      const foto = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

      expect(await guardarLaFoto(foto)).toBe(CUENTA);
      expect(llamarALaApi).toHaveBeenCalledWith('/api/cuenta/foto', {
        metodo: 'PUT',
        bytes: foto,
      });
    });

    it('pasa la senal, para poder cancelar', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue(CUENTA);

      const senal = new AbortController().signal;

      await guardarLaFoto(new Blob([]), senal);

      expect(llamarALaApi).toHaveBeenCalledWith('/api/cuenta/foto', {
        metodo: 'PUT',
        bytes: expect.any(Blob) as Blob,
        senal,
      });
    });

    it('si la API la rechaza, el error sale tal cual', async () => {
      const rechazo = new Error('FOTO_DEMASIADO_PESADA');

      vi.mocked(llamarALaApi).mockRejectedValue(rechazo);

      await expect(guardarLaFoto(new Blob([]))).rejects.toBe(rechazo);
    });
  });

  describe('quitarLaFoto', () => {
    it('llama con DELETE, sin cuerpo, y devuelve la cuenta como quedo', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue({ id: 'una-cuenta', foto: null });

      expect(await quitarLaFoto()).toEqual({ id: 'una-cuenta', foto: null });
      expect(llamarALaApi).toHaveBeenCalledWith('/api/cuenta/foto', { metodo: 'DELETE' });
    });
  });

  describe('pedirLaFoto', () => {
    it('pide los bytes de la ruta de la foto y los entrega', async () => {
      const archivo = new Blob([new Uint8Array([9])], { type: 'image/png' });

      vi.mocked(pedirBytesALaApi).mockResolvedValue(archivo);

      expect(await pedirLaFoto()).toBe(archivo);
      expect(pedirBytesALaApi).toHaveBeenCalledWith('/api/cuenta/foto', {});
    });

    it('pasa la senal', async () => {
      vi.mocked(pedirBytesALaApi).mockResolvedValue(new Blob([]));

      const senal = new AbortController().signal;

      await pedirLaFoto(senal);

      expect(pedirBytesALaApi).toHaveBeenCalledWith('/api/cuenta/foto', { senal });
    });
  });
});
