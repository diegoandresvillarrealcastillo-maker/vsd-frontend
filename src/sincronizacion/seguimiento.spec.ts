import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nuevaOperacion, type Operacion } from './cola.ts';
import type { EventoDelMotor, MotivoDeSincronizacion, ResultadoDeSincronizacion } from './motor.ts';
import { ESPERA_MAXIMA_EN_MS, seguirUnaOperacion } from './seguimiento.ts';

/**
 * El seguimiento, aislado del resto del nucleo: el ciclo y el motor son dobles que cada
 * prueba mueve a mano.
 */
const mundo = vi.hoisted(() => ({
  ciclo: null as null | {
    persona: string;
    almacen: { operacion: (id: string) => Promise<unknown> };
    motor: {
      sincronizar: (motivo: string) => Promise<unknown>;
      estaSincronizando: () => boolean;
      suscribir: (oyente: (evento: unknown) => void) => () => void;
    };
  },
  oyentesDelCiclo: new Set<() => void>(),
  oyentesDeLaCola: new Set<() => void>(),
}));

vi.mock('./ciclo.ts', () => ({
  cicloActual: () => mundo.ciclo,
  suscribirAlCiclo: (oyente: () => void) => {
    mundo.oyentesDelCiclo.add(oyente);

    return () => {
      mundo.oyentesDelCiclo.delete(oyente);
    };
  },
  suscribirALaCola: (oyente: () => void) => {
    mundo.oyentesDeLaCola.add(oyente);

    return () => {
      mundo.oyentesDeLaCola.delete(oyente);
    };
  },
}));

const SIN_NADA = { enviadas: 0, requierenAtencion: 0, conflictos: 0, pendientes: 0, recibos: [] };

function resultado(estado: ResultadoDeSincronizacion['estado']): ResultadoDeSincronizacion {
  return { estado, resumen: SIN_NADA };
}

function operacion(cambios: Partial<Operacion> = {}): Operacion {
  return {
    ...nuevaOperacion(
      {
        operationId: 'op-1',
        tipo: 'resultado.registrar',
        entidad: 'resultado:op-1',
        payload: {},
      },
      new Date(),
    ),
    ...cambios,
  };
}

function crearCiclo() {
  const datos = {
    operacion: operacion() as Operacion | null,
    lecturas: 0,
    alSincronizar: null as null | (() => Promise<ResultadoDeSincronizacion>),
  };
  const oyentesDelMotor = new Set<(evento: EventoDelMotor) => void>();
  const sincronizaciones: MotivoDeSincronizacion[] = [];
  const ciclo = {
    persona: 'ana',
    almacen: {
      operacion: (id: string) => {
        datos.lecturas += 1;

        return Promise.resolve(id === 'op-1' ? datos.operacion : null);
      },
    },
    motor: {
      sincronizar: vi.fn((motivo: string) => {
        sincronizaciones.push(motivo as MotivoDeSincronizacion);

        return (datos.alSincronizar ?? (() => Promise.resolve(resultado('terminada'))))();
      }),
      estaSincronizando: () => false,
      suscribir: (oyente: (evento: unknown) => void) => {
        oyentesDelMotor.add(oyente);

        return () => {
          oyentesDelMotor.delete(oyente);
        };
      },
    },
  };

  return {
    ciclo,
    datos,
    sincronizaciones,
    terminaUnaTanda: () => {
      [...oyentesDelMotor].forEach((oyente) => {
        oyente({ tipo: 'fin', resultado: resultado('terminada') });
      });
    },
    oyentesDelMotor: () => oyentesDelMotor.size,
  };
}

type Ciclo = ReturnType<typeof crearCiclo>;

function abrir(c: Ciclo): void {
  mundo.ciclo = c.ciclo;
}

const HECHA = { estado: 'hecha' as const, recibo: { id: 'srv-1', nivelOrientativo: 'favorable' } };
const RECHAZADA = {
  estado: 'requiere_atencion' as const,
  error: { codigo: 'PUNTAJE_FUERA_DE_RANGO', estado: 400, momento: 'ahora' },
};

