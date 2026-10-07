import { describe, expect, it } from 'vitest';

import {
  DIAS_QUE_SE_CONSERVAN_LAS_HECHAS,
  ESPERA_BASE_EN_MS,
  ESPERA_MAXIMA_DEL_SERVIDOR_EN_MS,
  ESPERA_MAXIMA_EN_MS,
  MAXIMO_DE_INTENTOS,
  TIPOS_DE_OPERACION,
  VERSION_ACTUAL_DEL_PAYLOAD,
  esTipoDeOperacion,
  esperaDeReintento,
  haceCuanto,
  nuevaOperacion,
  planDeEnvio,
  ultimaPendienteDe,
  type Operacion,
} from './cola.ts';

const AHORA = new Date('2026-10-07T12:00:00.000Z');

let contador = 0;

/** Una operacion pendiente de prueba, con lo que se quiera cambiar. */
function operacion(cambios: Partial<Operacion> = {}): Operacion {
  contador += 1;

  return {
    ...nuevaOperacion(
      {
        operationId: `op-${String(contador)}`,
        tipo: 'pendiente.crear',
        entidad: `pendiente:${String(contador)}`,
        payload: { texto: 'algo' },
      },
      AHORA,
    ),
    orden: contador,
    ...cambios,
  };
}

function ids(operaciones: readonly Operacion[]): string[] {
  return operaciones.map((o) => o.operationId);
}

describe('nuevaOperacion', () => {
  it('nace pendiente, sin intentos, sin turno y sin recibo', () => {
    const o = nuevaOperacion(
      {
        operationId: 'a',
        tipo: 'diario.escribir',
        entidad: 'diario:x',
        payload: { dia: '2026-10-07' },
      },
      AHORA,
    );

    expect(o).toMatchObject({
      operationId: 'a',
      tipo: 'diario.escribir',
      entidad: 'diario:x',
      estado: 'pendiente',
      intentos: 0,
      proximoIntento: null,
      dependeDe: null,
      recibo: null,
      error: null,
      payloadVersion: VERSION_ACTUAL_DEL_PAYLOAD,
      creadaEn: AHORA.toISOString(),
    });
  });

  it('puede depender de otra', () => {
    const o = nuevaOperacion(
      {
        operationId: 'b',
        tipo: 'pendiente.editar',
        entidad: 'pendiente:x',
        payload: {},
        dependeDe: 'a',
      },
      AHORA,
    );

    expect(o.dependeDe).toBe('a');
  });

  it('guarda la hora del dispositivo, no la del servidor', () => {
    const o = nuevaOperacion(
      { operationId: 'c', tipo: 'pendiente.crear', entidad: 'e', payload: {} },
      new Date('2026-01-02T03:04:05.000Z'),
    );

    expect(o.creadaEn).toBe('2026-01-02T03:04:05.000Z');
  });
});

describe('los tipos de operacion', () => {
  it('son los seis que la API ya sabe hacer de forma idempotente', () => {
    expect([...TIPOS_DE_OPERACION].sort()).toEqual(
      [
        'diario.editar',
        'diario.escribir',
        'pendiente.borrar',
        'pendiente.crear',
        'pendiente.editar',
        'resultado.registrar',
      ].sort(),
    );
  });

  it.each(TIPOS_DE_OPERACION)('%s es un tipo valido', (tipo) => {
    expect(esTipoDeOperacion(tipo)).toBe(true);
  });

  it.each([['otra.cosa'], [''], [null], [undefined], [3], [{}]])('%j no lo es', (valor) => {
    expect(esTipoDeOperacion(valor)).toBe(false);
  });
});

