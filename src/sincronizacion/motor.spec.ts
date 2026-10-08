import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../infraestructura/api/clienteHttp.ts';
import { crearAlmacenEnMemoria, type AlmacenLocal } from './almacenLocal.ts';
import {
  DIAS_QUE_SE_CONSERVAN_LAS_HECHAS,
  ESPERA_BASE_EN_MS,
  MAXIMO_DE_INTENTOS,
  TIPOS_DE_OPERACION,
  nuevaOperacion,
  type Operacion,
  type TipoDeOperacion,
} from './cola.ts';
import { OperacionInvalida, idLocalDe, type Ejecutor } from './ejecutores.ts';
import {
  META_ULTIMA_SINCRONIZACION,
  crearExclusion,
  crearMotor,
  type DependenciasDelMotor,
  type EventoDelMotor,
  type Exclusion,
} from './motor.ts';

const PERSONA = 'ana';
const AHORA = new Date('2026-10-07T12:00:00.000Z');
const SIN_AZAR = () => 0.5;

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// El banco de pruebas
// ---------------------------------------------------------------------------

/** Un "servidor" que es idempotente por operationId, como el de verdad. */
function crearServidor() {
  const recibido = new Map<string, unknown>();
  let creaciones = 0;

  return {
    /** Cuantas cosas distintas se crearon de verdad. */
    creaciones: () => creaciones,
    /** Lo que recibio, por operationId. */
    recibido,
    atender(operacion: Operacion): unknown {
      const ya = recibido.get(operacion.operationId);

      if (ya !== undefined) {
        // Reintento: devuelve lo mismo sin crear nada.
        return ya;
      }

      creaciones += 1;

      const respuesta = { id: `srv-${operacion.operationId}`, version: 1, tipo: operacion.tipo };

      recibido.set(operacion.operationId, respuesta);

      return respuesta;
    },
  };
}

function ejecutoresDe(servidor: ReturnType<typeof crearServidor>) {
  const llamadas: string[] = [];
  const ejecutores = Object.fromEntries(
    TIPOS_DE_OPERACION.map((tipo) => [
      tipo,
      vi.fn((operacion: Operacion) => {
        llamadas.push(operacion.operationId);

        return Promise.resolve(servidor.atender(operacion));
      }),
    ]),
  ) as unknown as Record<TipoDeOperacion, ReturnType<typeof vi.fn<Ejecutor>>>;

  return { ejecutores, llamadas };
}

interface Banco {
  readonly almacen: AlmacenLocal;
  readonly motor: ReturnType<typeof crearMotor>;
  readonly servidor: ReturnType<typeof crearServidor>;
  readonly ejecutores: ReturnType<typeof ejecutoresDe>['ejecutores'];
  readonly llamadas: string[];
  readonly reloj: { ahora: Date };
  readonly sesion: { persona: string | null };
  readonly conexion: { hay: boolean; preguntas: number };
  encolar(operationId: string, cambios?: Partial<Operacion>): Promise<Operacion>;
  estado(operationId: string): Promise<Operacion>;
}

function armar(opciones: Partial<DependenciasDelMotor> & { almacen?: AlmacenLocal } = {}): Banco {
  const almacen = opciones.almacen ?? crearAlmacenEnMemoria(PERSONA);
  const servidor = crearServidor();
  const { ejecutores, llamadas } = ejecutoresDe(servidor);
  const reloj = { ahora: AHORA };
  const sesion: { persona: string | null } = { persona: PERSONA };
  const conexion = { hay: true, preguntas: 0 };
  const motor = crearMotor({
    almacen,
    ejecutores,
    personaDeLaSesion: () => sesion.persona,
    confirmarConexion: () => {
      conexion.preguntas += 1;

      return Promise.resolve(conexion.hay);
    },
    reloj: () => reloj.ahora,
    azar: SIN_AZAR,
    ...opciones,
  });

  return {
    almacen,
    motor,
    servidor,
    ejecutores,
    llamadas,
    reloj,
    sesion,
    conexion,
    encolar: (operationId, cambios = {}) =>
      almacen.agregarOperacion({
        ...nuevaOperacion(
          {
            operationId,
            tipo: 'pendiente.crear',
            entidad: `pendiente:${operationId}`,
            payload: { clientOperationId: operationId, texto: 'Llamar', nivel: 'urgente' },
          },
          AHORA,
        ),
        ...cambios,
      }),
    estado: async (operationId) => {
      const operacion = await almacen.operacion(operationId);

      if (operacion === null) {
        throw new Error(`la operacion ${operationId} no esta`);
      }

      return operacion;
    },
  };
}

/** Un payload que pasa la comprobacion de su tipo. */
function payloadValidoDe(tipo: TipoDeOperacion, operationId: string): Record<string, unknown> {
  switch (tipo) {
    case 'resultado.registrar':
      return {
        clientOperationId: operationId,
        activityId: 'act-1',
        completedAt: AHORA.toISOString(),
      };
    case 'diario.escribir':
      return { clientOperationId: operationId, dia: '2026-10-07', contenido: {} };
    case 'diario.editar':
      return { id: 'a-1', version: 1 };
    case 'pendiente.crear':
      return { clientOperationId: operationId, texto: 'Llamar', nivel: 'urgente' };
    case 'pendiente.editar':
      return { id: 'p-1', cambios: {} };
    case 'pendiente.borrar':
      return { id: 'p-1' };
  }
}

const sinRed = () => new TypeError('Failed to fetch');
const api = (estado: number, codigo?: string, reintentarEnSegundos?: number) =>
  new ErrorDeLaApi(estado, 'mensaje', undefined, codigo, reintentarEnSegundos);

// ---------------------------------------------------------------------------

describe('cuando no hay nada que hacer', () => {
  it('una cola vacia no toca la red', async () => {
    const banco = armar();

    const resultado = await banco.motor.sincronizar('apertura');

    expect(resultado.estado).toBe('nada_que_hacer');
    expect(banco.conexion.preguntas).toBe(0);
    expect(banco.llamadas).toEqual([]);
  });

  it('con todo ya enviado, tampoco', async () => {
    const banco = armar();

    await banco.encolar('a', { estado: 'hecha' });

    expect((await banco.motor.sincronizar('apertura')).estado).toBe('nada_que_hacer');
    expect(banco.conexion.preguntas).toBe(0);
  });

  it('con lo pendiente en espera de atencion o conflicto, tampoco', async () => {
    const banco = armar();

    await banco.encolar('a', { estado: 'requiere_atencion' });
    await banco.encolar('b', { estado: 'conflicto' });

    expect((await banco.motor.sincronizar('manual')).estado).toBe('nada_que_hacer');
  });
});

