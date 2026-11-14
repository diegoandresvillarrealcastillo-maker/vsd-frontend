import { describe, expect, it, vi } from 'vitest';

import {
  CADA_CUANTO_SE_MIRA_EN_MS,
  ESPERA_ENTRE_VUELTAS_A_LA_PESTANA_EN_MS,
  iniciarLosDisparadores,
  type OpcionesDeLosDisparadores,
} from './disparadores.ts';
import type { MotivoDeSincronizacion } from './motor.ts';

/** Todo lo que los disparadores tocan, en pequeno y controlable. */
function armar(cambios: Partial<OpcionesDeLosDisparadores> = {}) {
  const ventana = new EventTarget();
  const documento = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const sincronizaciones: MotivoDeSincronizacion[] = [];
  const estado = {
    hayRed: true,
    hayAlmacen: true,
    hayAlgoListo: true,
    ahora: 1_000_000,
  };
  let alAlmacen: () => void = () => undefined;
  let alCambioDeCola: () => void = () => undefined;
  let tarea: () => void = () => undefined;
  let cadaMs = 0;
  const cancelar = vi.fn();
  const dejarDeEscucharElAlmacen = vi.fn();
  const dejarDeEscucharLaCola = vi.fn();

  const apagar = iniciarLosDisparadores({
    ventana,
    documento,
    hayRed: () => estado.hayRed,
    sincronizar: (motivo) => {
      sincronizaciones.push(motivo);
    },
    hayAlgoListo: () => Promise.resolve(estado.hayAlgoListo),
    alCambiarElAlmacen: (oyente) => {
      alAlmacen = oyente;

      return dejarDeEscucharElAlmacen;
    },
    hayAlmacen: () => estado.hayAlmacen,
    alCambiarLaCola: (oyente) => {
      alCambioDeCola = oyente;

      return dejarDeEscucharLaCola;
    },
    programar: (hacer, ms) => {
      tarea = hacer;
      cadaMs = ms;

      return 'programacion-1';
    },
    cancelar,
    ahora: () => estado.ahora,
    ...cambios,
  });

  return {
    ventana,
    documento,
    sincronizaciones,
    estado,
    apagar,
    cancelar,
    dejarDeEscucharElAlmacen,
    dejarDeEscucharLaCola,
    seAbrioElAlmacen: () => {
      alAlmacen();
    },
    cambioLaCola: () => {
      alCambioDeCola();
    },
    pasoElTiempo: () => {
      tarea();
    },
    cadaMs: () => cadaMs,
  };
}

