import type { Session } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rachaDePrueba } from '../pruebas/rachaDePrueba.ts';
import { SesionContexto, type EstadoDeSesion } from '../sesion/SesionContexto.ts';
import { fijarLaZonaDeLaCuenta } from '../tiempo/zonaHoraria.ts';
import { fraseDeLaRacha } from './frasesDeLaRacha.ts';
import { olvidarLaRacha, rachaRecordadaDe, recordarLaRacha } from './memoriaDeLaRacha.ts';
import { olvidarElAvisoDeLaTarde, useAvisoDeLaTarde } from './useAvisoDeLaTarde.ts';

/**
 * La voz de la mascota por la tarde (SCRUM-243).
 *
 * Una vez por dia, en el panel, la mascota dice lo que esta en juego: solo de tarde (desde las 18:00
 * de la persona), con hoy sin hacer y una racha de 3 dias o mas. No pide la racha: lee la que ya
 * recordo la llama de la barra.
 */
const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-9222-222222222222';

/** Las 20:30 del 21 de octubre en Bogota. */
const DE_TARDE = new Date('2026-10-22T01:30:00Z');
/** Las 10:00 del 21 de octubre en Bogota. */
const DE_MANANA = new Date('2026-10-21T15:00:00Z');

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

/** Monta el hook y todavia no llega nada del servidor. */
function montarSinRespuesta(cuenta = ANA) {
  return renderHook(() => useAvisoDeLaTarde(), { wrapper: conSesion(cuenta) });
}

/**
 * Monta el hook y hace llegar lo recordado, como cuando la llama de la barra recibe la respuesta del
 * servidor en esta visita: el hook solo habla con lo que llega, no con lo que se recordaba de antes.
 */
function usar(cuenta = ANA) {
  const resultado = montarSinRespuesta(cuenta);

  act(() => {
    const recordada = rachaRecordadaDe(cuenta);

    if (recordada !== null) {
      recordarLaRacha(cuenta, recordada);
    }
  });

  return resultado;
}

beforeEach(() => {
  fijarLaZonaDeLaCuenta('America/Bogota');
  vi.useFakeTimers({ now: DE_TARDE, toFake: ['Date'] });
  localStorage.clear();
  olvidarElAvisoDeLaTarde();
  olvidarLaRacha();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAvisoDeLaTarde', () => {
  describe('cuando habla', () => {
    it('de tarde, con hoy sin hacer y congelamientos, dice que una actividad evita gastar uno', () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));

      const { result } = usar();

      expect(result.current).toBe(fraseDeLaRacha('riesgoConCongelamientos', { dias: 12 }));
    });

    it('de tarde y sin congelamientos, dice que la racha esta en juego', () => {
      recordarLaRacha(
        ANA,
        rachaDePrueba({
          dias: 12,
          hechoHoy: false,
          congelamientosUsados: 3,
          congelamientosDisponibles: 0,
        }),
      );

      const { result } = usar();

      expect(result.current).toBe(fraseDeLaRacha('riesgoSinCongelamientos', { dias: 12 }));
    });

    it('si la racha llega despues, tambien habla', () => {
      const { result } = usar();

      expect(result.current).toBeNull();

      act(() => {
        recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));
      });

      expect(result.current).toBe(fraseDeLaRacha('riesgoConCongelamientos', { dias: 12 }));
    });
  });

  describe('solo habla con lo que llega en esta visita (revision final)', () => {
    // Lo recordado puede ser de hace horas —una PWA reanudada— o de otro equipo: decir «en juego» con un
    // dato viejo seria decir algo que quiza no es verdad, y queda marcado como dicho ese dia.
    it('lo que se recordaba de hace rato no basta: puede ser de ayer', () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));
      vi.setSystemTime(new Date(DE_TARDE.getTime() + 10 * 60_000));

      expect(montarSinRespuesta().result.current).toBeNull();
    });

    it('lo que llego hace un momento, en esta misma visita, si cuenta', () => {
      // La llama de la barra suele recibir la respuesta antes de que el panel termine de cargar.
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));
      vi.setSystemTime(new Date(DE_TARDE.getTime() + 60_000));

      expect(montarSinRespuesta().result.current).toBe(
        fraseDeLaRacha('riesgoConCongelamientos', { dias: 12 }),
      );
    });

    it('y si despues llega que hoy ya sumo, se calla', () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));
      vi.setSystemTime(new Date(DE_TARDE.getTime() + 10 * 60_000));

      const { result } = montarSinRespuesta();

      act(() => {
        recordarLaRacha(ANA, rachaDePrueba({ dias: 13, hechoHoy: true }));
      });

      expect(result.current).toBeNull();
    });

    it('en cambio, lo que llega despues de entrar si cuenta', () => {
      const { result } = montarSinRespuesta();

      act(() => {
        recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));
      });

      expect(result.current).toBe(fraseDeLaRacha('riesgoConCongelamientos', { dias: 12 }));
    });
  });

  describe('cuando se calla', () => {
    it('por la manana', () => {
      vi.setSystemTime(DE_MANANA);
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));

      expect(usar().result.current).toBeNull();
    });

    it('sin racha conocida', () => {
      expect(usar().result.current).toBeNull();
    });

    it('si hoy ya sumo', () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: true }));

      expect(usar().result.current).toBeNull();
    });

    it('con la llama en descanso', () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 0, hechoHoy: false, enDescanso: true, nivel: 0 }));

      expect(usar().result.current).toBeNull();
    });

    it('con una racha de menos de 3 dias', () => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 2, hechoHoy: false }));

      expect(usar().result.current).toBeNull();
    });

    it('con la racha de otra cuenta', () => {
      recordarLaRacha(BETO, rachaDePrueba({ dias: 12, hechoHoy: false }));

      expect(usar(ANA).result.current).toBeNull();
    });
  });

  describe('una vez al dia', () => {
    beforeEach(() => {
      recordarLaRacha(ANA, rachaDePrueba({ dias: 12, hechoHoy: false }));
    });

    it('al volver a la pantalla el mismo dia ya no lo dice', () => {
      expect(usar().result.current).not.toBeNull();

      expect(usar().result.current).toBeNull();
    });

    it('mientras la pantalla sigue abierta, la frase se mantiene', () => {
      const { result, rerender } = usar();
      const frase = result.current;

      rerender();

      expect(frase).not.toBeNull();
      expect(result.current).toBe(frase);
    });

    it('al dia siguiente lo vuelve a decir', () => {
      expect(usar().result.current).not.toBeNull();

      vi.setSystemTime(new Date(DE_TARDE.getTime() + 24 * 60 * 60 * 1000));

      expect(usar().result.current).not.toBeNull();
    });

    it('lo que se dijo a una cuenta no calla a otra', () => {
      expect(usar(ANA).result.current).not.toBeNull();

      // La memoria de la racha guarda una sola cuenta a la vez: entra la de la otra persona.
      recordarLaRacha(BETO, rachaDePrueba({ dias: 12, hechoHoy: false }));

      expect(usar(BETO).result.current).not.toBeNull();
    });

    it('si el navegador no guarda nada, lo dice una vez por visita y no falla', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('sin almacenamiento');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('sin almacenamiento');
      });

      expect(usar().result.current).not.toBeNull();
      expect(usar().result.current).toBeNull();
    });
  });
});