describe('cuando hay conexion', () => {
  it('envia lo pendiente, en el orden en que llego, y lo deja hecho con su recibo', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.encolar('b');
    await banco.encolar('c');

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('terminada');
    expect(banco.llamadas).toEqual(['a', 'b', 'c']);
    expect(resultado.resumen).toMatchObject({
      enviadas: 3,
      requierenAtencion: 0,
      conflictos: 0,
      pendientes: 0,
    });

    for (const id of ['a', 'b', 'c']) {
      expect(await banco.estado(id)).toMatchObject({
        estado: 'hecha',
        recibo: { id: `srv-${id}`, version: 1 },
        error: null,
        proximoIntento: null,
      });
    }
  });

  it('entrega lo que respondio la API: de ahi sale lo que se le ensena a la persona', async () => {
    const banco = armar();

    await banco.encolar('a');

    const { resumen } = await banco.motor.sincronizar('conexion');

    expect(resumen.recibos).toEqual([
      {
        operationId: 'a',
        tipo: 'pendiente.crear',
        recibo: { id: 'srv-a', version: 1, tipo: 'pendiente.crear' },
        // Cuando se guardo: sirve para saber si salio de inmediato o espero (SCRUM-138).
        creadaEn: AHORA.toISOString(),
      },
    ]);
  });

  it('un recibo sin contenido (un 204) queda como nulo', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockResolvedValue(undefined);
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha', recibo: null });
  });

  it('anota cuando se sincronizo por ultima vez', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(await banco.almacen.leerMeta(META_ULTIMA_SINCRONIZACION)).toBe(AHORA.toISOString());
  });

  it('envia cada tipo con SU ejecutor', async () => {
    const banco = armar();

    for (const tipo of TIPOS_DE_OPERACION) {
      await banco.encolar(`op-${tipo}`, {
        tipo,
        entidad: `e:${tipo}`,
        payload: payloadValidoDe(tipo, `op-${tipo}`),
      });
    }

    const { resumen } = await banco.motor.sincronizar('manual');

    for (const tipo of TIPOS_DE_OPERACION) {
      expect(banco.ejecutores[tipo]).toHaveBeenCalledTimes(1);
      expect(banco.ejecutores[tipo].mock.calls[0]?.[0].operationId).toBe(`op-${tipo}`);
    }

    // Y cada recibo dice de que tipo de operacion es.
    expect(resumen.recibos.map((r) => [r.operationId, r.tipo])).toEqual(
      TIPOS_DE_OPERACION.map((tipo) => [`op-${tipo}`, tipo]),
    );
  });

  it('una segunda sincronizacion no reenvia lo que ya se envio', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    await banco.motor.sincronizar('manual');

    expect(banco.llamadas).toEqual(['a']);
  });

  it('lo encolado despues de una sincronizacion se envia en la siguiente', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    await banco.encolar('b');
    await banco.motor.sincronizar('manual');

    expect(banco.llamadas).toEqual(['a', 'b']);
  });
});

describe('sin conexion', () => {
  it('no envia nada y deja todo como estaba, sin gastar intentos', async () => {
    const banco = armar();

    banco.conexion.hay = false;
    await banco.encolar('a');
    await banco.encolar('b');

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('sin_conexion');
    expect(resultado.resumen.pendientes).toBe(2);
    expect(banco.llamadas).toEqual([]);
    expect(await banco.estado('a')).toMatchObject({
      estado: 'pendiente',
      intentos: 0,
      proximoIntento: null,
    });
    expect(await banco.estado('b')).toMatchObject({ estado: 'pendiente', intentos: 0 });
  });

  it('no anota que sincronizo', async () => {
    const banco = armar();

    banco.conexion.hay = false;
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(await banco.almacen.leerMeta(META_ULTIMA_SINCRONIZACION)).toBeNull();
  });

  it('cuando vuelve la red, envia lo guardado (nada se perdio)', async () => {
    const banco = armar();

    banco.conexion.hay = false;
    await banco.encolar('a');
    await banco.encolar('b');
    await banco.motor.sincronizar('manual');

    banco.conexion.hay = true;

    const resultado = await banco.motor.sincronizar('conexion');

    expect(resultado.estado).toBe('terminada');
    expect(banco.llamadas).toEqual(['a', 'b']);
    expect(banco.servidor.creaciones()).toBe(2);
  });

  it('si la red cae A MEDIAS: lo enviado queda hecho, lo demas queda como estaba, y se detiene', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.encolar('b');
    await banco.encolar('c');
    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) => {
      banco.llamadas.push(operacion.operationId);

      return operacion.operationId === 'b'
        ? Promise.reject(sinRed())
        : Promise.resolve(banco.servidor.atender(operacion));
    });

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('sin_conexion');
    expect(banco.llamadas).toEqual(['a', 'b']); // la c ni se intento: fallaria igual
    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha' });
    expect(await banco.estado('b')).toMatchObject({
      estado: 'pendiente',
      intentos: 0,
      proximoIntento: null,
    });
    expect(await banco.estado('c')).toMatchObject({ estado: 'pendiente', intentos: 0 });
    expect(resultado.resumen).toMatchObject({ enviadas: 1, pendientes: 2 });
    // Una tanda cortada no es una sincronizacion completa: no se anota como tal.
    expect(await banco.almacen.leerMeta(META_ULTIMA_SINCRONIZACION)).toBeNull();
  });

  it('una red que cae NO es culpa de la operacion: no cuenta como intento por mas veces que ocurra', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(sinRed());
    await banco.encolar('a');

    for (let i = 0; i < MAXIMO_DE_INTENTOS + 5; i += 1) {
      await banco.motor.sincronizar('programada');
    }

    // Puede durar dias sin red: la operacion no se rinde ni se marca como atascada.
    expect(await banco.estado('a')).toMatchObject({ estado: 'pendiente', intentos: 0 });
  });

  it('la pagina de un portal cautivo (200 con HTML) cuenta como no tener red', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(new SyntaxError('Unexpected token <'));
    await banco.encolar('a');

    expect((await banco.motor.sincronizar('manual')).estado).toBe('sin_conexion');
    expect(await banco.estado('a')).toMatchObject({ estado: 'pendiente', intentos: 0 });
  });
});

