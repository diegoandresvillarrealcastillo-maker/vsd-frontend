import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nuevaOperacion, type Operacion } from './cola.ts';
import {
  descartar,
  descartarElAviso,
  iniciarLaSincronizacionAutomatica,
  obtenerElEstado,
  pedirVerLaLista,
  reintentar,
  reiniciarElEstadoParaLasPruebas,
  sincronizarAhora,
  useSincronizacion,
  type DependenciasDelEstado,
} from './estado.ts';
import type {
  EventoDelMotor,
  MotivoDeSincronizacion,
  ResultadoDeSincronizacion,
  ResumenDeSincronizacion,
} from './motor.ts';

/**
 * Se prueba el almacen de estado aislado del resto del nucleo: el ciclo, las
 * acciones y el motor son dobles que esta prueba mueve a mano.
 */
const mundo = vi.hoisted(() => {
  const falso = {
    ciclo: null as null | {
      persona: string;
      almacen: {
        operaciones: () => Promise<unknown[]>;
        leerMeta: () => Promise<unknown>;
      };
      motor: {
        sincronizar: (motivo: string) => Promise<unknown>;
        estaSincronizando: () => boolean;
        suscribir: (oyente: (evento: unknown) => void) => () => void;
      };
    },
    oyentesDelCiclo: new Set<() => void>(),
    oyentesDeLaCola: new Set<() => void>(),
    avisosDeCola: 0,
  };

  return falso;
});

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
  avisarQueLaColaCambio: () => {
    mundo.avisosDeCola += 1;
  },
}));

const acciones = vi.hoisted(() => ({
  reintentarCambio: vi.fn(),
  descartarCambio: vi.fn(),
}));

vi.mock('./acciones.ts', () => acciones);

const AHORA = new Date('2026-10-07T15:00:00.000Z');

let contador = 0;

function operacion(cambios: Partial<Operacion> = {}): Operacion {
  contador += 1;

  return {
    ...nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo: 'diario.escribir',
        entidad: `diario:${String(contador)}`,
        payload: {},
      },
      new Date('2026-10-07T14:00:00.000Z'),
    ),
    orden: contador,
    ...cambios,
  };
}

const SIN_NADA: ResumenDeSincronizacion = {
  enviadas: 0,
  requierenAtencion: 0,
  conflictos: 0,
  pendientes: 0,
  recibos: [],
};

/** Un recibo de lo que espero en este equipo: se guardo hace horas. */
const recibo = (n: number): ResumenDeSincronizacion['recibos'][number] => ({
  operationId: `op-${String(n)}`,
  tipo: 'diario.escribir',
  recibo: null,
  creadaEn: '2026-10-07T10:00:00.000Z',
});

/**
 * El resultado de una tanda. Como el motor de verdad, trae un recibo por cada cambio
 * enviado: si no se dicen, son de cosas que esperaron horas en este equipo.
 */
function resultado(
  estado: ResultadoDeSincronizacion['estado'],
  resumen: Partial<ResumenDeSincronizacion> = {},
): ResultadoDeSincronizacion {
  const enviadas = resumen.enviadas ?? 0;

  return {
    estado,
    resumen: {
      ...SIN_NADA,
      recibos: Array.from({ length: enviadas }, (_valor, i) => recibo(i)),
      ...resumen,
    },
  };
}