describe('planDeEnvio: lo que se puede enviar ahora', () => {
  it('lo pendiente y sin dependencias esta listo, en el orden en que llego', () => {
    const tercera = operacion({ orden: 3 });
    const primera = operacion({ orden: 1 });
    const segunda = operacion({ orden: 2 });

    const plan = planDeEnvio([tercera, primera, segunda], AHORA);

    expect(ids(plan.listas)).toEqual([
      primera.operationId,
      segunda.operationId,
      tercera.operationId,
    ]);
  });

  it('a igual orden, desempata la hora en que se creo', () => {
    const tarde = operacion({ orden: 1, creadaEn: '2026-10-07T12:00:02.000Z' });
    const temprano = operacion({ orden: 1, creadaEn: '2026-10-07T12:00:01.000Z' });

    expect(ids(planDeEnvio([tarde, temprano], AHORA).listas)).toEqual([
      temprano.operationId,
      tarde.operationId,
    ]);
  });

  it.each(['hecha', 'enviando', 'requiere_atencion', 'conflicto'] as const)(
    'una que esta %s no se vuelve a enviar',
    (estado) => {
      const plan = planDeEnvio([operacion({ estado })], AHORA);

      expect(plan.listas).toEqual([]);
    },
  );

  describe('dependencias', () => {
    it('lo que depende de algo que todavia no termino espera su turno', () => {
      const crear = operacion({ orden: 1 });
      const editar = operacion({ orden: 2, dependeDe: crear.operationId });

      const plan = planDeEnvio([crear, editar], AHORA);

      expect(ids(plan.listas)).toEqual([crear.operationId]);
      expect(ids(plan.esperandoTurno)).toEqual([editar.operationId]);
    });

    it('cuando la dependencia termino bien, lo que dependia queda listo', () => {
      const crear = operacion({ orden: 1, estado: 'hecha' });
      const editar = operacion({ orden: 2, dependeDe: crear.operationId });

      const plan = planDeEnvio([crear, editar], AHORA);

      expect(ids(plan.listas)).toEqual([editar.operationId]);
      expect(plan.esperandoTurno).toEqual([]);
    });

    it('una dependencia que ya no esta en la cola (se limpio) se da por buena', () => {
      const editar = operacion({ dependeDe: 'ya-no-esta' });

      expect(ids(planDeEnvio([editar], AHORA).listas)).toEqual([editar.operationId]);
    });

    it('mientras la dependencia se esta enviando, lo que depende de ella espera', () => {
      const crear = operacion({ orden: 1, estado: 'enviando' });
      const editar = operacion({ orden: 2, dependeDe: crear.operationId });

      const plan = planDeEnvio([crear, editar], AHORA);

      expect(plan.listas).toEqual([]);
      expect(ids(plan.esperandoTurno)).toEqual([editar.operationId]);
    });

    it.each(['requiere_atencion', 'conflicto'] as const)(
      'si la dependencia quedo en "%s", lo que dependia queda BLOQUEADO',
      (estado) => {
        const crear = operacion({ orden: 1, estado });
        const editar = operacion({ orden: 2, dependeDe: crear.operationId });

        const plan = planDeEnvio([crear, editar], AHORA);

        expect(plan.listas).toEqual([]);
        expect(ids(plan.bloqueadas)).toEqual([editar.operationId]);
      },
    );

    it('el bloqueo se propaga por toda la cadena', () => {
      const a = operacion({ orden: 1, estado: 'conflicto' });
      const b = operacion({ orden: 2, dependeDe: a.operationId });
      const c = operacion({ orden: 3, dependeDe: b.operationId });
      const d = operacion({ orden: 4, dependeDe: c.operationId });

      const plan = planDeEnvio([a, b, c, d], AHORA);

      expect(plan.listas).toEqual([]);
      expect(ids(plan.bloqueadas)).toEqual([b.operationId, c.operationId, d.operationId]);
    });

    it('lo que fallo NO detiene a lo que no tiene que ver (otra cosa distinta sigue)', () => {
      const anotacionRechazada = operacion({
        orden: 1,
        estado: 'requiere_atencion',
        entidad: 'diario:1',
      });
      const susEdicion = operacion({
        orden: 2,
        dependeDe: anotacionRechazada.operationId,
        entidad: 'diario:1',
      });
      const unPendiente = operacion({ orden: 3, entidad: 'pendiente:7' });

      const plan = planDeEnvio([anotacionRechazada, susEdicion, unPendiente], AHORA);

      expect(ids(plan.listas)).toEqual([unPendiente.operationId]);
      expect(ids(plan.bloqueadas)).toEqual([susEdicion.operationId]);
    });

    it('una cadena que se cierra sobre si misma no cuelga el calculo', () => {
      const a = operacion({ orden: 1 });
      const b = operacion({ orden: 2 });
      const ciclo = [
        { ...a, dependeDe: b.operationId },
        { ...b, dependeDe: a.operationId },
      ];

      // Es un dato mal hecho, no algo que deba ocurrir: lo que se exige es que
      // no se quede dando vueltas, y que ninguna se envie fuera de orden.
      const plan = planDeEnvio(ciclo, AHORA);

      expect(plan.listas).toEqual([]);
      expect(plan.esperandoTurno).toHaveLength(2);
    });
  });

  describe('reintentos', () => {
    it('lo que espera su proximo reintento no esta listo todavia', () => {
      const luego = new Date(AHORA.getTime() + 60_000).toISOString();
      const esperando = operacion({ proximoIntento: luego });

      const plan = planDeEnvio([esperando], AHORA);

      expect(plan.listas).toEqual([]);
      expect(ids(plan.esperandoReintento)).toEqual([esperando.operationId]);
    });

    it('justo a la hora del reintento ya esta listo', () => {
      const lista = operacion({ proximoIntento: AHORA.toISOString() });

      expect(ids(planDeEnvio([lista], AHORA).listas)).toEqual([lista.operationId]);
    });

    it('pasada la hora del reintento, esta lista', () => {
      const lista = operacion({ proximoIntento: new Date(AHORA.getTime() - 1).toISOString() });

      expect(ids(planDeEnvio([lista], AHORA).listas)).toEqual([lista.operationId]);
    });

    it('lo que espera un reintento retiene a lo que depende de ello', () => {
      const luego = new Date(AHORA.getTime() + 60_000).toISOString();
      const crear = operacion({ orden: 1, proximoIntento: luego });
      const editar = operacion({ orden: 2, dependeDe: crear.operationId });

      const plan = planDeEnvio([crear, editar], AHORA);

      expect(plan.listas).toEqual([]);
      expect(ids(plan.esperandoReintento)).toEqual([crear.operationId]);
      expect(ids(plan.esperandoTurno)).toEqual([editar.operationId]);
    });

    it('lo que espera un reintento no detiene a lo independiente', () => {
      const luego = new Date(AHORA.getTime() + 60_000).toISOString();
      const lenta = operacion({ orden: 1, proximoIntento: luego });
      const otra = operacion({ orden: 2 });

      expect(ids(planDeEnvio([lenta, otra], AHORA).listas)).toEqual([otra.operationId]);
    });
  });

  it('no modifica lo que recibe', () => {
    const a = operacion({ orden: 2 });
    const b = operacion({ orden: 1 });
    const entrada = [a, b];

    planDeEnvio(entrada, AHORA);

    expect(entrada).toEqual([a, b]);
  });
});