describe('que no se duplique nada (HU_MF09_002 criterio 2)', () => {
  it('si la respuesta se pierde y se reenvia con el mismo identificador, el servidor no crea otra', async () => {
    const banco = armar();
    let primeraVez = true;

    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) => {
      banco.llamadas.push(operacion.operationId);

      // El servidor la crea, pero la respuesta no llega.
      const respuesta = banco.servidor.atender(operacion);

      if (primeraVez) {
        primeraVez = false;

        return Promise.reject(sinRed());
      }

      return Promise.resolve(respuesta);
    });

    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({ estado: 'pendiente' });

    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha', recibo: { id: 'srv-a' } });
    expect(banco.llamadas).toEqual(['a', 'a']); // se envio dos veces...
    expect(banco.servidor.creaciones()).toBe(1); // ...y se creo una sola.
  });

  it('manda siempre el mismo operationId en cada reintento', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValueOnce(sinRed());
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    await banco.motor.sincronizar('manual');

    const enviados = banco.ejecutores['pendiente.crear'].mock.calls.map(([op]) => op.operationId);

    expect(enviados).toEqual(['a', 'a']);
  });

  it('si la pagina se cerro enviando (queda "enviando"), al volver se reenvia y no se duplica', async () => {
    const banco = armar();

    await banco.encolar('a');
    banco.servidor.atender(await banco.estado('a')); // el servidor ya la habia recibido
    await banco.almacen.guardarOperacion({ ...(await banco.estado('a')), estado: 'enviando' });

    await banco.motor.sincronizar('apertura');

    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha' });
    expect(banco.servidor.creaciones()).toBe(1);
  });
});

describe('la sesion caduca (criterio 5)', () => {
  it('se detiene, pide entrar de nuevo, y NO descarta nada de la cola', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.encolar('b');
    await banco.encolar('c');
    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) => {
      banco.llamadas.push(operacion.operationId);

      return operacion.operationId === 'b'
        ? Promise.reject(api(401, 'TOKEN_INVALIDO'))
        : Promise.resolve(banco.servidor.atender(operacion));
    });

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('sesion_vencida');
    expect(banco.llamadas).toEqual(['a', 'b']);
    expect(await banco.almacen.operaciones()).toHaveLength(3);
    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha' });
    // La que recibio el 401 vuelve a esperar SIN gastar un intento: no es culpa suya.
    expect(await banco.estado('b')).toMatchObject({
      estado: 'pendiente',
      intentos: 0,
      error: null,
    });
    expect(await banco.estado('c')).toMatchObject({ estado: 'pendiente', intentos: 0 });
    expect(await banco.almacen.leerMeta(META_ULTIMA_SINCRONIZACION)).toBeNull();
  });

  it('cuando la persona vuelve a entrar, se envia lo que quedo', async () => {
    const banco = armar();
    let sesionValida = false;

    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) =>
      sesionValida ? Promise.resolve(banco.servidor.atender(operacion)) : Promise.reject(api(401)),
    );
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    sesionValida = true;

    expect((await banco.motor.sincronizar('manual')).estado).toBe('terminada');
    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha' });
  });

  it('sin sesion no se manda nada', async () => {
    const banco = armar();

    banco.sesion.persona = null;
    await banco.encolar('a');

    expect((await banco.motor.sincronizar('manual')).estado).toBe('sin_sesion');
    expect(banco.llamadas).toEqual([]);
    expect(banco.conexion.preguntas).toBe(0);
  });
});

describe('nunca se envia con la sesion de otra persona', () => {
  it('si la sesion es de otra persona que la de este almacen, no se manda nada', async () => {
    const banco = armar();

    banco.sesion.persona = 'beto';
    await banco.encolar('a');

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('persona_distinta');
    expect(banco.llamadas).toEqual([]);
    expect(banco.conexion.preguntas).toBe(0);
    expect(await banco.estado('a')).toMatchObject({ estado: 'pendiente' });
  });

  it('lo dice aunque no haya nada pendiente: no es lo mismo que "nada que hacer"', async () => {
    const banco = armar();

    banco.sesion.persona = 'beto';

    expect((await banco.motor.sincronizar('apertura')).estado).toBe('persona_distinta');
  });

  it('si la sesion cambia A MEDIAS, se detiene en ese momento y no envia mas', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.encolar('b');
    await banco.encolar('c');
    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) => {
      banco.llamadas.push(operacion.operationId);

      if (operacion.operationId === 'a') {
        banco.sesion.persona = 'beto'; // entro otra persona mientras se enviaba
      }

      return Promise.resolve(banco.servidor.atender(operacion));
    });

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('persona_distinta');
    expect(banco.llamadas).toEqual(['a']);
    expect(await banco.estado('b')).toMatchObject({ estado: 'pendiente' });
    expect(await banco.estado('c')).toMatchObject({ estado: 'pendiente' });
  });
});