/** Un ciclo abierto de mentira: sus operaciones, sus meta y su motor se mueven desde la prueba. */
function crearCiclo(persona = 'ana') {
  const datos = {
    operaciones: [] as Operacion[],
    meta: null as unknown,
    sincronizando: false,
    lecturas: 0,
    retrasoDeLaLectura: null as null | Promise<void>,
  };
  const oyentesDelMotor = new Set<(evento: EventoDelMotor) => void>();
  const sincronizaciones: MotivoDeSincronizacion[] = [];
  const ciclo = {
    persona,
    almacen: {
      operaciones: async () => {
        datos.lecturas += 1;
        const copia = [...datos.operaciones];

        if (datos.retrasoDeLaLectura !== null) {
          await datos.retrasoDeLaLectura;
        }

        return copia;
      },
      leerMeta: () => Promise.resolve(datos.meta),
    },
    motor: {
      sincronizar: vi.fn((motivo: string) => {
        sincronizaciones.push(motivo as MotivoDeSincronizacion);

        return Promise.resolve(undefined);
      }),
      estaSincronizando: () => datos.sincronizando,
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
    emitir: (evento: EventoDelMotor) => {
      [...oyentesDelMotor].forEach((oyente) => {
        oyente(evento);
      });
    },
    oyentesDelMotor: () => oyentesDelMotor.size,
  };
}

type CicloDePrueba = ReturnType<typeof crearCiclo>;

/** "Abre" un almacen: lo deja en el ciclo y avisa, como hace `ciclo.ts`. */
async function abrir(c: CicloDePrueba): Promise<void> {
  mundo.ciclo = c.ciclo;
  mundo.oyentesDelCiclo.forEach((oyente) => {
    oyente();
  });
  await esperar();
}

async function cerrar(): Promise<void> {
  mundo.ciclo = null;
  mundo.oyentesDelCiclo.forEach((oyente) => {
    oyente();
  });
  await esperar();
}

/** Deja que corran las lecturas pendientes. */
async function esperar(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

function armar(cambios: Partial<DependenciasDelEstado> = {}) {
  const ventana = new EventTarget();
  const documento = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const notificar = vi.fn();
  const precargar = vi.fn();
  const conciliarElDiario = vi.fn();
  const red = { hay: true };
  const cancelar = vi.fn();
  const apagar = iniciarLaSincronizacionAutomatica({
    ventana,
    documento,
    hayRed: () => red.hay,
    reloj: () => AHORA,
    programar: () => 'programacion',
    cancelar,
    notificarEnSegundoPlano: notificar,
    precargar,
    conciliarElDiario,
    ...cambios,
  });

  return { ventana, documento, notificar, precargar, conciliarElDiario, red, apagar, cancelar };
}

beforeEach(() => {
  mundo.ciclo = null;
  mundo.oyentesDelCiclo.clear();
  mundo.oyentesDeLaCola.clear();
  mundo.avisosDeCola = 0;
  acciones.reintentarCambio.mockReset();
  acciones.descartarCambio.mockReset();
  reiniciarElEstadoParaLasPruebas();
});

afterEach(() => {
  reiniciarElEstadoParaLasPruebas();
});

describe('al arrancar', () => {
  it('sin almacen: nada guardado, nada que enviar, y lo dice', () => {
    const t = armar();

    expect(obtenerElEstado()).toMatchObject({
      hayAlmacen: false,
      conexion: 'con_conexion',
      sincronizando: false,
      cambios: [],
      ultimaSincronizacion: null,
      aviso: null,
      indicador: { texto: 'Todo enviado', tono: 'normal' },
    });

    t.apagar();
  });

  it('si el navegador dice que no hay red, arranca sin conexion', () => {
    const t = armar();

    t.apagar();
    reiniciarElEstadoParaLasPruebas();

    const sinRed = armar({ hayRed: () => false });

    expect(obtenerElEstado()).toMatchObject({
      conexion: 'sin_conexion',
      indicador: { texto: 'Sin conexión' },
    });

    sinRed.apagar();
  });

  it('si el almacen ya estaba abierto, lo lee de una vez', async () => {
    const c = crearCiclo();

    c.datos.operaciones = [operacion(), operacion()];
    mundo.ciclo = c.ciclo;

    const t = armar();

    await esperar();

    expect(obtenerElEstado()).toMatchObject({
      hayAlmacen: true,
      contadores: { porEnviar: 2, total: 2 },
      indicador: { texto: '2 cambios por enviar' },
    });

    t.apagar();
  });
});

describe('el almacen se abre y se cierra', () => {
  it('al abrirse, lee lo guardado y lo ensena', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.operaciones = [
      operacion({ estado: 'pendiente' }),
      operacion({ estado: 'requiere_atencion' }),
    ];
    await abrir(c);

    const estado = obtenerElEstado();

    expect(estado.hayAlmacen).toBe(true);
    expect(estado.contadores).toEqual({
      porEnviar: 1,
      requierenAtencion: 1,
      conflictos: 0,
      total: 2,
    });
    // Lo que necesita a la persona, primero.
    expect(estado.cambios.map((cambio) => cambio.estado)).toEqual([
      'requiere_atencion',
      'pendiente',
    ]);
    expect(estado.indicador.texto).toBe('1 cambio necesita tu atención');

    t.apagar();
  });

  it('al abrirse, lee tambien cuando se sincronizo por ultima vez', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.meta = '2026-10-07T13:00:00.000Z';
    await abrir(c);

    expect(obtenerElEstado().ultimaSincronizacion).toBe('2026-10-07T13:00:00.000Z');

    t.apagar();
  });

  it('una marca que no es texto se ignora', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.meta = 12345;
    await abrir(c);

    expect(obtenerElEstado().ultimaSincronizacion).toBeNull();

    t.apagar();
  });

  it('al cerrarse, ya no hay nada que ensenar', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.operaciones = [operacion()];
    c.datos.meta = '2026-10-07T13:00:00.000Z';
    await abrir(c);
    await cerrar();

    expect(obtenerElEstado()).toMatchObject({
      hayAlmacen: false,
      cambios: [],
      contadores: { total: 0 },
      ultimaSincronizacion: null,
      sincronizando: false,
    });

    t.apagar();
  });

  it('al cerrarse, el motor viejo deja de oirse', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);

    expect(c.oyentesDelMotor()).toBe(1);

    await cerrar();

    expect(c.oyentesDelMotor()).toBe(0);

    t.apagar();
  });

  it('si el almacen se estaba sincronizando al abrirse, lo refleja', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.sincronizando = true;
    await abrir(c);

    expect(obtenerElEstado().sincronizando).toBe(true);

    t.apagar();
  });

  it('una lectura que falla porque el almacen se cerro no rompe nada', async () => {
    const t = armar();
    const c = crearCiclo();

    c.ciclo.almacen.operaciones = () => Promise.reject(new Error('cerrado'));
    await abrir(c);

    expect(obtenerElEstado().hayAlmacen).toBe(true);
    expect(obtenerElEstado().cambios).toEqual([]);

    t.apagar();
  });
});

