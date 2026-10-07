import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import {
  guardarLaMascotaPropia,
  pedirLaMascotaPropia,
  quitarLaMascotaPropia,
} from '../infraestructura/api/mascotaPropia.ts';
import {
  olvidarLaMascotaPropia,
  retirarLaMascotaPropia,
  sincronizarLaMascotaPropia,
  subirLaMascotaPropia,
  useMascotaPropia,
} from './mascotaPropia.ts';

vi.mock('../infraestructura/api/mascotaPropia.ts', () => ({
  guardarLaMascotaPropia: vi.fn(),
  pedirLaMascotaPropia: vi.fn(),
  quitarLaMascotaPropia: vi.fn(),
  TIPO_DEL_SVG: 'image/svg+xml',
}));

const ANA = 'cuenta-de-ana';
const BETO = 'cuenta-de-beto';
const MARCA = '2026-10-12T09:00:00.000Z';
const OTRA_MARCA = '2026-10-13T10:00:00.000Z';

const conMascota = (id: string, actualizadaEl: string): Pick<Cuenta, 'id' | 'mascotaPropia'> => ({
  id,
  mascotaPropia: { actualizadaEl },
});
const sinMascota = (id: string): Pick<Cuenta, 'id' | 'mascotaPropia'> => ({
  id,
  mascotaPropia: null,
});

const svg = (texto = '<svg/>', tipo = 'image/svg+xml'): Blob => new Blob([texto], { type: tipo });

let creadas: { url: string; blob: Blob }[];
let liberadas: string[];