describe('un fallo pasajero se reintenta con espera creciente (criterio 3)', () => {
  it('el primer fallo la deja pendiente, con un intento y la hora del proximo', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503, 'ERROR_INTERNO'));
    await banco.encolar('a');

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('terminada');
    expect(await banco.estado('a')).toMatchObject({
      estado: 'pendiente',
      intentos: 1,
      proximoIntento: new Date(AHORA.getTime() + ESPERA_BASE_EN_MS).toISOString(),
      error: { codigo: 'ERROR_INTERNO', estado: 503, momento: AHORA.toISOString() },
    });
    expect(resultado.resumen.pendientes).toBe(1);
  });

  it('antes de la hora del reintento no se vuelve a enviar', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503));
    await banco.encolar('a');
    await banco.motor.sincronizar('conexion');
    banco.ejecutores['pendiente.crear'].mockClear();
    banco.reloj.ahora = new Date(AHORA.getTime() + ESPERA_BASE_EN_MS - 1);

    await banco.motor.sincronizar('programada');

    expect(banco.ejecutores['pendiente.crear']).not.toHaveBeenCalled();
  });

  it('y si es lo unico que hay, ni se toca la red: abrir la app no cuesta una peticion', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503));
    await banco.encolar('a');
    await banco.motor.sincronizar('conexion');

    const preguntas = banco.conexion.preguntas;
    const resultado = await banco.motor.sincronizar('apertura');

    expect(resultado.estado).toBe('nada_que_hacer');
    expect(resultado.resumen.pendientes).toBe(1);
    expect(banco.conexion.preguntas).toBe(preguntas);
  });

  it('"Sincronizar ahora" no espera el reintento programado: se envia ya', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValueOnce(api(503));
    await banco.encolar('a');
    await banco.motor.sincronizar('conexion');

    // Todavia falta para la hora del reintento.
    expect((await banco.estado('a')).proximoIntento).not.toBeNull();

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('terminada');
    expect(resultado.resumen.enviadas).toBe(1);
    expect(await banco.estado('a')).toMatchObject({
      estado: 'hecha',
      proximoIntento: null,
      error: null,
    });
  });

  it('pero cada operacion se intenta una sola vez por tanda: si vuelve a fallar no se repite en bucle', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503));
    await banco.encolar('a');
    await banco.motor.sincronizar('conexion');
    banco.ejecutores['pendiente.crear'].mockClear();

    await banco.motor.sincronizar('manual');

    expect(banco.ejecutores['pendiente.crear']).toHaveBeenCalledTimes(1);
    expect(await banco.estado('a')).toMatchObject({ estado: 'pendiente', intentos: 2 });
  });

  it('"Sincronizar ahora" tampoco pasa por encima de una dependencia que fallo', async () => {
    const banco = armar();

    await banco.encolar('crear', { estado: 'requiere_atencion' });
    await banco.encolar('editar', {
      tipo: 'pendiente.editar',
      dependeDe: 'crear',
      payload: { id: idLocalDe('crear'), cambios: {} },
    });

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('nada_que_hacer');
    expect(banco.ejecutores['pendiente.editar']).not.toHaveBeenCalled();
  });

  it('lo que espera su turno detras de otra no toca la red mientras la otra no este lista', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503));
    await banco.encolar('crear');
    await banco.encolar('editar', {
      tipo: 'pendiente.editar',
      dependeDe: 'crear',
      payload: { id: idLocalDe('crear'), cambios: {} },
    });
    await banco.motor.sincronizar('conexion');

    const preguntas = banco.conexion.preguntas;

    expect((await banco.motor.sincronizar('programada')).estado).toBe('nada_que_hacer');
    expect(banco.conexion.preguntas).toBe(preguntas);
  });

  it('a la hora del reintento se envia, y si esta vez sale bien queda hecha', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValueOnce(api(503));
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    banco.reloj.ahora = new Date(AHORA.getTime() + ESPERA_BASE_EN_MS);

    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({
      estado: 'hecha',
      error: null,
      proximoIntento: null,
    });
  });

  it('la espera se duplica en cada fallo seguido', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(502));
    await banco.encolar('a');

    const esperas: number[] = [];

    for (let i = 0; i < 4; i += 1) {
      await banco.motor.sincronizar('manual');

      const { proximoIntento } = await banco.estado('a');

      esperas.push(new Date(proximoIntento ?? 0).getTime() - banco.reloj.ahora.getTime());
      banco.reloj.ahora = new Date(proximoIntento ?? 0);
    }

    expect(esperas).toEqual([
      ESPERA_BASE_EN_MS,
      ESPERA_BASE_EN_MS * 2,
      ESPERA_BASE_EN_MS * 4,
      ESPERA_BASE_EN_MS * 8,
    ]);
  });

  it('con un poco de azar: dos dispositivos que fallaron a la vez no vuelven a la vez', async () => {
    const esperas: number[] = [];

    for (const azar of [0, 0.999]) {
      const banco = armar({ azar: () => azar });

      banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503));
      await banco.encolar('a');
      await banco.motor.sincronizar('manual');
      esperas.push(
        new Date((await banco.estado('a')).proximoIntento ?? 0).getTime() - AHORA.getTime(),
      );
    }

    expect(esperas[0]).toBe(ESPERA_BASE_EN_MS * 0.8);
    expect(esperas[1]).toBeGreaterThan(ESPERA_BASE_EN_MS * 1.19);
    expect(esperas[1]).toBeLessThan(ESPERA_BASE_EN_MS * 1.2 + 1);
  });

  it('respeta lo que pide el servidor: nunca antes del Retry-After', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(429, 'DEMASIADAS_PETICIONES', 120));
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect((await banco.estado('a')).proximoIntento).toBe(
      new Date(AHORA.getTime() + 120_000).toISOString(),
    );
  });

  it('un fallo pasajero NO detiene a lo independiente', async () => {
    const banco = armar();

    await banco.encolar('lenta');
    await banco.encolar('otra');
    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) => {
      banco.llamadas.push(operacion.operationId);

      return operacion.operationId === 'lenta'
        ? Promise.reject(api(503))
        : Promise.resolve(banco.servidor.atender(operacion));
    });

    await banco.motor.sincronizar('manual');

    expect(banco.llamadas).toEqual(['lenta', 'otra']);
    expect(await banco.estado('otra')).toMatchObject({ estado: 'hecha' });
  });

  it('pero SI retiene a lo que depende de ella', async () => {
    const banco = armar();

    await banco.encolar('crear');
    await banco.encolar('editar', {
      tipo: 'pendiente.editar',
      dependeDe: 'crear',
      payload: { id: idLocalDe('crear'), cambios: {} },
    });
    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(503));

    await banco.motor.sincronizar('manual');

    expect(banco.ejecutores['pendiente.editar']).not.toHaveBeenCalled();
    expect(await banco.estado('editar')).toMatchObject({ estado: 'pendiente' });
  });

  it('tras agotar los intentos deja de insistir y pide atencion', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(500, 'ERROR_INTERNO'));
    await banco.encolar('a');

    let ultima: Awaited<ReturnType<typeof banco.motor.sincronizar>> | null = null;

    for (let i = 0; i < MAXIMO_DE_INTENTOS; i += 1) {
      ultima = await banco.motor.sincronizar('programada');
      banco.reloj.ahora = new Date(banco.reloj.ahora.getTime() + 24 * 60 * 60 * 1000);
    }

    // Y la tanda en la que se rinde lo cuenta: es la que le dice a la persona que hay algo.
    expect(ultima?.resumen).toMatchObject({ requierenAtencion: 1, pendientes: 0 });

    expect(await banco.estado('a')).toMatchObject({
      estado: 'requiere_atencion',
      intentos: MAXIMO_DE_INTENTOS,
      proximoIntento: null,
      error: { codigo: 'SIN_RESPUESTA', estado: 500 },
    });
    expect(banco.ejecutores['pendiente.crear']).toHaveBeenCalledTimes(MAXIMO_DE_INTENTOS);
  });

  it('un fallo inesperado (un error que no es de la API) tambien se reintenta', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(new Error('algo raro'));
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({
      estado: 'pendiente',
      intentos: 1,
      error: { codigo: 'ERROR_INESPERADO' },
    });
  });
});