describe('lo que se guarda por adelantado para usar sin conexion (SCRUM-138)', () => {
  it('al abrirse el almacen con conexion, se precarga', async () => {
    const t = armar();

    await abrir(crearCiclo());

    expect(t.precargar).toHaveBeenCalledTimes(1);

    t.apagar();
  });

  it('sin conexion no se intenta: no hay de donde', async () => {
    const t = armar({ hayRed: () => false });

    await abrir(crearCiclo());

    expect(t.precargar).not.toHaveBeenCalled();

    t.apagar();
  });

  it('al cerrarse el almacen no se precarga nada', async () => {
    const t = armar();

    await abrir(crearCiclo());
    t.precargar.mockClear();
    await cerrar();

    expect(t.precargar).not.toHaveBeenCalled();

    t.apagar();
  });

  it('si el almacen ya estaba abierto al arrancar, tambien', () => {
    const c = crearCiclo();

    mundo.ciclo = c.ciclo;

    const t = armar();

    expect(t.precargar).toHaveBeenCalledTimes(1);

    t.apagar();
  });

  it('cuando vuelve la red con una persona dentro, se vuelve a intentar: lo de antes pudo no llegar', async () => {
    const t = armar({ hayRed: () => false });

    await abrir(crearCiclo());
    t.ventana.dispatchEvent(new Event('online'));

    expect(t.precargar).toHaveBeenCalledTimes(1);

    t.apagar();
  });

  it('cuando vuelve la red sin nadie dentro, no hay nada que guardar', () => {
    const t = armar();

    t.ventana.dispatchEvent(new Event('online'));

    expect(t.precargar).not.toHaveBeenCalled();

    t.apagar();
  });
});

