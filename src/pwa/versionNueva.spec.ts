import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  aplicarLaVersionNueva,
  avisarVersionNueva,
  dejarLaVersionParaDespues,
  laVersionNuevaTomoElControl,
  olvidarLaVersionNuevaParaLasPruebas,
  recargarAhora,
  useVersionNueva,
} from './versionNueva.ts';

afterEach(() => {
  olvidarLaVersionNuevaParaLasPruebas();
});

describe('la version nueva (SCRUM-135)', () => {
  describe('ofrecer actualizar', () => {
    it('al abrir la aplicacion no hay nada que ofrecer', () => {
      const { result } = renderHook(() => useVersionNueva());

      expect(result.current).toBe('ninguna');
    });

    it('cuando el registro avisa, se ofrece actualizar', () => {
      const { result } = renderHook(() => useVersionNueva());

      act(() => {
        avisarVersionNueva(() => Promise.resolve());
      });

      expect(result.current).toBe('actualizar');
    });

    it('"despues" la esconde en esta visita', () => {
      const { result } = renderHook(() => useVersionNueva());

      act(() => {
        avisarVersionNueva(() => Promise.resolve());
      });
      act(() => {
        dejarLaVersionParaDespues();
      });

      expect(result.current).toBe('ninguna');
    });

    it('pero si el registro vuelve a avisar, se vuelve a ofrecer', () => {
      const { result } = renderHook(() => useVersionNueva());

      act(() => {
        avisarVersionNueva(() => Promise.resolve());
        dejarLaVersionParaDespues();
      });
      act(() => {
        avisarVersionNueva(() => Promise.resolve());
      });

      expect(result.current).toBe('actualizar');
    });

    it('aplicar llama a lo que dejo el registro', async () => {
      const activar = vi.fn(() => Promise.resolve());

      avisarVersionNueva(activar);
      await aplicarLaVersionNueva();

      expect(activar).toHaveBeenCalledTimes(1);
    });

    it('aplicar usa la ultima funcion que dejo el registro', async () => {
      const vieja = vi.fn(() => Promise.resolve());
      const nueva = vi.fn(() => Promise.resolve());

      avisarVersionNueva(vieja);
      avisarVersionNueva(nueva);
      await aplicarLaVersionNueva();

      expect(vieja).not.toHaveBeenCalled();
      expect(nueva).toHaveBeenCalledTimes(1);
    });

    it('aplicar sin que nadie haya avisado no falla', async () => {
      await expect(aplicarLaVersionNueva()).resolves.toBeUndefined();
    });

    it('"despues" no borra lo que hace falta para aplicar', async () => {
      const activar = vi.fn(() => Promise.resolve());

      avisarVersionNueva(activar);
      dejarLaVersionParaDespues();
      await aplicarLaVersionNueva();

      expect(activar).toHaveBeenCalledTimes(1);
    });

    it('varias pantallas escuchando se enteran todas, y las que se fueron ya no', () => {
      const una = renderHook(() => useVersionNueva());
      const otra = renderHook(() => useVersionNueva());

      otra.unmount();

      act(() => {
        avisarVersionNueva(() => Promise.resolve());
      });

      expect(una.result.current).toBe('actualizar');
      // Desmontada, conserva lo ultimo que vio y no se actualiza (ni falla).
      expect(otra.result.current).toBe('ninguna');
    });
  });

  describe('cuando la version nueva toma el control', () => {
    it('si la persona la pidio en esta pestana, recarga', async () => {
      const recargar = vi.fn();

      avisarVersionNueva(() => Promise.resolve());
      await aplicarLaVersionNueva();
      laVersionNuevaTomoElControl(recargar);

      expect(recargar).toHaveBeenCalledTimes(1);
    });

    it('si la persona NO la pidio aqui (la acepto en otra pestana), no recarga: lo ofrece', () => {
      const recargar = vi.fn();
      const { result } = renderHook(() => useVersionNueva());

      act(() => {
        avisarVersionNueva(() => Promise.resolve());
      });
      act(() => {
        laVersionNuevaTomoElControl(recargar);
      });

      expect(recargar).not.toHaveBeenCalled();
      expect(result.current).toBe('recargar');
    });

    it('sin que nadie hubiera avisado antes, tambien lo ofrece y no recarga', () => {
      const recargar = vi.fn();
      const { result } = renderHook(() => useVersionNueva());

      act(() => {
        laVersionNuevaTomoElControl(recargar);
      });

      expect(recargar).not.toHaveBeenCalled();
      expect(result.current).toBe('recargar');
    });

    it('"recargar ahora" recarga cuando la persona lo decide', () => {
      const recargar = vi.fn();

      laVersionNuevaTomoElControl(recargar);
      expect(recargar).not.toHaveBeenCalled();

      recargarAhora();

      expect(recargar).toHaveBeenCalledTimes(1);
    });

    it('"recargar ahora" sin nada pendiente no hace nada ni falla', () => {
      expect(() => {
        recargarAhora();
      }).not.toThrow();
    });

    it('"despues" no sirve para la oferta de recargar: esa pagina ya esta desincronizada', () => {
      const { result } = renderHook(() => useVersionNueva());

      act(() => {
        laVersionNuevaTomoElControl(() => undefined);
      });
      act(() => {
        dejarLaVersionParaDespues();
      });

      expect(result.current).toBe('recargar');
    });

    it('si pedir la actualizacion falla, una activacion posterior ya no cuenta como pedida aqui', async () => {
      const recargar = vi.fn();

      avisarVersionNueva(() => Promise.reject(new Error('no se pudo')));
      await expect(aplicarLaVersionNueva()).rejects.toThrow('no se pudo');

      // Mas tarde la version se activa por otra via (otra pestana).
      laVersionNuevaTomoElControl(recargar);

      expect(recargar).not.toHaveBeenCalled();
    });
  });
});