describe('un rechazo permanente no bloquea a las demas (criterio 4)', () => {
  it('se marca para atencion, con su codigo, y se sigue con lo independiente', async () => {
    const banco = armar();

    await banco.encolar('mala');
    await banco.encolar('buena');
    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) => {
      banco.llamadas.push(operacion.operationId);

      return operacion.operationId === 'mala'
        ? Promise.reject(api(400, 'PENDIENTE_INVALIDO'))
        : Promise.resolve(banco.servidor.atender(operacion));
    });

    const resultado = await banco.motor.sincronizar('manual');

    expect(resultado.estado).toBe('terminada');
    expect(banco.llamadas).toEqual(['mala', 'buena']);
    expect(await banco.estado('mala')).toMatchObject({
      estado: 'requiere_atencion',
      error: { codigo: 'PENDIENTE_INVALIDO', estado: 400 },
    });
    expect(await banco.estado('buena')).toMatchObject({ estado: 'hecha' });
    expect(resultado.resumen).toMatchObject({ enviadas: 1, requierenAtencion: 1, conflictos: 0 });
  });

  it('no se reintenta: reintentar no cambia la respuesta', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(404, 'PENDIENTE_NO_ENCONTRADO'));
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    await banco.motor.sincronizar('manual');
    await banco.motor.sincronizar('manual');

    expect(banco.ejecutores['pendiente.crear']).toHaveBeenCalledTimes(1);
  });

  it('lo que depende de ella queda BLOQUEADO y no se envia: editar algo que nunca se creo no tiene sentido', async () => {
    const banco = armar();

    await banco.encolar('crear');
    await banco.encolar('editar', {
      tipo: 'pendiente.editar',
      dependeDe: 'crear',
      payload: { id: idLocalDe('crear'), cambios: {} },
    });
    await banco.encolar('independiente');
    banco.ejecutores['pendiente.crear'].mockImplementation((operacion: Operacion) =>
      operacion.operationId === 'crear'
        ? Promise.reject(api(400, 'PENDIENTE_INVALIDO'))
        : Promise.resolve(banco.servidor.atender(operacion)),
    );

    const resultado = await banco.motor.sincronizar('manual');

    expect(banco.ejecutores['pendiente.editar']).not.toHaveBeenCalled();
    expect(await banco.estado('editar')).toMatchObject({ estado: 'pendiente' });
    expect(await banco.estado('independiente')).toMatchObject({ estado: 'hecha' });
    expect(resultado.resumen.pendientes).toBe(1);
  });

  it('una operacion que no se pudo ni armar (OperacionInvalida) es permanente, con su codigo', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(
      new OperacionInvalida('REFERENCIA_SIN_RESOLVER'),
    );
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({
      estado: 'requiere_atencion',
      error: { codigo: 'REFERENCIA_SIN_RESOLVER' },
    });
  });

  it('el error guardado no repite lo que contenia la operacion', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(
      new ErrorDeLaApi(400, 'El texto MUY-SECRETO-123 no vale', undefined, 'PENDIENTE_INVALIDO'),
    );
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(JSON.stringify((await banco.estado('a')).error)).not.toContain('SECRETO');
  });
});

describe('un conflicto no pisa nada (ADR 0009)', () => {
  it('se marca como conflicto, con su codigo, y se sigue con lo independiente', async () => {
    const banco = armar();

    await banco.encolar('editada', { tipo: 'diario.editar', payload: { id: 'a-1', version: 1 } });
    await banco.encolar('otra');
    banco.ejecutores['diario.editar'].mockRejectedValue(api(409, 'VERSION_DESACTUALIZADA'));

    const resultado = await banco.motor.sincronizar('manual');

    expect(await banco.estado('editada')).toMatchObject({
      estado: 'conflicto',
      error: { codigo: 'VERSION_DESACTUALIZADA', estado: 409 },
    });
    expect(await banco.estado('otra')).toMatchObject({ estado: 'hecha' });
    expect(resultado.resumen).toMatchObject({ enviadas: 1, conflictos: 1, requierenAtencion: 0 });
  });

  it('una edicion fuera de plazo tambien es un conflicto (se guarda como anotacion nueva)', async () => {
    const banco = armar();

    await banco.encolar('editada', { tipo: 'diario.editar', payload: { id: 'a-1', version: 1 } });
    banco.ejecutores['diario.editar'].mockRejectedValue(api(409, 'EDICION_FUERA_DE_PLAZO'));
    await banco.motor.sincronizar('manual');

    expect((await banco.estado('editada')).estado).toBe('conflicto');
  });

  it('no se reenvia mientras la persona no lo resuelva', async () => {
    const banco = armar();

    banco.ejecutores['pendiente.crear'].mockRejectedValue(api(409, 'VERSION_DESACTUALIZADA'));
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    await banco.motor.sincronizar('manual');

    expect(banco.ejecutores['pendiente.crear']).toHaveBeenCalledTimes(1);
  });
});

