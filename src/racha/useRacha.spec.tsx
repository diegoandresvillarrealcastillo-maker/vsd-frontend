import type { Session } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { olvidarLaRacha, recordarLaRacha } from './memoriaDeLaRacha.ts';
import { useRacha } from './useRacha.ts';

/**
 * El hook de la racha (SCRUM-186). Desde SCRUM-243 tambien cambia cuando otra pantalla refresca la
 * racha de la misma cuenta, por ejemplo al terminar una actividad.
 */
const { consultarLaRacha } = vi.hoisted(() => ({ consultarLaRacha: vi.fn() }));

vi.mock('../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-9222-222222222222';

function conSesion(id: string) {
  const estado = {
    sesion: { user: { id, email: 'ana@ejemplo.test' } } as Session,
    cargando: false,
    correo: 'ana@ejemplo.test',
  } as unknown as EstadoDeSesion;

  return function Envoltura({ children }: { children: ReactNode }) {
    return <SesionContexto.Provider value={estado}>{children}</SesionContexto.Provider>;
  };
}

beforeEach(() => {
  consultarLaRacha.mockReset();
  olvidarLaRacha();
});

describe('useRacha', () => {
  it('cambia cuando se refresca la racha de su cuenta', async () => {
    consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 5 }));

    const { result } = renderHook(() => useRacha(), { wrapper: conSesion(ANA) });

    await waitFor(() => {
      expect(result.current?.dias).toBe(5);
    });

    act(() => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 6 }));
    });

    expect(result.current?.dias).toBe(6);
  });

  it('no cambia cuando se refresca la racha de otra cuenta', async () => {
    consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 5 }));

    const { result } = renderHook(() => useRacha(), { wrapper: conSesion(ANA) });

    await waitFor(() => {
      expect(result.current?.dias).toBe(5);
    });

    act(() => {
      recordarLaRacha(BETO, rachaDePrueba({ dias: 99 }));
    });

    expect(result.current?.dias).toBe(5);
  });

  it('al desmontarse deja de escuchar', async () => {
    consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 5 }));

    const { result, unmount } = renderHook(() => useRacha(), { wrapper: conSesion(ANA) });

    await waitFor(() => {
      expect(result.current?.dias).toBe(5);
    });

    unmount();

    expect(() => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 6 }));
    }).not.toThrow();
  });
});
