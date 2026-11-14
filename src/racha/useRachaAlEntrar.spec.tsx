import type { Session } from '@supabase/supabase-js';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { olvidarLaRacha, rachaRecordadaDe, recordarLaRacha } from './memoriaDeLaRacha.ts';
import { useRachaAlEntrar } from './useRachaAlEntrar.ts';

/**
 * Pedir la racha al empezar una actividad (SCRUM-243, revision final).
 *
 * Lo ultimo que se supo puede ser de hace horas —una PWA que se reanuda sin volver a montarse, o una
 * actividad hecha en otro equipo—. Sin refrescarlo, «la primera actividad del dia» se compararia con
 * un ayer: no celebraria la primera, o celebraria la segunda. Al entrar se pide, y asi lo recordado es
 * de hace minutos.
 */
const { consultarLaRacha } = vi.hoisted(() => ({ consultarLaRacha: vi.fn() }));

vi.mock('../infraestructura/api/racha.ts', () => ({ consultarLaRacha }));

const ANA = '11111111-1111-4111-8111-111111111111';

function conSesion(id: string | undefined) {
  const estado = {
    sesion: id === undefined ? null : ({ user: { id, email: 'ana@ejemplo.test' } } as Session),
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

describe('useRachaAlEntrar', () => {
  it('al montarse pide la racha y deja recordado lo que dice el servidor', async () => {
    recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: true }));
    consultarLaRacha.mockResolvedValue(rachaDePrueba({ dias: 11, hechoHoy: false }));

    renderHook(
      () => {
        useRachaAlEntrar();
      },
      { wrapper: conSesion(ANA) },
    );

    await waitFor(() => {
      expect(rachaRecordadaDe(ANA)?.hechoHoy).toBe(false);
    });
    expect(consultarLaRacha).toHaveBeenCalledTimes(1);
  });

  it('sin sesion no pide nada', () => {
    renderHook(
      () => {
        useRachaAlEntrar();
      },
      { wrapper: conSesion(undefined) },
    );

    expect(consultarLaRacha).not.toHaveBeenCalled();
  });

  it('si no se pudo pedir, no pasa nada y se queda lo que habia', async () => {
    recordarLaRacha(ANA, rachaDePrueba({ dias: 12 }));
    consultarLaRacha.mockRejectedValue(new TypeError('Failed to fetch'));

    renderHook(
      () => {
        useRachaAlEntrar();
      },
      { wrapper: conSesion(ANA) },
    );

    await waitFor(() => {
      expect(consultarLaRacha).toHaveBeenCalled();
    });
    expect(rachaRecordadaDe(ANA)?.dias).toBe(12);
  });

  it('al salir cancela lo que estaba pidiendo', () => {
    consultarLaRacha.mockReturnValue(new Promise(() => undefined));

    const { unmount } = renderHook(
      () => {
        useRachaAlEntrar();
      },
      { wrapper: conSesion(ANA) },
    );
    const senal = consultarLaRacha.mock.calls[0]?.[0] as AbortSignal;

    expect(senal.aborted).toBe(false);

    unmount();

    expect(senal.aborted).toBe(true);
  });
});