async function esperar(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  creadas = [];
  liberadas = [];

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:mascota-${creadas.length + 1}`;

    creadas.push({ url, blob: blob as Blob });

    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    liberadas.push(url);
  });
  vi.mocked(pedirLaMascotaPropia).mockResolvedValue(svg('<svg id="guardado-por-el-servidor"/>'));
});

afterEach(() => {
  olvidarLaMascotaPropia();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('la mascota propia, lista para pintar (SCRUM-122)', () => {
  describe('cuando llega la cuenta', () => {
    it('sin mascota propia, no se pide nada y no hay direccion', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(sinMascota(ANA));
      await esperar();

      expect(pedirLaMascotaPropia).not.toHaveBeenCalled();
      expect(result.current).toEqual({ url: null, cargando: false });
    });

    it('con una cuenta de una API anterior, sin el campo, tampoco', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia({ id: ANA });
      await esperar();

      expect(pedirLaMascotaPropia).not.toHaveBeenCalled();
      expect(result.current.url).toBeNull();
    });

    it('con mascota propia, la pide una vez, dice que carga y despues deja la direccion', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      act(() => {
        sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      });

      expect(result.current).toEqual({ url: null, cargando: true });

      await esperar();

      expect(pedirLaMascotaPropia).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual({ url: 'blob:mascota-1', cargando: false });
    });

    it('con la marca que ya se tiene, no se vuelve a bajar', async () => {
      renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();

      expect(pedirLaMascotaPropia).toHaveBeenCalledTimes(1);
    });

    it('con una marca nueva, pide la nueva y libera la vieja', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      sincronizarLaMascotaPropia(conMascota(ANA, OTRA_MARCA));
      await esperar();

      expect(pedirLaMascotaPropia).toHaveBeenCalledTimes(2);
      expect(result.current.url).toBe('blob:mascota-2');
      expect(liberadas).toEqual(['blob:mascota-1']);
    });

    it('si se quita, la direccion desaparece y se libera', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      sincronizarLaMascotaPropia(sinMascota(ANA));
      await esperar();

      expect(result.current.url).toBeNull();
      expect(liberadas).toEqual(['blob:mascota-1']);
    });
  });

  describe('el tipo: un SVG sin tipo no se pinta', () => {
    it('lo que llega sin tipo, o con otro, se pinta como image/svg+xml', async () => {
      for (const tipo of ['', 'text/plain', 'application/octet-stream']) {
        vi.mocked(pedirLaMascotaPropia).mockResolvedValue(svg('<svg/>', tipo));
        creadas.length = 0;

        sincronizarLaMascotaPropia(conMascota(ANA, `${MARCA}-${tipo}`));
        await esperar();

        expect(creadas[0]?.blob.type).toBe('image/svg+xml');
      }
    });
  });

  describe('lo que se pinta es lo que guardo el servidor', () => {
    it('al subir, se pide de vuelta el saneado y NO se usa el archivo elegido', async () => {
      const elegido = svg('<svg onload="alert(1)"/>');

      vi.mocked(guardarLaMascotaPropia).mockResolvedValue(conMascota(ANA, MARCA) as Cuenta);

      const { result } = renderHook(() => useMascotaPropia());

      await subirLaMascotaPropia(elegido);
      await esperar();

      // Se pidio al servidor...
      expect(pedirLaMascotaPropia).toHaveBeenCalledTimes(1);
      // ...y lo que se pinta es eso, no lo que eligio la persona.
      expect(creadas).toHaveLength(1);
      expect(creadas[0]?.blob).not.toBe(elegido);
      expect(await creadas[0]?.blob.text()).toBe('<svg id="guardado-por-el-servidor"/>');
      expect(result.current.url).toBe('blob:mascota-1');
    });

    it('ni un instante se pinta el archivo original', async () => {
      const elegido = svg('<svg onload="alert(1)"/>');

      vi.mocked(guardarLaMascotaPropia).mockResolvedValue(conMascota(ANA, MARCA) as Cuenta);

      await subirLaMascotaPropia(elegido);

      // Con el archivo elegido todavia sin respuesta del servidor.
      expect(creadas.every((creada) => creada.blob !== elegido)).toBe(true);
    });

    it('subirLaMascotaPropia devuelve la cuenta como quedo', async () => {
      const cuenta = conMascota(ANA, MARCA) as Cuenta;

      vi.mocked(guardarLaMascotaPropia).mockResolvedValue(cuenta);

      expect(await subirLaMascotaPropia(svg())).toBe(cuenta);
      expect(guardarLaMascotaPropia).toHaveBeenCalledOnce();
    });

    it('si la API lo rechaza, lanza y lo que se veia se queda como estaba', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();

      vi.mocked(guardarLaMascotaPropia).mockRejectedValue(new Error('MASCOTA_SVG_PELIGROSO'));

      await expect(subirLaMascotaPropia(svg())).rejects.toThrow('MASCOTA_SVG_PELIGROSO');

      expect(result.current.url).toBe('blob:mascota-1');
      expect(liberadas).toEqual([]);
    });
  });

  describe('retirarLaMascotaPropia', () => {
    it('quita, devuelve la cuenta y deja de pintarla', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      vi.mocked(quitarLaMascotaPropia).mockResolvedValue(sinMascota(ANA) as Cuenta);

      expect(await retirarLaMascotaPropia()).toEqual(sinMascota(ANA));
      await esperar();

      expect(result.current.url).toBeNull();
    });

    it('si la API falla, lanza y se sigue viendo', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      vi.mocked(quitarLaMascotaPropia).mockRejectedValue(new Error('sin conexion'));

      await expect(retirarLaMascotaPropia()).rejects.toThrow('sin conexion');

      expect(result.current.url).toBe('blob:mascota-1');
    });
  });

  describe('es de una persona', () => {
    it('al salir, se suelta y se libera la direccion', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      act(() => {
        olvidarLaMascotaPropia();
      });

      expect(result.current).toEqual({ url: null, cargando: false });
      expect(liberadas).toEqual(['blob:mascota-1']);
    });

    it('la cuenta de otra persona no ve la de la anterior, ni aprovecha una marca igual', async () => {
      const { result } = renderHook(() => useMascotaPropia());

      sincronizarLaMascotaPropia(conMascota(ANA, MARCA));
      await esperar();
      act(() => {
        sincronizarLaMascotaPropia(conMascota(BETO, MARCA));
      });

      expect(result.current.url).toBeNull();
      expect(pedirLaMascotaPropia).toHaveBeenCalledTimes(2);
    });
  });
});