/** Deja que corran las promesas pendientes. */
async function esperar(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('al volver la red (SCRUM-137)', () => {
  it('sincroniza con el motivo "conexion"', () => {
    const t = armar();

    t.ventana.dispatchEvent(new Event('online'));

    expect(t.sincronizaciones).toEqual(['conexion']);
  });

  it('aunque no se sepa si hay algo que enviar: el motor lo resuelve, y asi se entera la pantalla', () => {
    const t = armar();

    t.estado.hayAlgoListo = false;
    t.ventana.dispatchEvent(new Event('online'));

    expect(t.sincronizaciones).toEqual(['conexion']);
  });

  it('sin almacen abierto (nadie ha entrado), no hay nada que sincronizar', () => {
    const t = armar();

    t.estado.hayAlmacen = false;
    t.ventana.dispatchEvent(new Event('online'));

    expect(t.sincronizaciones).toEqual([]);
  });

  it('cada vez que vuelve', () => {
    const t = armar();

    t.ventana.dispatchEvent(new Event('online'));
    t.ventana.dispatchEvent(new Event('online'));

    expect(t.sincronizaciones).toEqual(['conexion', 'conexion']);
  });
});

describe('al volver a la pestana', () => {
  it('sincroniza con el motivo "apertura"', () => {
    const t = armar();

    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual(['apertura']);
  });

  it('al esconderse la pestana no hace nada', () => {
    const t = armar();

    t.documento.visibilityState = 'hidden';
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual([]);
  });

  it('si el navegador dice que no hay red, no insiste', () => {
    const t = armar();

    t.estado.hayRed = false;
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual([]);
  });

  it('sin almacen abierto, nada', () => {
    const t = armar();

    t.estado.hayAlmacen = false;
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual([]);
  });

  it('cambiar de pestana a cada rato no pregunta a cada rato', () => {
    const t = armar();

    t.documento.dispatchEvent(new Event('visibilitychange'));
    t.estado.ahora += ESPERA_ENTRE_VUELTAS_A_LA_PESTANA_EN_MS - 1;
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual(['apertura']);
  });

  it('pasado el tiempo, vuelve a preguntar', () => {
    const t = armar();

    t.documento.dispatchEvent(new Event('visibilitychange'));
    t.estado.ahora += ESPERA_ENTRE_VUELTAS_A_LA_PESTANA_EN_MS;
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual(['apertura', 'apertura']);
  });

  it('una vuelta que no sincronizo (sin red) no cuenta para la espera', () => {
    const t = armar();

    t.estado.hayRed = false;
    t.documento.dispatchEvent(new Event('visibilitychange'));
    t.estado.hayRed = true;
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual(['apertura']);
  });
});

describe('al abrirse el almacen de una persona', () => {
  it('sincroniza con el motivo "apertura"', () => {
    const t = armar();

    t.seAbrioElAlmacen();

    expect(t.sincronizaciones).toEqual(['apertura']);
  });

  it('al cerrarse (ya no hay almacen), no', () => {
    const t = armar();

    t.estado.hayAlmacen = false;
    t.seAbrioElAlmacen();

    expect(t.sincronizaciones).toEqual([]);
  });

  it('sin red, no: se hara cuando vuelva', () => {
    const t = armar();

    t.estado.hayRed = false;
    t.seAbrioElAlmacen();

    expect(t.sincronizaciones).toEqual([]);
  });
});

describe('cuando la cola cambia', () => {
  it('sincroniza si hay algo listo', async () => {
    const t = armar();

    t.cambioLaCola();
    await esperar();

    expect(t.sincronizaciones).toEqual(['programada']);
  });

  it('no si no hay nada listo: lo que acaba de enviarse, o lo que espera su reintento', async () => {
    const t = armar();

    t.estado.hayAlgoListo = false;
    t.cambioLaCola();
    await esperar();

    expect(t.sincronizaciones).toEqual([]);
  });

  it('no si no hay red', async () => {
    const t = armar();

    t.estado.hayRed = false;
    t.cambioLaCola();
    await esperar();

    expect(t.sincronizaciones).toEqual([]);
  });

  it('no si no hay almacen, y ni siquiera mira', async () => {
    const hayAlgoListo = vi.fn(() => Promise.resolve(true));
    const t = armar({ hayAlgoListo });

    t.estado.hayAlmacen = false;
    t.cambioLaCola();
    await esperar();

    expect(t.sincronizaciones).toEqual([]);
    expect(hayAlgoListo).not.toHaveBeenCalled();
  });

  it('si mirar falla, no rompe nada ni sincroniza', async () => {
    const t = armar({ hayAlgoListo: () => Promise.reject(new Error('el disco fallo')) });

    t.cambioLaCola();
    await esperar();

    expect(t.sincronizaciones).toEqual([]);
  });
});

describe('cada cierto tiempo', () => {
  it('mira cada 30 segundos', () => {
    const t = armar();

    expect(t.cadaMs()).toBe(CADA_CUANTO_SE_MIRA_EN_MS);
    expect(CADA_CUANTO_SE_MIRA_EN_MS).toBe(30_000);
  });

  it('sincroniza si hay algo listo, con el motivo "programada"', async () => {
    const t = armar();

    t.pasoElTiempo();
    await esperar();

    expect(t.sincronizaciones).toEqual(['programada']);
  });

  it('si no hay nada listo, no toca nada', async () => {
    const t = armar();

    t.estado.hayAlgoListo = false;
    t.pasoElTiempo();
    await esperar();

    expect(t.sincronizaciones).toEqual([]);
  });

  it('sin red, no insiste', async () => {
    const t = armar();

    t.estado.hayRed = false;
    t.pasoElTiempo();
    await esperar();

    expect(t.sincronizaciones).toEqual([]);
  });
});

describe('apagarlos', () => {
  it('deja de escuchar la red y la pestana', () => {
    const t = armar();

    t.apagar();
    t.ventana.dispatchEvent(new Event('online'));
    t.documento.dispatchEvent(new Event('visibilitychange'));

    expect(t.sincronizaciones).toEqual([]);
  });

  it('deja de escuchar el almacen y la cola, y cancela el temporizador', () => {
    const t = armar();

    t.apagar();

    expect(t.dejarDeEscucharElAlmacen).toHaveBeenCalledTimes(1);
    expect(t.dejarDeEscucharLaCola).toHaveBeenCalledTimes(1);
    expect(t.cancelar).toHaveBeenCalledWith('programacion-1');
  });
});
