import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Cuenta } from '../infraestructura/api/cuenta.ts';
import { guardarLaFoto, pedirLaFoto, quitarLaFoto } from '../infraestructura/api/foto.ts';
import {
  olvidarLaFoto,
  retirarLaFoto,
  sincronizarLaFoto,
  subirLaFoto,
  useFotoDePerfil,
} from './fotoDePerfil.ts';

vi.mock('../infraestructura/api/foto.ts', () => ({
  guardarLaFoto: vi.fn(),
  pedirLaFoto: vi.fn(),
  quitarLaFoto: vi.fn(),
}));

const ANA = 'cuenta-de-ana';
const BETO = 'cuenta-de-beto';
const ANTES = '2026-10-09T15:30:00.000Z';
const DESPUES = '2026-10-10T08:00:00.000Z';

const conFoto = (id: string, actualizadaEl: string): Pick<Cuenta, 'id' | 'foto'> => ({
  id,
  foto: { actualizadaEl },
});
const sinFoto = (id: string): Pick<Cuenta, 'id' | 'foto'> => ({ id, foto: null });

/** Una promesa que se resuelve a mano, para controlar el orden en que llegan las respuestas. */
function aplazada<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((alResolver, alRechazar) => {
    resolver = alResolver;
    rechazar = alRechazar;
  });

  return { promesa, resolver, rechazar };
}

const archivoDe = (valor: number): Blob =>
  new Blob([new Uint8Array([valor])], { type: 'image/jpeg' });

/** Lo que el navegador entrego con `createObjectURL`, para saber de que blob es cada direccion. */
let creadas: { url: string; blob: Blob }[];
let liberadas: string[];