beforeEach(() => {
  mundo.ciclo = null;
  mundo.oyentesDelCiclo.clear();
  mundo.oyentesDeLaCola.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('seguirUnaOperacion: lo que se sabe de entrada (SCRUM-138)', () => {
  it('sin almacen, no hay donde mirar', async () => {
    expect(await seguirUnaOperacion('op-1')).toEqual({ tipo: 'sin_almacen' });
  });

  it('si ya se envio, devuelve lo que respondio la API', async () => {
    const c = crearCiclo();

    c.datos.operacion = operacion(HECHA);
    abrir(c);

    expect(await seguirUnaOperacion('op-1')).toEqual({
      tipo: 'enviada',
      recibo: { id: 'srv-1', nivelOrientativo: 'favorable' },
    });
  });

  it('si la API la rechazo, lo dice con su codigo', async () => {
    const c = crearCiclo();

    c.datos.operacion = operacion(RECHAZADA);
    abrir(c);

    expect(await seguirUnaOperacion('op-1')).toEqual({
      tipo: 'rechazada',
      error: RECHAZADA.error,
      conflicto: false,
    });
  });

  it('un conflicto se distingue de un rechazo', async () => {
    const c = crearCiclo();

    c.datos.operacion = operacion({
      estado: 'conflicto',
      error: { codigo: 'VERSION_DESACTUALIZADA', estado: 409, momento: 'ahora' },
    });
    abrir(c);

    expect(await seguirUnaOperacion('op-1')).toMatchObject({ tipo: 'rechazada', conflicto: true });
  });

  it('si ya no esta (la descartaron), no se envio y no va a enviarse', async () => {
    const c = crearCiclo();

    c.datos.operacion = null;
    abrir(c);

    expect(await seguirUnaOperacion('op-1')).toEqual({
      tipo: 'rechazada',
      error: null,
      conflicto: false,
    });
  });

  it('no sincroniza si no se pide', async () => {
    const c = crearCiclo();

    c.datos.operacion = operacion(HECHA);
    abrir(c);
    await seguirUnaOperacion('op-1');

    expect(c.sincronizaciones).toEqual([]);
  });
});

describe('seguirUnaOperacion: recien guardada (sincronizarYa)', () => {
  it('pide sincronizar, y si salio, devuelve la respuesta de la API', async () => {
    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => {
      c.datos.operacion = operacion(HECHA);

      return Promise.resolve(resultado('terminada'));
    };

    expect(await seguirUnaOperacion('op-1', { sincronizarYa: true })).toEqual({
      tipo: 'enviada',
      recibo: HECHA.recibo,
    });
    expect(c.sincronizaciones).toEqual(['programada']);
  });

  it('sin conexion, queda guardada y lo dice de inmediato, sin esperar el tiempo maximo', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('sin_conexion'));

    expect(await seguirUnaOperacion('op-1', { sincronizarYa: true })).toEqual({ tipo: 'guardada' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si el servidor fallo y se va a reintentar, queda guardada', async () => {
    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => {
      c.datos.operacion = operacion({
        intentos: 1,
        proximoIntento: new Date(Date.now() + 5000).toISOString(),
      });

      return Promise.resolve(resultado('terminada'));
    };

    expect(await seguirUnaOperacion('op-1', { sincronizarYa: true })).toEqual({ tipo: 'guardada' });
  });

  it('si la API la rechazo en esa tanda, lo dice', async () => {
    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => {
      c.datos.operacion = operacion(RECHAZADA);

      return Promise.resolve(resultado('terminada'));
    };

    expect(await seguirUnaOperacion('op-1', { sincronizarYa: true })).toMatchObject({
      tipo: 'rechazada',
    });
  });

  it('si ya estaba hecha, no vuelve a sincronizar', async () => {
    const c = crearCiclo();

    c.datos.operacion = operacion(HECHA);
    abrir(c);
    await seguirUnaOperacion('op-1', { sincronizarYa: true });

    expect(c.sincronizaciones).toEqual([]);
  });

  it('si habia otra tanda en marcha (ocupada), espera a que termine y mira de nuevo', async () => {
    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('ocupada'));

    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true });

    await vi.waitFor(() => {
      expect(c.oyentesDelMotor()).toBe(1);
    });
    c.datos.operacion = operacion(HECHA);
    c.terminaUnaTanda();

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });

  it('ocupada con otra pestana: si la cola cambia, mira de nuevo', async () => {
    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('ocupada'));

    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true });

    await vi.waitFor(() => {
      expect(mundo.oyentesDeLaCola.size).toBe(1);
    });
    c.datos.operacion = operacion(HECHA);
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });

  it('ocupada y nada pasa: pasado el tiempo maximo, queda guardada', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('ocupada'));

    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true });

    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_EN_MS);

    expect(await seguimiento).toEqual({ tipo: 'guardada' });
  });

  it('cuando algo cambia antes de que se acabe el tiempo, no queda ningun temporizador vivo', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('ocupada'));

    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true });

    await vi.waitFor(() => {
      expect(c.oyentesDelMotor()).toBe(1);
    });

    expect(vi.getTimerCount()).toBe(1);

    c.datos.operacion = operacion(HECHA);
    c.terminaUnaTanda();
    await seguimiento;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('el tiempo maximo es de 5 segundos: lo guardado ya esta a salvo, no hay por que hacer esperar', () => {
    expect(ESPERA_MAXIMA_EN_MS).toBe(5000);
  });

  it('con un servidor lento (la tanda no termina), dice guardada al pasar el tiempo, sin esperar a la tanda', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => new Promise(() => undefined);

    let termino = false;
    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true }).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_EN_MS - 1);

    expect(termino).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(await seguimiento).toEqual({ tipo: 'guardada' });
    expect(c.sincronizaciones).toEqual(['programada']);
  });

  it('y si justo en ese momento salio, lo dice', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => new Promise(() => undefined);

    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true });

    await vi.advanceTimersByTimeAsync(1000);
    c.datos.operacion = operacion(HECHA);
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_EN_MS);

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });

  it('esperando sin limite, una tanda lenta no corta la espera: se espera a que termine', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();
    let terminarLaTanda: () => void = () => undefined;

    abrir(c);
    c.datos.alSincronizar = () =>
      new Promise((resolver) => {
        terminarLaTanda = () => {
          resolver(resultado('terminada'));
        };
      });

    let termino = false;
    const seguimiento = seguirUnaOperacion('op-1', {
      sincronizarYa: true,
      esperaMaximaEnMs: null,
    }).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(termino).toBe(false);

    c.datos.operacion = operacion(HECHA);
    terminarLaTanda();

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });

  it('la espera maxima se puede cambiar, y se respeta al milisegundo', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('ocupada'));

    let termino = false;
    const seguimiento = seguirUnaOperacion('op-1', {
      sincronizarYa: true,
      esperaMaximaEnMs: 1000,
    }).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(999);

    expect(termino).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(await seguimiento).toEqual({ tipo: 'guardada' });
  });

  it('en la ultima mirada, si justo salio, lo dice', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('ocupada'));

    const seguimiento = seguirUnaOperacion('op-1', { sincronizarYa: true });

    await vi.advanceTimersByTimeAsync(1000);
    c.datos.operacion = operacion(HECHA);
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_EN_MS);

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });
});

