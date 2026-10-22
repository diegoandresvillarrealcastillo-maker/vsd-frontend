import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registrarElServiceWorker, type RegistrarSW } from './registrarElServiceWorker.ts';
import {
  aplicarLaVersionNueva,
  dejarLaVersionParaDespues,
  olvidarLaVersionNuevaParaLasPruebas,
  useVersionNueva,
} from './versionNueva.ts';

type Opciones = Parameters<RegistrarSW>[0];

afterEach(() => {
  olvidarLaVersionNuevaParaLasPruebas();
  vi.restoreAllMocks();
});

/** Un `registerSW` falso que guarda las opciones y entrega su `activar`. */
function registradorFalso() {
  const activar = vi.fn((_recargar?: boolean) => Promise.resolve());
  let opciones: Opciones | undefined;
  const registrar: RegistrarSW = (recibidas) => {
    opciones = recibidas;

    return activar;
  };

  return {
    registrar,
    activar,
    opciones: (): Opciones => {
      if (opciones === undefined) {
        throw new Error('no se registro nada');
      }

      return opciones;
    },
  };
}

describe('registrarElServiceWorker (SCRUM-135)', () => {
  it('lo registra de inmediato, al abrir la aplicacion', () => {
    const falso = registradorFalso();

    registrarElServiceWorker(falso.registrar);

    expect(falso.opciones().immediate).toBe(true);
  });

  it('toma la decision de recargar: sin onNeedReload el plugin recargaria por su cuenta', () => {
    const falso = registradorFalso();

    registrarElServiceWorker(falso.registrar);

    expect(falso.opciones().onNeedReload).toBeTypeOf('function');
  });

  it('no ofrece nada mientras el navegador no diga que hay una version nueva', () => {
    const falso = registradorFalso();
    const { result } = renderHook(() => useVersionNueva());

    registrarElServiceWorker(falso.registrar);

    expect(result.current).toBe('ninguna');
    expect(falso.activar).not.toHaveBeenCalled();
  });

  it('cuando hay una version nueva, la ofrece pero NO la activa sola', () => {
    const falso = registradorFalso();
    const { result } = renderHook(() => useVersionNueva());

    registrarElServiceWorker(falso.registrar);
    act(() => {
      falso.opciones().onNeedRefresh?.();
    });

    expect(result.current).toBe('actualizar');
    expect(falso.activar).not.toHaveBeenCalled();
  });

  it('al aceptar, la activa y pide recargar la pagina', async () => {
    const falso = registradorFalso();

    registrarElServiceWorker(falso.registrar);
    falso.opciones().onNeedRefresh?.();
    await aplicarLaVersionNueva();

    // `true`: sin recargar, la pagina vieja seguiria con archivos que la
    // version nueva ya retiro.
    expect(falso.activar).toHaveBeenCalledTimes(1);
    expect(falso.activar).toHaveBeenCalledWith(true);
  });

  it('si la persona lo pidio aqui, al tomar el control se recarga la pagina', async () => {
    const falso = registradorFalso();
    const recargar = vi.fn();

    registrarElServiceWorker(falso.registrar, recargar);
    falso.opciones().onNeedRefresh?.();
    await aplicarLaVersionNueva();
    falso.opciones().onNeedReload?.();

    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('si la version tomo el control sin que se pidiera aqui (otra pestana), NO se recarga: se ofrece', () => {
    const falso = registradorFalso();
    const recargar = vi.fn();
    const { result } = renderHook(() => useVersionNueva());

    registrarElServiceWorker(falso.registrar, recargar);
    act(() => {
      falso.opciones().onNeedRefresh?.();
    });
    act(() => {
      falso.opciones().onNeedReload?.();
    });

    expect(recargar).not.toHaveBeenCalled();
    expect(result.current).toBe('recargar');
  });

  it('por omision recarga la pagina de verdad (window.location.reload)', async () => {
    const falso = registradorFalso();
    const recargarDelNavegador = vi.fn();
    const original = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload: recargarDelNavegador },
    });

    try {
      registrarElServiceWorker(falso.registrar);
      falso.opciones().onNeedRefresh?.();
      await aplicarLaVersionNueva();
      falso.opciones().onNeedReload?.();

      expect(recargarDelNavegador).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('un fallo al registrar se anota y no rompe la aplicacion', () => {
    const falso = registradorFalso();
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const causa = new Error('el navegador no lo permite');

    registrarElServiceWorker(falso.registrar);

    expect(() => {
      falso.opciones().onRegisterError?.(causa);
    }).not.toThrow();
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('service worker'), causa);
  });
});

describe('buscar versiones nuevas al volver a la aplicacion (SCRUM-234)', () => {
  /** Un documento falso: guarda lo que se le pide escuchar y deja decidir si esta visible. */
  function documentoFalso() {
    const oyentes: (() => void)[] = [];
    const documento = {
      visibilityState: 'hidden' as DocumentVisibilityState,
      addEventListener: (_tipo: string, oyente: () => void) => {
        oyentes.push(oyente);
      },
    };

    return {
      documento,
      volverAPrimerPlano: () => {
        documento.visibilityState = 'visible';
        oyentes.forEach((oyente) => {
          oyente();
        });
      },
      irASegundoPlano: () => {
        documento.visibilityState = 'hidden';
        oyentes.forEach((oyente) => {
          oyente();
        });
      },
    };
  }

  function registroFalso(update: () => Promise<void> = () => Promise.resolve()) {
    return { update: vi.fn(update) } as unknown as ServiceWorkerRegistration & {
      update: ReturnType<typeof vi.fn>;
    };
  }

  it('al quedar registrado pregunta si hay una version nueva cada vez que la app vuelve a primer plano', () => {
    const falso = registradorFalso();
    const pagina = documentoFalso();
    const registro = registroFalso();

    registrarElServiceWorker(falso.registrar, () => undefined, pagina.documento);
    falso.opciones().onRegisteredSW?.('/sw.js', registro);

    expect(registro.update).not.toHaveBeenCalled();

    pagina.volverAPrimerPlano();
    pagina.irASegundoPlano();
    pagina.volverAPrimerPlano();

    // Dos regresos, dos preguntas; irse a segundo plano no pregunta nada.
    expect(registro.update).toHaveBeenCalledTimes(2);
  });

  it('ademas pregunta cada hora, para quien deja la aplicacion abierta', () => {
    vi.useFakeTimers();

    try {
      const falso = registradorFalso();
      const registro = registroFalso();

      registrarElServiceWorker(falso.registrar, () => undefined, documentoFalso().documento);
      falso.opciones().onRegisteredSW?.('/sw.js', registro);

      vi.advanceTimersByTime(59 * 60_000);
      expect(registro.update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2 * 60_000);
      expect(registro.update).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('si el navegador no entrega el registro, no hay nada que preguntar y nada se rompe', () => {
    const falso = registradorFalso();
    const pagina = documentoFalso();

    registrarElServiceWorker(falso.registrar, () => undefined, pagina.documento);

    expect(() => {
      falso.opciones().onRegisteredSW?.('/sw.js', undefined);
      pagina.volverAPrimerPlano();
    }).not.toThrow();
  });

  it('una pregunta que falla (sin conexion) no deja un error suelto', async () => {
    const falso = registradorFalso();
    const pagina = documentoFalso();
    const registro = registroFalso(() => Promise.reject(new TypeError('Failed to fetch')));

    registrarElServiceWorker(falso.registrar, () => undefined, pagina.documento);
    falso.opciones().onRegisteredSW?.('/sw.js', registro);

    pagina.volverAPrimerPlano();
    await Promise.resolve();

    expect(registro.update).toHaveBeenCalledTimes(1);
  });

  it('al volver a la aplicacion, la version que se dejo para despues se ofrece de nuevo', () => {
    vi.useFakeTimers();

    try {
      const falso = registradorFalso();
      const pagina = documentoFalso();
      const { result } = renderHook(() => useVersionNueva());

      registrarElServiceWorker(falso.registrar, () => undefined, pagina.documento);
      falso.opciones().onRegisteredSW?.('/sw.js', registroFalso());
      act(() => {
        falso.opciones().onNeedRefresh?.();
      });
      act(() => {
        dejarLaVersionParaDespues();
      });
      expect(result.current).toBe('ninguna');

      vi.advanceTimersByTime(20 * 60_000);
      act(() => {
        pagina.volverAPrimerPlano();
      });

      expect(result.current).toBe('actualizar');
    } finally {
      vi.useRealTimers();
    }
  });
});