describe('el orden sobre una misma cosa', () => {
  it('lo que depende de otra se envia DESPUES, con el recibo de la anterior a mano', async () => {
    const banco = armar();
    let reciboVisto: unknown = 'no se llamo';

    await banco.encolar('crear');
    await banco.encolar('editar', {
      tipo: 'pendiente.editar',
      dependeDe: 'crear',
      payload: { id: idLocalDe('crear'), cambios: {} },
    });
    banco.ejecutores['pendiente.editar'].mockImplementation((operacion: Operacion, contexto) => {
      banco.llamadas.push(operacion.operationId);
      reciboVisto = contexto.reciboDe('crear');

      return Promise.resolve({ id: 'srv-crear', version: 2 });
    });

    await banco.motor.sincronizar('manual');

    expect(banco.llamadas).toEqual(['crear', 'editar']);
    expect(reciboVisto).toEqual({ id: 'srv-crear', version: 1, tipo: 'pendiente.crear' });
  });

  it('una cadena larga se envia entera, en orden, en una sola sincronizacion', async () => {
    const banco = armar();

    await banco.encolar('uno');
    await banco.encolar('dos', { dependeDe: 'uno' });
    await banco.encolar('tres', { dependeDe: 'dos' });
    await banco.encolar('cuatro', { dependeDe: 'tres' });

    const resultado = await banco.motor.sincronizar('manual');

    expect(banco.llamadas).toEqual(['uno', 'dos', 'tres', 'cuatro']);
    expect(resultado.resumen.enviadas).toBe(4);
  });

  it('el recibo de una operacion que no termino (la que se esta enviando, o una que no existe) no esta disponible', async () => {
    const banco = armar();
    const vistos: unknown[] = [];

    await banco.encolar('a');
    banco.ejecutores['pendiente.crear'].mockImplementation((_operacion: Operacion, contexto) => {
      vistos.push(contexto.reciboDe('otra-que-no-existe'));
      vistos.push(contexto.reciboDe('a'));

      return Promise.resolve({ id: 'x' });
    });
    await banco.motor.sincronizar('manual');

    // Mientras se envia, 'a' esta "enviando": todavia no tiene recibo que dar.
    expect(vistos).toEqual([null, null]);
    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha', recibo: { id: 'x' } });
  });

  it('el orden de llegada manda entre cosas distintas', async () => {
    const banco = armar();

    await banco.encolar('z');
    await banco.encolar('a');
    await banco.encolar('m');
    await banco.motor.sincronizar('manual');

    expect(banco.llamadas).toEqual(['z', 'a', 'm']);
  });
});

describe('el recibo de las demas', () => {
  it('solo las que terminaron bien dan recibo: una rechazada, aunque tuviera uno viejo, no', async () => {
    const banco = armar();
    let visto: unknown = 'no se llamo';

    await banco.encolar('rechazada', {
      estado: 'requiere_atencion',
      recibo: { id: 'de-un-intento-anterior' },
    });
    await banco.encolar('a');
    banco.ejecutores['pendiente.crear'].mockImplementation((_operacion: Operacion, contexto) => {
      visto = contexto.reciboDe('rechazada');

      return Promise.resolve({ id: 'x' });
    });
    await banco.motor.sincronizar('manual');

    expect(visto).toBeNull();
  });
});

describe('cuando la operacion no se puede enviar tal como esta', () => {
  it('un payload invalido no se envia: se marca, no se descarta', async () => {
    const banco = armar();

    await banco.encolar('a', { payload: { clientOperationId: 'a', texto: '', nivel: 'urgente' } });

    const resultado = await banco.motor.sincronizar('manual');

    expect(banco.ejecutores['pendiente.crear']).not.toHaveBeenCalled();
    expect(await banco.estado('a')).toMatchObject({
      estado: 'requiere_atencion',
      error: { codigo: 'PAYLOAD_INVALIDO' },
    });
    expect(resultado.resumen.requierenAtencion).toBe(1);
  });

  it('una forma de payload mas nueva se marca, para que una version posterior de la app la envie', async () => {
    const banco = armar();

    await banco.encolar('a', { payloadVersion: 99 });
    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({
      estado: 'requiere_atencion',
      error: { codigo: 'PAYLOAD_VERSION_NO_SOPORTADA' },
    });
  });

  it('una operacion ilegible (cambio la clave, se altero) se marca y no se descarta', async () => {
    const banco = armar();
    const a = await banco.encolar('a');

    await banco.almacen.guardarOperacion({ ...a, ilegible: true, payload: null });
    await banco.encolar('b');
    await banco.motor.sincronizar('manual');

    expect(await banco.estado('a')).toMatchObject({
      estado: 'requiere_atencion',
      error: { codigo: 'ALMACEN_ILEGIBLE' },
    });
    // Y no detiene a las demas.
    expect(await banco.estado('b')).toMatchObject({ estado: 'hecha' });
    expect(banco.llamadas).toEqual(['b']);
  });

  it('se marca aunque no haya red ni nada mas que enviar: para eso no hace falta conexion', async () => {
    const banco = armar();
    const a = await banco.encolar('a');

    banco.conexion.hay = false;
    await banco.almacen.guardarOperacion({ ...a, ilegible: true, payload: null });

    const resultado = await banco.motor.sincronizar('apertura');

    expect(resultado.estado).toBe('nada_que_hacer');
    expect(banco.conexion.preguntas).toBe(0);
    expect(await banco.estado('a')).toMatchObject({
      estado: 'requiere_atencion',
      error: { codigo: 'ALMACEN_ILEGIBLE', momento: AHORA.toISOString() },
    });
  });

  it('una ilegible que ya espera atencion no se vuelve a anotar cada vez', async () => {
    const banco = armar();
    const a = await banco.encolar('a');

    await banco.almacen.guardarOperacion({
      ...a,
      ilegible: true,
      payload: null,
      estado: 'requiere_atencion',
      error: { codigo: 'ALMACEN_ILEGIBLE', momento: 'antes' },
    });
    await banco.encolar('b');
    await banco.motor.sincronizar('manual');

    expect((await banco.estado('a')).error?.momento).toBe('antes');
  });
});