describe('la copia local del diario se pone al dia con lo que el servidor acepto (SCRUM-139)', () => {
  const deTipo = (
    tipo: 'diario.escribir' | 'diario.editar' | 'pendiente.crear' | 'resultado.registrar',
  ) =>
    ({
      ...recibo(0),
      tipo,
    }) as ResumenDeSincronizacion['recibos'][number];

  it.each(['diario.escribir', 'diario.editar'] as const)(
    'al terminar una tanda que envio algo de %s, se concilia',
    async (tipo) => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'manual' });
      c.emitir({
        tipo: 'fin',
        resultado: resultado('terminada', { enviadas: 1, recibos: [deTipo(tipo)] }),
      });

      expect(t.conciliarElDiario).toHaveBeenCalledTimes(1);

      t.apagar();
    },
  );

  it('una tanda que no envio nada del diario no la concilia', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({
      tipo: 'fin',
      resultado: resultado('terminada', {
        enviadas: 2,
        recibos: [deTipo('pendiente.crear'), deTipo('resultado.registrar')],
      }),
    });
    c.emitir({ tipo: 'inicio', motivo: 'programada' });
    c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

    expect(t.conciliarElDiario).not.toHaveBeenCalled();

    t.apagar();
  });

  it('mezclada con otras cosas, basta con que haya una del diario', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({
      tipo: 'fin',
      resultado: resultado('terminada', {
        enviadas: 2,
        recibos: [deTipo('pendiente.crear'), deTipo('diario.editar')],
      }),
    });

    expect(t.conciliarElDiario).toHaveBeenCalledTimes(1);

    t.apagar();
  });

  it.each([
    ['diario.escribir', 1],
    ['diario.editar', 1],
    ['pendiente.crear', 0],
    ['resultado.registrar', 0],
  ] as const)('cada %s enviada, sin esperar al fin de la tanda: %i vez', async (tipo, veces) => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'enviada', operacion: operacion({ tipo }), recibo: null });

    expect(t.conciliarElDiario).toHaveBeenCalledTimes(veces);

    t.apagar();
  });
});

describe('el aviso al abrir y cerrar el almacen', () => {
  async function conUnAvisoDeSesionVencida(persona = 'ana') {
    const c = crearCiclo(persona);

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('sesion_vencida', { pendientes: 2 }) });

    return c;
  }

  it('al vencer la sesion, el aviso SOBREVIVE al cierre del almacen: se lee justo despues', async () => {
    const t = armar();

    await conUnAvisoDeSesionVencida();

    expect(obtenerElEstado().aviso?.pedirEntrar).toBe(true);

    await cerrar();

    expect(obtenerElEstado().aviso?.pedirEntrar).toBe(true);

    t.apagar();
  });

  it('cuando la misma persona vuelve a entrar, ese aviso ya no le toca', async () => {
    const t = armar();

    await conUnAvisoDeSesionVencida('ana');
    await cerrar();
    await abrir(crearCiclo('ana'));

    expect(obtenerElEstado().aviso).toBeNull();

    t.apagar();
  });

  it('si entra otra persona, no ve el aviso de la anterior', async () => {
    const t = armar();

    await conUnAvisoDeSesionVencida('ana');
    await cerrar();
    await abrir(crearCiclo('beto'));

    expect(obtenerElEstado().aviso).toBeNull();

    t.apagar();
  });

  it('un aviso corriente de una persona no se le ensena a la siguiente', async () => {
    const t = armar();
    const c = crearCiclo('ana');

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

    expect(obtenerElEstado().aviso).not.toBeNull();

    await cerrar();
    await abrir(crearCiclo('beto'));

    expect(obtenerElEstado().aviso).toBeNull();

    t.apagar();
  });

  it('un aviso corriente de la misma persona sigue ahi si el almacen se reabre', async () => {
    const t = armar();
    const c = crearCiclo('ana');

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });
    await cerrar();
    await abrir(crearCiclo('ana'));

    expect(obtenerElEstado().aviso?.texto).toMatch(/Enviamos 1 cambio/);

    t.apagar();
  });
});