/** Deja que las promesas pendientes terminen. */
async function esperar(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  creadas = [];
  liberadas = [];

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:foto-${creadas.length + 1}`;

    creadas.push({ url, blob: blob as Blob });

    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    liberadas.push(url);
  });
  vi.mocked(pedirLaFoto).mockResolvedValue(archivoDe(1));
});

afterEach(() => {
  olvidarLaFoto();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('la foto de perfil, lista para pintar (SCRUM-120)', () => {
  describe('cuando llega la cuenta', () => {
    it('sin foto, no se pide nada y no hay direccion', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(sinFoto(ANA));
      await esperar();

      expect(pedirLaFoto).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    });

    it('con una cuenta que ni dice nada de la foto (una API anterior), tampoco', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto({ id: ANA });
      await esperar();

      expect(pedirLaFoto).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    });

    it('con foto, la pide una vez y deja la direccion lista', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      expect(pedirLaFoto).toHaveBeenCalledTimes(1);
      expect(result.current).toBe('blob:foto-1');
    });

    it('la misma marca dos veces seguidas pide una sola vez, aunque la primera no haya llegado', () => {
      const respuesta = aplazada<Blob>();

      vi.mocked(pedirLaFoto).mockReturnValue(respuesta.promesa);

      sincronizarLaFoto(conFoto(ANA, ANTES));
      sincronizarLaFoto(conFoto(ANA, ANTES));
      sincronizarLaFoto(conFoto(ANA, ANTES));

      expect(pedirLaFoto).toHaveBeenCalledTimes(1);
    });

    it('con la marca que ya se tiene, no se vuelve a bajar', async () => {
      renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      expect(pedirLaFoto).toHaveBeenCalledTimes(1);
      expect(liberadas).toEqual([]);
    });

    it('con una marca nueva, pide la foto nueva y libera la direccion de la vieja', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      vi.mocked(pedirLaFoto).mockResolvedValue(archivoDe(2));
      sincronizarLaFoto(conFoto(ANA, DESPUES));
      await esperar();

      expect(pedirLaFoto).toHaveBeenCalledTimes(2);
      expect(result.current).toBe('blob:foto-2');
      expect(liberadas).toEqual(['blob:foto-1']);
    });

    it('si la foto se quita, la direccion desaparece y se libera', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      sincronizarLaFoto(sinFoto(ANA));
      await esperar();

      expect(result.current).toBeNull();
      expect(liberadas).toEqual(['blob:foto-1']);
    });

    it('si ya se tiene a mano el archivo, se usa y no se pide', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const elegida = archivoDe(7);

      sincronizarLaFoto(conFoto(ANA, ANTES), elegida);
      await esperar();

      expect(pedirLaFoto).not.toHaveBeenCalled();
      expect(creadas).toEqual([{ url: 'blob:foto-1', blob: elegida }]);
      expect(result.current).toBe('blob:foto-1');
    });
  });

  describe('cuando algo sale mal', () => {
    it('si no se pudo pedir, se ve el icono de siempre, sin romper nada', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      vi.mocked(pedirLaFoto).mockRejectedValue(new Error('sin conexion'));

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      expect(result.current).toBeNull();
    });

    it('la proxima vez que llega la cuenta, se vuelve a intentar', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      vi.mocked(pedirLaFoto).mockRejectedValueOnce(new Error('sin conexion'));
      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      expect(pedirLaFoto).toHaveBeenCalledTimes(2);
      expect(result.current).toBe('blob:foto-1');
    });

    it('si falla la foto nueva, no se sigue mostrando la vieja, que ya no es la suya', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      vi.mocked(pedirLaFoto).mockRejectedValue(new Error('sin conexion'));
      sincronizarLaFoto(conFoto(ANA, DESPUES));
      await esperar();

      expect(result.current).toBeNull();
      expect(liberadas).toEqual(['blob:foto-1']);
    });
  });

  describe('las respuestas que llegan tarde', () => {
    it('una respuesta vieja no pisa a la nueva', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const primera = aplazada<Blob>();
      const segunda = aplazada<Blob>();

      vi.mocked(pedirLaFoto)
        .mockReturnValueOnce(primera.promesa)
        .mockReturnValueOnce(segunda.promesa);

      sincronizarLaFoto(conFoto(ANA, ANTES));
      sincronizarLaFoto(conFoto(ANA, DESPUES));

      const nueva = archivoDe(2);

      segunda.resolver(nueva);
      await esperar();
      primera.resolver(archivoDe(1));
      await esperar();

      expect(creadas).toHaveLength(1);
      expect(creadas[0]?.blob).toBe(nueva);
      expect(result.current).toBe('blob:foto-1');
    });

    it('si mientras llegaba se quito la foto, no aparece de golpe', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const respuesta = aplazada<Blob>();

      vi.mocked(pedirLaFoto).mockReturnValue(respuesta.promesa);

      sincronizarLaFoto(conFoto(ANA, ANTES));
      sincronizarLaFoto(sinFoto(ANA));
      respuesta.resolver(archivoDe(1));
      await esperar();

      expect(result.current).toBeNull();
      expect(creadas).toEqual([]);
    });

    it('si mientras llegaba se salio, tampoco', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const respuesta = aplazada<Blob>();

      vi.mocked(pedirLaFoto).mockReturnValue(respuesta.promesa);

      sincronizarLaFoto(conFoto(ANA, ANTES));
      olvidarLaFoto();
      respuesta.resolver(archivoDe(1));
      await esperar();

      expect(result.current).toBeNull();
      expect(creadas).toEqual([]);
    });

    it('un fallo viejo no borra la foto que llego despues', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const primera = aplazada<Blob>();

      vi.mocked(pedirLaFoto)
        .mockReturnValueOnce(primera.promesa)
        .mockResolvedValueOnce(archivoDe(2));

      sincronizarLaFoto(conFoto(ANA, ANTES));
      sincronizarLaFoto(conFoto(ANA, DESPUES));
      await esperar();
      primera.rechazar(new Error('sin conexion'));
      await esperar();

      expect(result.current).toBe('blob:foto-1');
    });
  });

  describe('es de una persona', () => {
    it('al salir, se suelta y se libera la direccion', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      act(() => {
        olvidarLaFoto();
      });

      expect(result.current).toBeNull();
      expect(liberadas).toEqual(['blob:foto-1']);
    });

    it('al llegar la cuenta de otra persona, no se ve la foto de la anterior ni un instante', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const respuesta = aplazada<Blob>();

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      vi.mocked(pedirLaFoto).mockReturnValue(respuesta.promesa);
      act(() => {
        sincronizarLaFoto(conFoto(BETO, ANTES));
      });

      // Beto tiene la misma marca que Ana, y aun asi no se aprovecha lo de Ana.
      expect(result.current).toBeNull();
      expect(pedirLaFoto).toHaveBeenCalledTimes(2);
      expect(liberadas).toEqual(['blob:foto-1']);

      respuesta.resolver(archivoDe(5));
      await esperar();

      expect(result.current).toBe('blob:foto-2');
    });

    it('la otra persona sin foto no hereda la de la anterior', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      act(() => {
        sincronizarLaFoto(sinFoto(BETO));
      });

      expect(result.current).toBeNull();
    });
  });

  describe('subirLaFoto', () => {
    it('guarda, devuelve la cuenta y deja lista la foto elegida sin pedirla de vuelta', async () => {
      const { result } = renderHook(() => useFotoDePerfil());
      const elegida = archivoDe(3);
      const cuenta = conFoto(ANA, ANTES) as Cuenta;

      vi.mocked(guardarLaFoto).mockResolvedValue(cuenta);

      expect(await subirLaFoto(elegida)).toBe(cuenta);
      await esperar();

      expect(guardarLaFoto).toHaveBeenCalledWith(elegida);
      expect(pedirLaFoto).not.toHaveBeenCalled();
      expect(creadas[0]?.blob).toBe(elegida);
      expect(result.current).toBe('blob:foto-1');
    });

    it('si la API la rechaza, lanza y lo que se veia se queda como estaba', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      vi.mocked(guardarLaFoto).mockRejectedValue(new Error('FOTO_DEMASIADO_PESADA'));

      await expect(subirLaFoto(archivoDe(3))).rejects.toThrow('FOTO_DEMASIADO_PESADA');

      expect(result.current).toBe('blob:foto-1');
      expect(liberadas).toEqual([]);
    });
  });

  describe('retirarLaFoto', () => {
    it('quita, devuelve la cuenta y deja de pintar la foto', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      vi.mocked(quitarLaFoto).mockResolvedValue(sinFoto(ANA) as Cuenta);

      expect(await retirarLaFoto()).toEqual(sinFoto(ANA));
      await esperar();

      expect(result.current).toBeNull();
    });

    it('si la API falla, lanza y la foto se sigue viendo', async () => {
      const { result } = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();
      vi.mocked(quitarLaFoto).mockRejectedValue(new Error('sin conexion'));

      await expect(retirarLaFoto()).rejects.toThrow('sin conexion');

      expect(result.current).toBe('blob:foto-1');
    });
  });

  describe('el hook', () => {
    it('cada pieza que la usa se entera cuando cambia', async () => {
      const una = renderHook(() => useFotoDePerfil());
      const otra = renderHook(() => useFotoDePerfil());

      sincronizarLaFoto(conFoto(ANA, ANTES));
      await esperar();

      expect(una.result.current).toBe('blob:foto-1');
      expect(otra.result.current).toBe('blob:foto-1');
    });

    it('una pieza que ya no esta no recibe avisos ni da error', () => {
      const { unmount } = renderHook(() => useFotoDePerfil());

      unmount();

      expect(() => {
        sincronizarLaFoto(conFoto(ANA, ANTES));
        olvidarLaFoto();
      }).not.toThrow();
    });
  });
});
