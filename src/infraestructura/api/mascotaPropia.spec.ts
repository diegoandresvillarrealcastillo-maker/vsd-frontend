import { afterEach, describe, expect, it, vi } from 'vitest';

import { llamarALaApi, pedirBytesALaApi } from './clienteHttp.ts';
import {
  guardarLaMascotaPropia,
  pedirLaMascotaPropia,
  quitarLaMascotaPropia,
  TIPO_DEL_SVG,
} from './mascotaPropia.ts';

vi.mock('./clienteHttp.ts', () => ({
  llamarALaApi: vi.fn(),
  pedirBytesALaApi: vi.fn(),
}));

const CUENTA = { id: 'una-cuenta', mascotaPropia: { actualizadaEl: '2026-10-12T09:00:00.000Z' } };

const svg = (tipo: string): Blob =>
  new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'], { type: tipo });

afterEach(() => {
  vi.clearAllMocks();
});

describe('la mascota propia por HTTP (SCRUM-122)', () => {
  describe('guardarLaMascotaPropia', () => {
    it('manda el SVG con PUT a la ruta de la mascota, sin identificador de persona', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue(CUENTA);

      const archivo = svg('image/svg+xml');

      expect(await guardarLaMascotaPropia(archivo)).toBe(CUENTA);
      expect(llamarALaApi).toHaveBeenCalledWith('/api/cuenta/mascota-propia', {
        metodo: 'PUT',
        bytes: archivo,
      });
    });

    it('un SVG que llega sin tipo, o con otro, sale con el tipo que exige la API', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue(CUENTA);

      for (const tipo of ['', 'text/xml', 'application/octet-stream']) {
        await guardarLaMascotaPropia(svg(tipo));
      }

      const enviados = vi
        .mocked(llamarALaApi)
        .mock.calls.map(([, opciones]) => (opciones as { bytes: Blob }).bytes);

      expect(enviados).toHaveLength(3);
      expect(enviados.every((enviado) => enviado.type === TIPO_DEL_SVG)).toBe(true);
    });

    it('conserva el contenido tal cual: no lo toca, es el servidor quien lo sanea', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue(CUENTA);

      await guardarLaMascotaPropia(svg(''));

      const enviado = (vi.mocked(llamarALaApi).mock.calls[0]?.[1] as { bytes: Blob }).bytes;

      expect(await enviado.text()).toBe(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      );
    });

    it('pasa la senal, para poder cancelar', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue(CUENTA);

      const senal = new AbortController().signal;

      await guardarLaMascotaPropia(svg(TIPO_DEL_SVG), senal);

      expect(llamarALaApi).toHaveBeenCalledWith('/api/cuenta/mascota-propia', {
        metodo: 'PUT',
        bytes: expect.any(Blob) as Blob,
        senal,
      });
    });

    it('si la API la rechaza, el error sale tal cual', async () => {
      const rechazo = new Error('MASCOTA_SVG_PELIGROSO');

      vi.mocked(llamarALaApi).mockRejectedValue(rechazo);

      await expect(guardarLaMascotaPropia(svg(TIPO_DEL_SVG))).rejects.toBe(rechazo);
    });
  });

  describe('quitarLaMascotaPropia', () => {
    it('llama con DELETE, sin cuerpo, y devuelve la cuenta como quedo', async () => {
      vi.mocked(llamarALaApi).mockResolvedValue({ id: 'una-cuenta', mascotaPropia: null });

      expect(await quitarLaMascotaPropia()).toEqual({ id: 'una-cuenta', mascotaPropia: null });
      expect(llamarALaApi).toHaveBeenCalledWith('/api/cuenta/mascota-propia', {
        metodo: 'DELETE',
      });
    });
  });

  describe('pedirLaMascotaPropia', () => {
    it('pide los bytes de la ruta de la mascota, y dice que espera un SVG', async () => {
      const archivo = svg(TIPO_DEL_SVG);

      vi.mocked(pedirBytesALaApi).mockResolvedValue(archivo);

      expect(await pedirLaMascotaPropia()).toBe(archivo);
      expect(pedirBytesALaApi).toHaveBeenCalledWith('/api/cuenta/mascota-propia', {
        acepta: 'image/svg+xml',
      });
    });

    it('pasa la senal', async () => {
      vi.mocked(pedirBytesALaApi).mockResolvedValue(svg(TIPO_DEL_SVG));

      const senal = new AbortController().signal;

      await pedirLaMascotaPropia(senal);

      expect(pedirBytesALaApi).toHaveBeenCalledWith('/api/cuenta/mascota-propia', {
        acepta: 'image/svg+xml',
        senal,
      });
    });
  });
});