describe('el motor trabaja', () => {
  it('al empezar una tanda, esta sincronizando; al terminar, ya no', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'conexion' });

    expect(obtenerElEstado()).toMatchObject({
      sincronizando: true,
      indicador: { texto: 'Sincronizando…' },
    });

    c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

    expect(obtenerElEstado().sincronizando).toBe(false);

    t.apagar();
  });

  it('cada cambio enviado vuelve a leer lo guardado', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.operaciones = [operacion(), operacion()];
    await abrir(c);

    c.datos.operaciones = [c.datos.operaciones[1]!];
    c.emitir({ tipo: 'enviada', operacion: operacion(), recibo: null });
    await esperar();

    expect(obtenerElEstado().contadores.total).toBe(1);

    t.apagar();
  });

  it('una tanda que envio algo: aviso, conexion y ultima sincronizacion', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.operaciones = [operacion()];
    await abrir(c);
    c.datos.operaciones = [];
    c.datos.meta = '2026-10-07T15:00:00.000Z';
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });
    await esperar();

    expect(obtenerElEstado()).toMatchObject({
      conexion: 'con_conexion',
      sincronizando: false,
      contadores: { total: 0 },
      ultimaSincronizacion: '2026-10-07T15:00:00.000Z',
      aviso: {
        texto: 'Listo. Enviamos 1 cambio que estaba guardado en este equipo.',
        tono: 'exito',
        enviadas: 1,
      },
    });

    t.apagar();
  });

  it('el motivo de la tanda es el del evento de inicio', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'apertura' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 2 }) });

    // Si fuera "manual", diria "Listo."
    expect(obtenerElEstado().aviso?.texto).toBe(
      'Enviamos 2 cambios que estaban guardados en este equipo.',
    );

    t.apagar();
  });

  it('cada aviso lleva un numero distinto, aunque diga lo mismo: asi se anuncia otra vez', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

    const primero = obtenerElEstado().aviso;

    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

    const segundo = obtenerElEstado().aviso;

    expect(segundo?.texto).toBe(primero?.texto);
    expect(segundo?.id).toBeGreaterThan(primero?.id ?? Number.POSITIVE_INFINITY);

    t.apagar();
  });

  it('la ultima sincronizacion solo cambia cuando la tanda termino de verdad', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.meta = '2026-10-07T13:00:00.000Z';
    await abrir(c);
    c.datos.meta = '2026-10-07T15:00:00.000Z';
    c.emitir({ tipo: 'inicio', motivo: 'programada' });
    c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });
    await esperar();

    expect(obtenerElEstado().ultimaSincronizacion).toBe('2026-10-07T13:00:00.000Z');

    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('sin_conexion', { pendientes: 1 }) });
    await esperar();

    expect(obtenerElEstado().ultimaSincronizacion).toBe('2026-10-07T13:00:00.000Z');

    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });
    await esperar();

    expect(obtenerElEstado().ultimaSincronizacion).toBe('2026-10-07T15:00:00.000Z');

    t.apagar();
  });

  it('una tanda sin nada que decir no borra el aviso que hubiera', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });
    c.emitir({ tipo: 'inicio', motivo: 'programada' });
    c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

    expect(obtenerElEstado().aviso?.enviadas).toBe(1);

    t.apagar();
  });

  describe('lo que se sabe de la conexion', () => {
    it('sin conexion con la API: lo dice, aunque el navegador crea que hay red', async () => {
      const t = armar();
      const c = crearCiclo();

      c.datos.operaciones = [operacion(), operacion()];
      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('sin_conexion', { pendientes: 2 }) });

      expect(obtenerElEstado()).toMatchObject({
        conexion: 'sin_conexion',
        sincronizando: false,
        indicador: { texto: 'Sin conexión · 2 cambios guardados en este equipo' },
      });

      t.apagar();
    });

    it('por su cuenta no avisa: el indicador ya lo dice', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'programada' });
      c.emitir({ tipo: 'fin', resultado: resultado('sin_conexion', { pendientes: 1 }) });

      expect(obtenerElEstado().aviso).toBeNull();

      t.apagar();
    });

    it('a peticion de la persona, si contesta', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'manual' });
      c.emitir({ tipo: 'fin', resultado: resultado('sin_conexion', { pendientes: 1 }) });

      expect(obtenerElEstado().aviso).toMatchObject({
        texto: 'Sigues sin conexión. Tus cambios siguen guardados en este equipo.',
        tono: 'info',
      });

      t.apagar();
    });

    it('si el motor llego a la API, hay conexion', async () => {
      const t = armar({ hayRed: () => false });
      const c = crearCiclo();

      await abrir(c);

      expect(obtenerElEstado().conexion).toBe('sin_conexion');

      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

      expect(obtenerElEstado().conexion).toBe('con_conexion');

      t.apagar();
    });

    it('si la sesion vencio, la API respondio: hay conexion', async () => {
      const t = armar({ hayRed: () => false });
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'manual' });
      c.emitir({ tipo: 'fin', resultado: resultado('sesion_vencida', { pendientes: 1 }) });

      expect(obtenerElEstado().conexion).toBe('con_conexion');

      t.apagar();
    });

    it('"nada que hacer" no toco la red: no cambia lo que se sabia', async () => {
      const t = armar({ hayRed: () => false });
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'apertura' });
      c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

      expect(obtenerElEstado().conexion).toBe('sin_conexion');

      t.apagar();
    });

    it('"ocupada" (otra pestana sincroniza) tampoco cambia nada, y deja de marcar que sincroniza', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'apertura' });
      c.emitir({ tipo: 'fin', resultado: resultado('ocupada') });

      expect(obtenerElEstado()).toMatchObject({
        sincronizando: false,
        conexion: 'con_conexion',
        aviso: null,
      });

      t.apagar();
    });
  });

  describe('avisar a las otras pestanas', () => {
    it('si se envio algo, la cola cambio', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'manual' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

      expect(mundo.avisosDeCola).toBe(1);

      t.apagar();
    });

    it.each([
      ['un rechazo', { requierenAtencion: 1 }],
      ['un conflicto', { conflictos: 1 }],
    ])('tambien si hubo %s', async (_motivo, resumen) => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'manual' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', resumen) });

      expect(mundo.avisosDeCola).toBe(1);

      t.apagar();
    });

    it('si no cambio nada, no: sin esto, cada tanda dispararia otra para siempre', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', { pendientes: 2 }) });
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

      expect(mundo.avisosDeCola).toBe(0);

      t.apagar();
    });
  });

  describe('con la aplicacion en segundo plano', () => {
    it('si se envio algo, una notificacion', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      t.documento.visibilityState = 'hidden';
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

      expect(t.notificar).toHaveBeenCalledTimes(1);

      t.apagar();
    });

    it('a la vista no hace falta: ya se ve el aviso', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

      expect(t.notificar).not.toHaveBeenCalled();

      t.apagar();
    });

    it('si no se envio nada, no hay de que avisar', async () => {
      const t = armar();
      const c = crearCiclo();

      await abrir(c);
      t.documento.visibilityState = 'hidden';
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('terminada', { requierenAtencion: 1 }) });
      c.emitir({ tipo: 'inicio', motivo: 'conexion' });
      c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

      expect(t.notificar).not.toHaveBeenCalled();

      t.apagar();
    });
  });
});