describe('ultimaPendienteDe', () => {
  it('es la ultima operacion sin terminar de esa cosa', () => {
    const uno = operacion({ orden: 1, entidad: 'pendiente:x', estado: 'hecha' });
    const dos = operacion({ orden: 2, entidad: 'pendiente:x' });
    const tres = operacion({ orden: 3, entidad: 'pendiente:x' });
    const otra = operacion({ orden: 4, entidad: 'pendiente:y' });

    expect(ultimaPendienteDe([uno, dos, tres, otra], 'pendiente:x')?.operationId).toBe(
      tres.operationId,
    );
  });

  it('cuenta las que esperan atencion o tienen un conflicto: siguen sin terminar', () => {
    const uno = operacion({ orden: 1, entidad: 'e', estado: 'conflicto' });

    expect(ultimaPendienteDe([uno], 'e')?.operationId).toBe(uno.operationId);
  });

  it('si todas terminaron, no hay ninguna', () => {
    expect(ultimaPendienteDe([operacion({ entidad: 'e', estado: 'hecha' })], 'e')).toBeUndefined();
  });

  it('de otra cosa, no', () => {
    expect(ultimaPendienteDe([operacion({ entidad: 'a' })], 'b')).toBeUndefined();
  });
});

describe('esperaDeReintento', () => {
  const SIN_AZAR = 0.5; // el centro de ±20 %: multiplica por 1.

  it('la primera vez espera lo base, y se duplica en cada intento', () => {
    expect(esperaDeReintento(1, undefined, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS);
    expect(esperaDeReintento(2, undefined, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS * 2);
    expect(esperaDeReintento(3, undefined, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS * 4);
    expect(esperaDeReintento(4, undefined, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS * 8);
  });

  it('crece sin parar hasta el techo de 15 minutos, y ahi se queda', () => {
    expect(esperaDeReintento(9, undefined, SIN_AZAR)).toBe(ESPERA_MAXIMA_EN_MS);
    expect(esperaDeReintento(50, undefined, SIN_AZAR)).toBe(ESPERA_MAXIMA_EN_MS);
    expect(esperaDeReintento(10_000, undefined, SIN_AZAR)).toBe(ESPERA_MAXIMA_EN_MS);
  });

  it('el azar mueve la espera un 20 % hacia cada lado, no mas', () => {
    const base = ESPERA_BASE_EN_MS * 4;

    expect(esperaDeReintento(3, undefined, 0)).toBe(Math.round(base * 0.8));
    expect(esperaDeReintento(3, undefined, 0.999999)).toBeLessThanOrEqual(Math.round(base * 1.2));
    expect(esperaDeReintento(3, undefined, 0.999999)).toBeGreaterThan(base * 1.19);
  });

  it('dos dispositivos con el mismo fallo no vuelven a la vez (el azar los separa)', () => {
    expect(esperaDeReintento(3, undefined, 0.1)).not.toBe(esperaDeReintento(3, undefined, 0.9));
  });

  it('nunca espera menos de lo que pide el servidor', () => {
    expect(esperaDeReintento(1, 120, SIN_AZAR)).toBe(120_000);
  });

  it('si el servidor pide poco, manda la espera creciente', () => {
    expect(esperaDeReintento(5, 1, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS * 16);
  });

  it('aunque el servidor pida un siglo, no se espera mas de una hora', () => {
    expect(esperaDeReintento(1, 60 * 60 * 24 * 365 * 100, SIN_AZAR)).toBe(
      ESPERA_MAXIMA_DEL_SERVIDOR_EN_MS,
    );
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY]])(
    'un Retry-After absurdo (%s) se ignora',
    (pedido) => {
      expect(esperaDeReintento(2, pedido, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS * 2);
    },
  );

  it('un Retry-After negativo no acorta la espera', () => {
    expect(esperaDeReintento(2, -30, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS * 2);
  });

  it('un numero de intentos raro (0 o negativo) cuenta como el primero', () => {
    expect(esperaDeReintento(0, undefined, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS);
    expect(esperaDeReintento(-3, undefined, SIN_AZAR)).toBe(ESPERA_BASE_EN_MS);
  });

  it('la suma de lo esperado hasta el limite de intentos ronda la hora', () => {
    let total = 0;

    for (let intento = 1; intento < MAXIMO_DE_INTENTOS; intento += 1) {
      total += esperaDeReintento(intento, undefined, SIN_AZAR);
    }

    // Poco mas de una hora: lo bastante para un servidor que se recupera, y no tanto
    // como para que algo roto reintente para siempre sin que nadie lo sepa.
    expect(total).toBeGreaterThan(55 * 60 * 1000);
    expect(total).toBeLessThan(90 * 60 * 1000);
  });
});

describe('haceCuanto', () => {
  it('son los milisegundos que pasaron', () => {
    expect(haceCuanto('2026-10-07T11:59:00.000Z', AHORA)).toBe(60_000);
  });

  it('una semana es la que se conservan las hechas', () => {
    expect(DIAS_QUE_SE_CONSERVAN_LAS_HECHAS).toBe(7);
  });
});
