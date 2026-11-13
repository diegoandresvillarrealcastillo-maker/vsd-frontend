import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { alSincronizarUnResultado, avisarResultadoSincronizado } from './resultadoSincronizado.ts';

type Mensaje = { persona?: unknown; tipo?: unknown } | null;

class CanalFalso {
  static instancia: CanalFalso | null = null;
  readonly mensajes: unknown[] = [];
  cerrado = false;
  readonly nombre: string;
  private oyente: ((evento: MessageEvent<unknown>) => void) | null = null;

  constructor(nombre: string) {
    this.nombre = nombre;
    CanalFalso.instancia = this;
  }

  addEventListener(_tipo: string, oyente: (evento: MessageEvent<unknown>) => void): void {
    this.oyente = oyente;
  }

  postMessage(mensaje: unknown): void {
    this.mensajes.push(mensaje);
  }

  close(): void {
    this.cerrado = true;
  }

  recibir(datos: Mensaje): void {
    this.oyente?.({ data: datos } as MessageEvent<unknown>);
  }
}

beforeEach(() => {
  CanalFalso.instancia = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('avisos de resultados sincronizados', () => {
  it('notifica a quienes escuchan en esta pestaña y deja de hacerlo al cancelar', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const oyente = vi.fn();
    const dejarDeEscuchar = alSincronizarUnResultado(oyente);

    avisarResultadoSincronizado('cuenta-a');
    dejarDeEscuchar();
    avisarResultadoSincronizado('cuenta-b');

    expect(oyente).toHaveBeenCalledExactlyOnceWith('cuenta-a');
  });

  it('un oyente con error no impide avisar a los demas', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const segundoOyente = vi.fn();
    const dejarPrimero = alSincronizarUnResultado(() => {
      throw new Error('fallo de una pantalla');
    });
    const dejarSegundo = alSincronizarUnResultado(segundoOyente);

    expect(() => avisarResultadoSincronizado('cuenta-a')).not.toThrow();
    expect(segundoOyente).toHaveBeenCalledExactlyOnceWith('cuenta-a');

    dejarPrimero();
    dejarSegundo();
  });

  it('ignora mensajes ajenos y propaga solo el id de cuenta entre pestañas', () => {
    vi.stubGlobal('BroadcastChannel', CanalFalso);
    const oyente = vi.fn();
    const dejarDeEscuchar = alSincronizarUnResultado(oyente);
    const canal = CanalFalso.instancia;

    expect(canal?.nombre).toBe('vsd-cola');
    canal?.recibir(null);
    canal?.recibir({ tipo: 'otro-evento', persona: 'cuenta-b' });
    canal?.recibir({ tipo: 'resultado-sincronizado', persona: 42 });
    expect(oyente).not.toHaveBeenCalled();

    canal?.recibir({ tipo: 'resultado-sincronizado', persona: 'cuenta-b' });
    avisarResultadoSincronizado('cuenta-a');

    expect(oyente).toHaveBeenNthCalledWith(1, 'cuenta-b');
    expect(oyente).toHaveBeenNthCalledWith(2, 'cuenta-a');
    expect(canal?.mensajes).toEqual([{ persona: 'cuenta-a', tipo: 'resultado-sincronizado' }]);

    dejarDeEscuchar();
    expect(canal?.cerrado).toBe(true);
  });
});