describe('la red del navegador', () => {
  it('al perderse, sin conexion; y si hay sesion, se tranquiliza a la persona', async () => {
    const t = armar();

    await abrir(crearCiclo());
    t.ventana.dispatchEvent(new Event('offline'));

    expect(obtenerElEstado()).toMatchObject({
      conexion: 'sin_conexion',
      aviso: {
        tono: 'info',
        texto:
          'Sin conexión. Lo que hagas se guarda en este equipo y se envía cuando vuelva la conexión.',
      },
    });

    t.apagar();
  });

  it('sin sesion no se avisa de nada: no hay nada guardado de nadie', () => {
    const t = armar();

    t.ventana.dispatchEvent(new Event('offline'));

    expect(obtenerElEstado()).toMatchObject({ conexion: 'sin_conexion', aviso: null });

    t.apagar();
  });

  it('al volver, con conexion otra vez, y el aviso de "sin conexion" se quita', async () => {
    const t = armar();

    await abrir(crearCiclo());
    t.ventana.dispatchEvent(new Event('offline'));
    t.ventana.dispatchEvent(new Event('online'));

    expect(obtenerElEstado()).toMatchObject({ conexion: 'con_conexion', aviso: null });

    t.apagar();
  });

  it('al volver no se quita un aviso de otra cosa', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });
    t.ventana.dispatchEvent(new Event('online'));

    expect(obtenerElEstado().aviso?.enviadas).toBe(1);

    t.apagar();
  });

  it('el recorrido completo: se pierde, vuelve, y se envia lo guardado', async () => {
    const t = armar();
    const c = crearCiclo();

    c.datos.operaciones = [operacion(), operacion(), operacion()];
    await abrir(c);

    t.ventana.dispatchEvent(new Event('offline'));

    expect(obtenerElEstado().indicador.texto).toBe(
      'Sin conexión · 3 cambios guardados en este equipo',
    );

    c.sincronizaciones.length = 0;
    t.ventana.dispatchEvent(new Event('online'));

    // Los disparadores piden sincronizar con el motivo de la conexion.
    expect(c.sincronizaciones).toEqual(['conexion']);

    c.datos.operaciones = [];
    c.emitir({ tipo: 'inicio', motivo: 'conexion' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 3 }) });
    await esperar();

    expect(obtenerElEstado().aviso?.texto).toBe(
      'Volviste a tener conexión. Enviamos 3 cambios que estaban guardados en este equipo.',
    );
    expect(obtenerElEstado().indicador.texto).toBe('Todo enviado');

    // Y el siguiente aviso ya no dice que volvio: eso fue una vez.
    c.emitir({ tipo: 'inicio', motivo: 'programada' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

    expect(obtenerElEstado().aviso?.texto).toBe(
      'Enviamos 1 cambio que estaba guardado en este equipo.',
    );

    t.apagar();
  });

  it('haber estado sin conexion se consume aunque al volver no hubiera nada que enviar: el siguiente aviso ya no lo repite', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    t.ventana.dispatchEvent(new Event('offline'));
    t.ventana.dispatchEvent(new Event('online'));
    c.emitir({ tipo: 'inicio', motivo: 'conexion' });
    c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

    expect(obtenerElEstado().aviso?.texto).toBe('Volviste a tener conexión.');

    c.emitir({ tipo: 'inicio', motivo: 'programada' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

    expect(obtenerElEstado().aviso?.texto).toBe(
      'Enviamos 1 cambio que estaba guardado en este equipo.',
    );

    t.apagar();
  });

  it('lo que encuentra el motor tambien cuenta como haber estado sin conexion, aunque el navegador no avisara', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'programada' });
    c.emitir({ tipo: 'fin', resultado: resultado('sin_conexion', { pendientes: 2 }) });
    c.emitir({ tipo: 'inicio', motivo: 'conexion' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 2 }) });

    expect(obtenerElEstado().aviso?.texto).toBe(
      'Volviste a tener conexión. Enviamos 2 cambios que estaban guardados en este equipo.',
    );

    t.apagar();
  });

  it('se perdio la conexion y cuando vuelve no hay nada que enviar: solo se dice que volvio', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    t.ventana.dispatchEvent(new Event('offline'));
    t.ventana.dispatchEvent(new Event('online'));
    c.emitir({ tipo: 'inicio', motivo: 'conexion' });
    c.emitir({ tipo: 'fin', resultado: resultado('nada_que_hacer') });

    expect(obtenerElEstado().aviso?.texto).toBe('Volviste a tener conexión.');

    t.apagar();
  });
});