describe('limpiar lo viejo', () => {
  it('lo que termino bien hace mas de una semana se quita', async () => {
    const banco = armar();
    const vieja = new Date(
      AHORA.getTime() - (DIAS_QUE_SE_CONSERVAN_LAS_HECHAS * 24 * 60 * 60 * 1000 + 1000),
    );

    await banco.encolar('vieja', { estado: 'hecha', creadaEn: vieja.toISOString() });
    await banco.encolar('reciente', {
      estado: 'hecha',
      creadaEn: new Date(AHORA.getTime() - 60_000).toISOString(),
    });
    await banco.encolar('pendiente');
    await banco.motor.sincronizar('manual');

    expect(await banco.almacen.operacion('vieja')).toBeNull();
    expect(await banco.almacen.operacion('reciente')).not.toBeNull();
  });

  it('una de casi una semana todavia se conserva', async () => {
    const banco = armar();
    const casi = new Date(
      AHORA.getTime() - (DIAS_QUE_SE_CONSERVAN_LAS_HECHAS * 24 * 60 * 60 * 1000 - 60_000),
    );

    await banco.encolar('casi', { estado: 'hecha', creadaEn: casi.toISOString() });
    await banco.encolar('pendiente');
    await banco.motor.sincronizar('manual');

    expect(await banco.almacen.operacion('casi')).not.toBeNull();
  });

  it('solo se quitan las que terminaron bien: lo que espera atencion se conserva por viejo que sea', async () => {
    const banco = armar();
    const vieja = new Date(AHORA.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    await banco.encolar('rechazada', { estado: 'requiere_atencion', creadaEn: vieja });
    await banco.encolar('conflicto', { estado: 'conflicto', creadaEn: vieja });
    await banco.encolar('pendiente', { creadaEn: vieja });
    await banco.motor.sincronizar('manual');

    expect(await banco.almacen.operacion('rechazada')).not.toBeNull();
    expect(await banco.almacen.operacion('conflicto')).not.toBeNull();
  });
});

describe('una sola sincronizacion a la vez', () => {
  it('una segunda mientras la primera sigue dice que esta ocupada, y no envia nada dos veces', async () => {
    const banco = armar();
    let liberar: () => void = () => undefined;

    await banco.encolar('a');
    banco.ejecutores['pendiente.crear'].mockImplementation(
      (operacion: Operacion) =>
        new Promise((resolver) => {
          liberar = () => {
            resolver(banco.servidor.atender(operacion));
          };
        }),
    );

    const primera = banco.motor.sincronizar('manual');

    await vi.waitFor(() => {
      expect(banco.ejecutores['pendiente.crear']).toHaveBeenCalled();
    });

    expect(banco.motor.estaSincronizando()).toBe(true);

    const eventos: string[] = [];

    banco.motor.suscribir((evento) => eventos.push(evento.tipo));

    const segunda = await banco.motor.sincronizar('conexion');

    expect(segunda.estado).toBe('ocupada');
    // La segunda no es una tanda: ni anuncia que empieza, ni da por terminada la primera.
    expect(eventos).toEqual([]);
    expect(banco.motor.estaSincronizando()).toBe(true);

    liberar();
    await primera;

    expect(banco.motor.estaSincronizando()).toBe(false);
    expect(banco.ejecutores['pendiente.crear']).toHaveBeenCalledTimes(1);
  });

  it('otra pestana (la exclusion esta tomada) tambien la deja ocupada, sin tocar nada', async () => {
    const tomada: Exclusion = () => Promise.resolve({ ejecutada: false });
    const banco = armar({ exclusion: tomada });

    await banco.encolar('a');

    expect((await banco.motor.sincronizar('manual')).estado).toBe('ocupada');
    expect(banco.llamadas).toEqual([]);
    expect(await banco.estado('a')).toMatchObject({ estado: 'pendiente' });
  });

  it('la exclusion es por persona: el nombre lleva a quien pertenece', async () => {
    const nombres: string[] = [];
    const espia: Exclusion = async (nombre, tarea) => {
      nombres.push(nombre);

      return { ejecutada: true, valor: await tarea() };
    };
    const banco = armar({ exclusion: espia });

    await banco.motor.sincronizar('manual');

    expect(nombres).toEqual(['vsd-sincronizacion-ana']);
  });

  it('despues de terminar, se puede volver a sincronizar', async () => {
    const banco = armar();

    await banco.encolar('a');
    await banco.motor.sincronizar('manual');
    await banco.encolar('b');

    expect((await banco.motor.sincronizar('manual')).estado).toBe('terminada');
  });

  it('si algo falla por dentro, no deja la sincronizacion tomada para siempre', async () => {
    const banco = armar();
    const real = banco.almacen.operaciones.bind(banco.almacen);
    let falla = true;

    vi.spyOn(banco.almacen, 'operaciones').mockImplementation(() =>
      falla ? Promise.reject(new Error('el disco fallo')) : real(),
    );
    await expect(banco.motor.sincronizar('manual')).rejects.toThrow('el disco fallo');

    expect(banco.motor.estaSincronizando()).toBe(false);

    falla = false;

    expect((await banco.motor.sincronizar('manual')).estado).toBe('nada_que_hacer');
  });
});

describe('crearExclusion', () => {
  it('sin Web Locks, dos a la vez: la segunda no se ejecuta', async () => {
    vi.stubGlobal('navigator', {});

    const exclusion = crearExclusion();
    let liberar: () => void = () => undefined;
    const primera = exclusion(
      'x',
      () =>
        new Promise<string>((resolver) => {
          liberar = () => {
            resolver('una');
          };
        }),
    );
    const segunda = await exclusion('x', () => Promise.resolve('dos'));

    expect(segunda).toEqual({ ejecutada: false });

    liberar();

    expect(await primera).toEqual({ ejecutada: true, valor: 'una' });
  });

  it('sin Web Locks, nombres distintos no se estorban', async () => {
    vi.stubGlobal('navigator', {});

    const exclusion = crearExclusion();
    let liberar: () => void = () => undefined;
    const primera = exclusion(
      'a',
      () =>
        new Promise<string>((resolver) => {
          liberar = () => {
            resolver('una');
          };
        }),
    );

    expect(await exclusion('b', () => Promise.resolve('otra'))).toEqual({
      ejecutada: true,
      valor: 'otra',
    });

    liberar();
    await primera;
  });

  it('sin Web Locks, se libera al terminar, aunque la tarea falle', async () => {
    vi.stubGlobal('navigator', {});

    const exclusion = crearExclusion();

    await expect(exclusion('x', () => Promise.reject(new Error('fallo')))).rejects.toThrow('fallo');

    expect(await exclusion('x', () => Promise.resolve('ok'))).toEqual({
      ejecutada: true,
      valor: 'ok',
    });
  });

  it('con Web Locks, usa el bloqueo del navegador, que vale entre pestanas', async () => {
    const tomados = new Set<string>();
    const request = vi.fn(
      async (
        nombre: string,
        _opciones: unknown,
        callback: (bloqueo: object | null) => Promise<unknown>,
      ) => {
        if (tomados.has(nombre)) {
          return callback(null);
        }

        tomados.add(nombre);

        try {
          return await callback({});
        } finally {
          tomados.delete(nombre);
        }
      },
    );

    vi.stubGlobal('navigator', { locks: { request } });

    const exclusion = crearExclusion();
    let liberar: () => void = () => undefined;
    const primera = exclusion(
      'x',
      () =>
        new Promise<string>((resolver) => {
          liberar = () => {
            resolver('una');
          };
        }),
    );
    const segunda = await exclusion('x', () => Promise.resolve('dos'));

    expect(segunda).toEqual({ ejecutada: false });
    expect(request).toHaveBeenCalledWith('x', { ifAvailable: true }, expect.any(Function));

    liberar();

    expect(await primera).toEqual({ ejecutada: true, valor: 'una' });
  });
});

describe('los eventos', () => {
  it('avisa del inicio, de cada envio y del final', async () => {
    const banco = armar();
    const eventos: EventoDelMotor[] = [];

    banco.motor.suscribir((evento) => eventos.push(evento));
    await banco.encolar('a');
    await banco.encolar('b');
    await banco.motor.sincronizar('conexion');

    expect(eventos.map((e) => e.tipo)).toEqual(['inicio', 'enviada', 'enviada', 'fin']);
    expect(eventos[0]).toEqual({ tipo: 'inicio', motivo: 'conexion' });
    expect(eventos[1]).toMatchObject({
      tipo: 'enviada',
      operacion: { operationId: 'a', estado: 'hecha' },
    });
    expect(eventos[3]).toMatchObject({ tipo: 'fin', resultado: { estado: 'terminada' } });
  });

  it('el evento de cada envio trae lo que respondio la API', async () => {
    const banco = armar();
    const recibos: unknown[] = [];

    banco.motor.suscribir((evento) => {
      if (evento.tipo === 'enviada') {
        recibos.push(evento.recibo);
      }
    });
    await banco.encolar('a');
    await banco.motor.sincronizar('manual');

    expect(recibos).toEqual([{ id: 'srv-a', version: 1, tipo: 'pendiente.crear' }]);
  });

  it('avisa del final tambien cuando no habia nada que hacer', async () => {
    const banco = armar();
    const eventos: EventoDelMotor[] = [];

    banco.motor.suscribir((evento) => eventos.push(evento));
    await banco.motor.sincronizar('apertura');

    expect(eventos.map((e) => e.tipo)).toEqual(['inicio', 'fin']);
    expect(eventos[1]).toMatchObject({ resultado: { estado: 'nada_que_hacer' } });
  });

  it('quien deja de escuchar ya no recibe nada', async () => {
    const banco = armar();
    const oyente = vi.fn();
    const dejar = banco.motor.suscribir(oyente);

    dejar();
    await banco.motor.sincronizar('manual');

    expect(oyente).not.toHaveBeenCalled();
  });

  it('quien escucha y falla no rompe el envio ni a los demas oyentes', async () => {
    const banco = armar();
    const otro = vi.fn();

    banco.motor.suscribir(() => {
      throw new Error('el que escucha se rompio');
    });
    banco.motor.suscribir(otro);
    await banco.encolar('a');

    expect((await banco.motor.sincronizar('manual')).estado).toBe('terminada');
    expect(otro).toHaveBeenCalled();
    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha' });
  });
});

describe('cuando falla guardar lo que respondio la API', () => {
  it('no se confunde con un fallo de la API: la operacion se reenvia luego y no se duplica', async () => {
    const banco = armar();
    const real = banco.almacen.guardarOperacion.bind(banco.almacen);
    let discoLleno = true;

    vi.spyOn(banco.almacen, 'guardarOperacion').mockImplementation((operacion) =>
      discoLleno && operacion.estado === 'hecha'
        ? Promise.reject(new Error('no hay espacio'))
        : real(operacion),
    );
    await banco.encolar('a');

    await expect(banco.motor.sincronizar('manual')).rejects.toThrow('no hay espacio');

    // El servidor la recibio; aqui quedo "enviando", sin gastar un intento.
    expect(await banco.estado('a')).toMatchObject({ estado: 'enviando', intentos: 0 });

    discoLleno = false;
    await banco.motor.sincronizar('apertura');

    expect(await banco.estado('a')).toMatchObject({ estado: 'hecha' });
    expect(banco.servidor.creaciones()).toBe(1);
  });
});

describe('con lo que trae de fabrica', () => {
  it('funciona sin reloj, azar ni exclusion propios', async () => {
    const almacen = crearAlmacenEnMemoria(PERSONA);
    const servidor = crearServidor();
    const { ejecutores } = ejecutoresDe(servidor);
    const motor = crearMotor({
      almacen,
      ejecutores,
      personaDeLaSesion: () => PERSONA,
      confirmarConexion: () => Promise.resolve(true),
    });

    await almacen.agregarOperacion(
      nuevaOperacion(
        {
          operationId: 'a',
          tipo: 'pendiente.crear',
          entidad: 'e',
          payload: { clientOperationId: 'a', texto: 'x', nivel: 'urgente' },
        },
        new Date(),
      ),
    );

    expect((await motor.sincronizar('manual')).estado).toBe('terminada');
  });
});