describe('seguirUnaOperacion: esperar todo lo que haga falta (esperaMaximaEnMs: null)', () => {
  it('no se rinde cuando una tanda termina sin enviarla: sigue esperando la proxima', async () => {
    const c = crearCiclo();

    abrir(c);

    const seguimiento = seguirUnaOperacion('op-1', { esperaMaximaEnMs: null });

    await vi.waitFor(() => {
      expect(c.oyentesDelMotor()).toBe(1);
    });
    c.terminaUnaTanda();
    await vi.waitFor(() => {
      expect(c.oyentesDelMotor()).toBe(1);
    });
    c.datos.operacion = operacion(HECHA);
    c.terminaUnaTanda();

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });

  it('sincronizando y sin conexion, sigue esperando: lo guardado no se da por perdido', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.resolve(resultado('sin_conexion'));

    let termino = false;
    const seguimiento = seguirUnaOperacion('op-1', {
      sincronizarYa: true,
      esperaMaximaEnMs: null,
    }).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(termino).toBe(false);

    c.datos.operacion = operacion(HECHA);
    c.terminaUnaTanda();

    expect(await seguimiento).toMatchObject({ tipo: 'enviada' });
  });

  it('no deja un temporizador esperando para siempre', async () => {
    vi.useFakeTimers();

    const c = crearCiclo();

    abrir(c);

    const seguimiento = seguirUnaOperacion('op-1', { esperaMaximaEnMs: null });

    await vi.waitFor(() => {
      expect(c.oyentesDelMotor()).toBe(1);
    });

    expect(vi.getTimerCount()).toBe(0);

    c.datos.operacion = operacion(HECHA);
    c.terminaUnaTanda();
    await seguimiento;
  });
});