describe('la cola cambia', () => {
  it('vuelve a leer lo guardado cuando algo la avisa', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);

    expect(obtenerElEstado().contadores.total).toBe(0);

    c.datos.operaciones = [operacion(), operacion()];
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    await esperar();

    expect(obtenerElEstado().contadores.total).toBe(2);

    t.apagar();
  });

  it('si llegan dos lecturas y la vieja termina despues, gana la nueva', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);

    let soltarLaVieja: () => void = () => undefined;

    c.datos.operaciones = [operacion()];
    c.datos.retrasoDeLaLectura = new Promise<void>((resolver) => {
      soltarLaVieja = resolver;
    });
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });

    // La segunda lectura no espera.
    c.datos.retrasoDeLaLectura = null;
    c.datos.operaciones = [operacion(), operacion(), operacion()];
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    await esperar();

    expect(obtenerElEstado().contadores.total).toBe(3);

    soltarLaVieja();
    await esperar();

    expect(obtenerElEstado().contadores.total).toBe(3);

    t.apagar();
  });

  it('una lectura que llega cuando el almacen ya se cerro no pisa el estado vacio', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);

    let soltar: () => void = () => undefined;

    c.datos.operaciones = [operacion()];
    c.datos.retrasoDeLaLectura = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    await cerrar();
    soltar();
    await esperar();

    expect(obtenerElEstado()).toMatchObject({
      hayAlmacen: false,
      cambios: [],
      contadores: { total: 0 },
    });

    t.apagar();
  });
});

describe('lo que dispara la sincronizacion sola', () => {
  it('al volver la red pide sincronizar con el almacen abierto', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.sincronizaciones.length = 0;
    t.ventana.dispatchEvent(new Event('online'));

    expect(c.sincronizaciones).toEqual(['conexion']);

    t.apagar();
  });

  it('al abrirse el almacen, pide sincronizar', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);

    expect(c.sincronizaciones).toEqual(['apertura']);

    t.apagar();
  });

  it('con algo listo y un cambio en la cola, pide sincronizar', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.sincronizaciones.length = 0;
    c.datos.operaciones = [operacion()];
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    await esperar();

    expect(c.sincronizaciones).toEqual(['programada']);

    t.apagar();
  });

  it('con algo que espera su reintento, no', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.sincronizaciones.length = 0;
    c.datos.operaciones = [
      operacion({ proximoIntento: new Date(AHORA.getTime() + 60_000).toISOString() }),
    ];
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    await esperar();

    expect(c.sincronizaciones).toEqual([]);

    t.apagar();
  });

  it('sin almacen, nada', async () => {
    const t = armar();

    t.ventana.dispatchEvent(new Event('online'));
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    await esperar();

    expect(mundo.ciclo).toBeNull();

    t.apagar();
  });
});

