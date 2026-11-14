import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReglasLocales } from '../infraestructura/api/reglasLocales.ts';
import contratoJson from './contrato/reglas-locales.json';
import { useReglasLocales } from './useReglasLocales.ts';

const { leerLasReglasLocalesConCopia } = vi.hoisted(() => ({
  leerLasReglasLocalesConCopia: vi.fn(),
}));

vi.mock('../sincronizacion/reglasLocalesLocal.ts', () => ({ leerLasReglasLocalesConCopia }));

const PAQUETE = (contratoJson as unknown as { paquete: ReglasLocales }).paquete;
const OTRO = { ...PAQUETE, riesgo: { ...PAQUETE.riesgo, mensaje: 'Otro mensaje.' } };

const lectura = (valor: ReglasLocales, deLaCopia = false) => ({
  valor,
  deLaCopia,
  guardadoEn: deLaCopia ? '2026-10-08T10:00:00.000Z' : null,
});

beforeEach(() => {
  leerLasReglasLocalesConCopia.mockResolvedValue(lectura(PAQUETE));
});

afterEach(() => {
  leerLasReglasLocalesConCopia.mockReset();
});

describe('useReglasLocales', () => {
  it('no se sabe nada al empezar, y despues estan las reglas', async () => {
    const gancho = renderHook(() => useReglasLocales());

    expect(gancho.result.current).toBeNull();

    await waitFor(() => {
      expect(gancho.result.current).toEqual(PAQUETE);
    });
  });

  it('las lee con una senal para poder cancelarlas', async () => {
    const gancho = renderHook(() => useReglasLocales());

    await waitFor(() => {
      expect(gancho.result.current).not.toBeNull();
    });

    expect(leerLasReglasLocalesConCopia).toHaveBeenCalledTimes(1);
    expect(leerLasReglasLocalesConCopia).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('las de la copia sirven igual: sin conexion es lo que hay', async () => {
    leerLasReglasLocalesConCopia.mockResolvedValue(lectura(PAQUETE, true));

    const gancho = renderHook(() => useReglasLocales());

    await waitFor(() => {
      expect(gancho.result.current).toEqual(PAQUETE);
    });
  });

  it('sin conexion y sin copia no hay reglas, y no se inventan', async () => {
    leerLasReglasLocalesConCopia.mockRejectedValue(new TypeError('Failed to fetch'));

    const gancho = renderHook(() => useReglasLocales());

    await waitFor(() => {
      expect(leerLasReglasLocalesConCopia).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(gancho.result.current).toBeNull();
  });

  describe('cuando vuelve la conexion', () => {
    it('las vuelve a pedir, para renovar las lineas', async () => {
      const gancho = renderHook(() => useReglasLocales());

      await waitFor(() => {
        expect(gancho.result.current).toEqual(PAQUETE);
      });

      leerLasReglasLocalesConCopia.mockResolvedValue(lectura(OTRO));
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(gancho.result.current?.riesgo.mensaje).toBe('Otro mensaje.');
      });
      expect(leerLasReglasLocalesConCopia).toHaveBeenCalledTimes(2);
    });

    it('si falla otra vez, las que ya se tenian siguen valiendo', async () => {
      const gancho = renderHook(() => useReglasLocales());

      await waitFor(() => {
        expect(gancho.result.current).toEqual(PAQUETE);
      });

      leerLasReglasLocalesConCopia.mockRejectedValue(new TypeError('Failed to fetch'));
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      await waitFor(() => {
        expect(leerLasReglasLocalesConCopia).toHaveBeenCalledTimes(2);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(gancho.result.current).toEqual(PAQUETE);
    });

    it('la lectura de antes se cancela: no pisa a la nueva', async () => {
      const senales: AbortSignal[] = [];
      let soltarLaVieja: (valor: ReturnType<typeof lectura>) => void = () => undefined;

      leerLasReglasLocalesConCopia.mockImplementationOnce((senal: AbortSignal) => {
        senales.push(senal);

        return new Promise((resolver) => {
          soltarLaVieja = resolver;
        });
      });

      const gancho = renderHook(() => useReglasLocales());

      leerLasReglasLocalesConCopia.mockResolvedValue(lectura(OTRO));
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      await waitFor(() => {
        expect(gancho.result.current?.riesgo.mensaje).toBe('Otro mensaje.');
      });

      expect(senales[0]?.aborted).toBe(true);

      await act(async () => {
        soltarLaVieja(lectura(PAQUETE));
        await Promise.resolve();
      });

      expect(gancho.result.current?.riesgo.mensaje).toBe('Otro mensaje.');
    });
  });

  it('al desmontarse cancela la lectura y deja de escuchar', async () => {
    const senales: AbortSignal[] = [];

    leerLasReglasLocalesConCopia.mockImplementation((senal: AbortSignal) => {
      senales.push(senal);

      return new Promise(() => undefined);
    });

    const gancho = renderHook(() => useReglasLocales());

    await waitFor(() => {
      expect(senales).toHaveLength(1);
    });
    gancho.unmount();

    expect(senales[0]?.aborted).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(leerLasReglasLocalesConCopia).toHaveBeenCalledTimes(1);
  });
});