describe('seguirUnaOperacion: cancelar y cerrar', () => {
  it('si se cancela, deja de esperar, devuelve guardada y no deja nada escuchando', async () => {
    const c = crearCiclo();
    const control = new AbortController();

    abrir(c);

    const seguimiento = seguirUnaOperacion('op-1', {
      esperaMaximaEnMs: null,
      senal: control.signal,
    });

    await vi.waitFor(() => {
      expect(c.oyentesDelMotor()).toBe(1);
    });
    control.abort();

    expect(await seguimiento).toEqual({ tipo: 'guardada' });
    expect(c.oyentesDelMotor()).toBe(0);
    expect(mundo.oyentesDeLaCola.size).toBe(0);
    expect(mundo.oyentesDelCiclo.size).toBe(0);
  });

  it('ya cancelado de entrada, ni siquiera pide sincronizar', async () => {
    const c = crearCiclo();
    const control = new AbortController();

    control.abort();
    abrir(c);

    expect(
      await seguirUnaOperacion('op-1', { sincronizarYa: true, senal: control.signal }),
    ).toEqual({
      tipo: 'guardada',
    });
    expect(c.sincronizaciones).toEqual([]);
  });

  it('ya cancelado de entrada, ni espera', async () => {
    const c = crearCiclo();
    const control = new AbortController();

    control.abort();
    abrir(c);

    expect(
      await seguirUnaOperacion('op-1', { esperaMaximaEnMs: null, senal: control.signal }),
    ).toEqual({
      tipo: 'guardada',
    });
    expect(c.oyentesDelMotor()).toBe(0);
  });

  it('si el almacen se cierra (se acabo la sesion), deja de esperar', async () => {
    const c = crearCiclo();

    abrir(c);

    const seguimiento = seguirUnaOperacion('op-1', { esperaMaximaEnMs: null });

    await vi.waitFor(() => {
      expect(mundo.oyentesDelCiclo.size).toBe(1);
    });
    mundo.ciclo = null;
    mundo.oyentesDelCiclo.forEach((oyente) => {
      oyente();
    });

    expect(await seguimiento).toEqual({ tipo: 'guardada' });
  });

  it('si el almacen es otro (entro otra persona), tambien deja de esperar', async () => {
    const c = crearCiclo();

    abrir(c);

    const seguimiento = seguirUnaOperacion('op-1', { esperaMaximaEnMs: null });

    await vi.waitFor(() => {
      expect(mundo.oyentesDelCiclo.size).toBe(1);
    });
    mundo.ciclo = crearCiclo().ciclo;
    mundo.oyentesDelCiclo.forEach((oyente) => {
      oyente();
    });

    expect(await seguimiento).toEqual({ tipo: 'guardada' });
  });

  it('si algo falla por dentro, no lanza: se sabe que esta guardada y nada mas', async () => {
    const c = crearCiclo();

    abrir(c);
    c.ciclo.almacen.operacion = () => Promise.reject(new Error('el almacen se cerro'));

    expect(await seguirUnaOperacion('op-1', { sincronizarYa: true })).toEqual({ tipo: 'guardada' });
  });

  it('si sincronizar falla, tampoco lanza', async () => {
    const c = crearCiclo();

    abrir(c);
    c.datos.alSincronizar = () => Promise.reject(new Error('fallo'));

    expect(await seguirUnaOperacion('op-1', { sincronizarYa: true })).toEqual({ tipo: 'guardada' });
  });
});