describe('lo que la persona puede pedir', () => {
  it('"Sincronizar ahora" le pide al motor una sincronizacion manual', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.sincronizaciones.length = 0;
    await sincronizarAhora();

    expect(c.sincronizaciones).toEqual(['manual']);

    t.apagar();
  });

  it('sin almacen no hace nada ni falla', async () => {
    await expect(sincronizarAhora()).resolves.toBeUndefined();
  });

  it('reintentar: lo devuelve a la cola y sincroniza de una vez', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.sincronizaciones.length = 0;
    acciones.reintentarCambio.mockResolvedValue(true);
    await reintentar('op-1');

    expect(acciones.reintentarCambio).toHaveBeenCalledWith('op-1');
    expect(c.sincronizaciones).toEqual(['manual']);

    t.apagar();
  });

  it('reintentar algo que ya no se puede no sincroniza', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.sincronizaciones.length = 0;
    acciones.reintentarCambio.mockResolvedValue(false);
    await reintentar('op-1');

    expect(c.sincronizaciones).toEqual([]);

    t.apagar();
  });

  it('descartar dice cuantos se quitaron', async () => {
    acciones.descartarCambio.mockResolvedValue(['a', 'b', 'c']);

    expect(await descartar('a')).toBe(3);
    expect(acciones.descartarCambio).toHaveBeenCalledWith('a');
  });

  it('descartar algo que no se podia, cero', async () => {
    acciones.descartarCambio.mockResolvedValue([]);

    expect(await descartar('a')).toBe(0);
  });

  it('pedir ver la lista sube un numero que el indicador mira, cada vez', () => {
    const antes = obtenerElEstado().peticionDeLista;

    pedirVerLaLista();
    pedirVerLaLista();

    expect(obtenerElEstado().peticionDeLista).toBe(antes + 2);
  });

  it('cerrar el aviso lo quita', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    c.emitir({ tipo: 'inicio', motivo: 'manual' });
    c.emitir({ tipo: 'fin', resultado: resultado('terminada', { enviadas: 1 }) });

    expect(obtenerElEstado().aviso).not.toBeNull();

    descartarElAviso();

    expect(obtenerElEstado().aviso).toBeNull();

    t.apagar();
  });
});

describe('apagar', () => {
  it('deja de escuchar la red, el almacen, la cola y el motor', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);
    t.apagar();

    expect(mundo.oyentesDelCiclo.size).toBe(0);
    expect(mundo.oyentesDeLaCola.size).toBe(0);
    expect(c.oyentesDelMotor()).toBe(0);
    expect(t.cancelar).toHaveBeenCalledWith('programacion');

    t.ventana.dispatchEvent(new Event('offline'));

    expect(obtenerElEstado().conexion).toBe('con_conexion');
  });

  it('una lectura que termina despues de apagar no cambia nada', async () => {
    const t = armar();
    const c = crearCiclo();

    await abrir(c);

    let soltar: () => void = () => undefined;

    c.datos.operaciones = [operacion()];
    c.datos.retrasoDeLaLectura = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    mundo.oyentesDeLaCola.forEach((oyente) => {
      oyente();
    });
    t.apagar();
    soltar();
    await esperar();

    expect(obtenerElEstado().contadores.total).toBe(0);
  });
});

describe('useSincronizacion', () => {
  it('entrega el estado y se actualiza cuando cambia', async () => {
    const t = armar();
    const c = crearCiclo();
    const { result } = renderHook(() => useSincronizacion());

    expect(result.current.indicador.texto).toBe('Todo enviado');

    c.datos.operaciones = [operacion()];
    await act(async () => {
      await abrir(c);
    });

    expect(result.current.indicador.texto).toBe('1 cambio por enviar');

    t.apagar();
  });

  it('deja de escuchar al desmontarse', () => {
    const t = armar();
    const { unmount } = renderHook(() => useSincronizacion());

    unmount();

    expect(() => {
      descartarElAviso();
    }).not.toThrow();

    t.apagar();
  });
});
