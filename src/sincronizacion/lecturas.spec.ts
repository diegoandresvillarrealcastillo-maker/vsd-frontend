import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi, type RespuestaCondicional } from '../infraestructura/api/clienteHttp.ts';
import { AlmacenLleno } from './almacenLocal.ts';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import {
  ESPERA_CON_COPIA_EN_MS,
  leerConCopia,
  leerSoloLaCopia,
  leerSoloLaCopiaConFecha,
  modificarLaCopia,
} from './lecturas.ts';

const NO_RECORDADA = { persistente: false };
const CLAVE = 'catalogo';

const nuevo = <T>(valor: T, etag: string | null = 'W/"1"'): RespuestaCondicional<T> => ({
  estado: 'nuevo',
  valor,
  etag,
});
const SIN_CAMBIOS: RespuestaCondicional<string> = { estado: 'sin_cambios' };

const api = (estado: number, codigo?: string) =>
  new ErrorDeLaApi(estado, 'mensaje', undefined, codigo);

beforeEach(async () => {
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', NO_RECORDADA);
});

afterEach(() => {
  reiniciarElCicloParaLasPruebas();
});

describe('leerConCopia: con conexion (SCRUM-138)', () => {
  it('sin copia, lee de la API, la devuelve como actual y la guarda con su ETag', async () => {
    const traer = vi.fn(() => Promise.resolve(nuevo('lo de la API', 'W/"a"')));

    const lectura = await leerConCopia(CLAVE, traer);

    expect(lectura).toEqual({ valor: 'lo de la API', deLaCopia: false, guardadoEn: null });
    expect(traer).toHaveBeenCalledWith(null);
    expect(await leerSoloLaCopia(CLAVE)).toBe('lo de la API');
  });

  it('con copia, le manda a la API el ETag que guardo', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('v1', 'W/"a"')));

    const traer = vi.fn(() => Promise.resolve(nuevo('v2', 'W/"b"')));

    await leerConCopia(CLAVE, traer);

    expect(traer).toHaveBeenCalledWith('W/"a"');
  });

  it('si no cambio (304), devuelve la copia, y es actual: se pregunto y sigue valiendo', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('v1')));

    const lectura = await leerConCopia(CLAVE, () => Promise.resolve(SIN_CAMBIOS));

    expect(lectura.valor).toBe('v1');
    expect(lectura.deLaCopia).toBe(false);
    expect(lectura.guardadoEn).not.toBeNull();
  });

  it('si cambio, reemplaza la copia y su ETag', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('v1', 'W/"a"')));
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('v2', 'W/"b"')));

    const traer = vi.fn(() => Promise.resolve(SIN_CAMBIOS));
    const lectura = await leerConCopia(CLAVE, traer);

    expect(lectura.valor).toBe('v2');
    expect(traer).toHaveBeenCalledWith('W/"b"');
  });

  it('una respuesta sin ETag se guarda igual, y la proxima vez se pregunta sin el', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('v1', null)));

    const traer = vi.fn(() => Promise.resolve(nuevo('v1', null)));

    await leerConCopia(CLAVE, traer);

    expect(traer).toHaveBeenCalledWith(null);
  });

  it('un "no cambio" de algo de lo que no hay copia no se inventa un valor', async () => {
    await expect(leerConCopia(CLAVE, () => Promise.resolve(SIN_CAMBIOS))).rejects.toThrow(
      /no hay copia/,
    );
  });
});

describe('leerConCopia: sin conexion', () => {
  beforeEach(async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('la copia', 'W/"a"')));
  });

  it('si no hay red, devuelve la copia y dice que lo es, con cuando se guardo', async () => {
    const lectura = await leerConCopia(CLAVE, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );

    expect(lectura.valor).toBe('la copia');
    expect(lectura.deLaCopia).toBe(true);
    expect(lectura.guardadoEn).not.toBeNull();
  });

  it.each([408, 425, 429, 500, 502, 503, 504])(
    'si el servidor no responde bien (%i), tambien: no se pudo llegar a el',
    async (estado) => {
      const lectura = await leerConCopia(CLAVE, () => Promise.reject(api(estado)));

      expect(lectura.deLaCopia).toBe(true);
    },
  );

  it('una respuesta que no es JSON (el portal de una red wifi) cuenta como no tener red', async () => {
    const lectura = await leerConCopia(CLAVE, () =>
      Promise.reject(new SyntaxError('Unexpected token <')),
    );

    expect(lectura.deLaCopia).toBe(true);
  });

  it.each([400, 401, 403, 404, 409])(
    'si el servidor dijo que no (%i), el error sale: la copia no tapa una respuesta',
    async (estado) => {
      await expect(leerConCopia(CLAVE, () => Promise.reject(api(estado)))).rejects.toMatchObject({
        estado,
      });
    },
  );

  it('un error que no se conoce tampoco se tapa con la copia... es pasajero y se usa la copia', async () => {
    const lectura = await leerConCopia(CLAVE, () => Promise.reject(new Error('algo raro')));

    expect(lectura.deLaCopia).toBe(true);
  });

  it('si se cancelo la lectura, el error sale aunque haya copia: nadie la espera', async () => {
    const control = new AbortController();

    control.abort();

    await expect(
      leerConCopia(
        CLAVE,
        () => Promise.reject(new DOMException('cancelada', 'AbortError')),
        control.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('si la senal esta cancelada, el error sale aunque no sea un aborto: nadie espera la lectura', async () => {
    const control = new AbortController();

    control.abort();

    await expect(
      leerConCopia(CLAVE, () => Promise.reject(new TypeError('Failed to fetch')), control.signal),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('una cancelacion se reconoce por el error aunque no se haya pasado la senal', async () => {
    await expect(
      leerConCopia(CLAVE, () => Promise.reject(new DOMException('cancelada', 'AbortError'))),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('leerConCopia: con una red lenta, la copia no hace esperar (SCRUM-138)', () => {
  beforeEach(async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('la copia', 'W/"a"')));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Una API que tarda: la respuesta llega cuando la prueba lo diga. */
  function apiLenta<T>() {
    let responder: (respuesta: RespuestaCondicional<T>) => void = () => undefined;
    let fallar: (error: unknown) => void = () => undefined;
    const respuesta = new Promise<RespuestaCondicional<T>>((resolve, reject) => {
      responder = resolve;
      fallar = reject;
    });

    return { traer: vi.fn(() => respuesta), responder, fallar };
  }

  it('el limite es de 2,5 segundos', () => {
    expect(ESPERA_CON_COPIA_EN_MS).toBe(2500);
  });

  it('pasado el tiempo usa la copia, sin esperar a la API, y dice que lo es', async () => {
    vi.useFakeTimers();

    const api = apiLenta<string>();
    let termino = false;
    const lectura = leerConCopia(CLAVE, api.traer).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(ESPERA_CON_COPIA_EN_MS - 1);

    expect(termino).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    const usada = await lectura;

    expect(usada).toMatchObject({ valor: 'la copia', deLaCopia: true });
    // Dice desde cuando es la copia, para que la pantalla pueda decir "de hace un rato".
    expect(usada.guardadoEn).not.toBeNull();
  });

  it('antes de que pase el tiempo, espera a la API y devuelve lo nuevo', async () => {
    vi.useFakeTimers();

    const api = apiLenta<string>();
    const lectura = leerConCopia(CLAVE, api.traer);

    await vi.advanceTimersByTimeAsync(1000);
    api.responder(nuevo('lo nuevo', 'W/"b"'));

    expect(await lectura).toEqual({ valor: 'lo nuevo', deLaCopia: false, guardadoEn: null });
  });

  it('lo que llega despues renueva la copia para la proxima vez', async () => {
    vi.useFakeTimers();

    const api = apiLenta<string>();
    const lectura = leerConCopia(CLAVE, api.traer);

    await vi.advanceTimersByTimeAsync(ESPERA_CON_COPIA_EN_MS);
    await lectura;
    api.responder(nuevo('renovada', 'W/"b"'));
    await vi.advanceTimersByTimeAsync(0);

    expect(await leerSoloLaCopia(CLAVE)).toBe('renovada');

    const traer = vi.fn(() => Promise.resolve(SIN_CAMBIOS));

    await leerConCopia(CLAVE, traer);

    expect(traer).toHaveBeenCalledWith('W/"b"');
  });

  it('un "no cambio" tardio no toca la copia', async () => {
    vi.useFakeTimers();

    const api = apiLenta<string>();
    const lectura = leerConCopia(CLAVE, api.traer);

    await vi.advanceTimersByTimeAsync(ESPERA_CON_COPIA_EN_MS);
    await lectura;
    api.responder(SIN_CAMBIOS);
    await vi.advanceTimersByTimeAsync(0);

    expect(await leerSoloLaCopia(CLAVE)).toBe('la copia');
  });

  it('un fallo tardio se ignora: la copia ya se uso y no hay a quien avisar', async () => {
    vi.useFakeTimers();

    const api = apiLenta<string>();
    const lectura = leerConCopia(CLAVE, api.traer);

    await vi.advanceTimersByTimeAsync(ESPERA_CON_COPIA_EN_MS);
    await lectura;
    api.fallar(new TypeError('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(0);

    expect(await leerSoloLaCopia(CLAVE)).toBe('la copia');
  });

  it('con la API que responde rapido, no queda ningun temporizador', async () => {
    vi.useFakeTimers();

    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('rapida', 'W/"b"')));

    expect(vi.getTimerCount()).toBe(0);
  });

  it('sin copia no hay limite: espera todo lo que haga falta, porque no hay otra cosa', async () => {
    vi.useFakeTimers();
    reiniciarElCicloParaLasPruebas();
    await alCambiarLaSesion('beto', NO_RECORDADA);

    const api = apiLenta<string>();
    let termino = false;
    const lectura = leerConCopia(CLAVE, api.traer).then((valor) => {
      termino = true;

      return valor;
    });

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(termino).toBe(false);

    api.responder(nuevo('al fin'));

    expect(await lectura).toMatchObject({ valor: 'al fin', deLaCopia: false });
  });
});

describe('leerConCopia: sin copia', () => {
  it('sin red, el error sale: nunca se inventa un valor', async () => {
    await expect(
      leerConCopia(CLAVE, () => Promise.reject(new TypeError('Failed to fetch'))),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('con un error de la API, sale tal cual', async () => {
    await expect(
      leerConCopia(CLAVE, () => Promise.reject(api(404, 'NO_ENCONTRADO'))),
    ).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

describe('leerConCopia: cuando el almacen no ayuda', () => {
  it('sin almacen abierto, lee de la API y no guarda nada', async () => {
    reiniciarElCicloParaLasPruebas();

    const lectura = await leerConCopia(CLAVE, () => Promise.resolve(nuevo('de la API')));

    expect(lectura.valor).toBe('de la API');
    expect(await leerSoloLaCopia(CLAVE)).toBeNull();
  });

  it('sin almacen y sin red, el error sale', async () => {
    reiniciarElCicloParaLasPruebas();

    await expect(
      leerConCopia(CLAVE, () => Promise.reject(new TypeError('Failed to fetch'))),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('si no hay espacio para guardar la copia, lo leido no se pierde', async () => {
    vi.spyOn(cicloActual()?.almacen ?? ({} as never), 'guardarLectura').mockRejectedValue(
      new AlmacenLleno(),
    );

    const lectura = await leerConCopia(CLAVE, () => Promise.resolve(nuevo('de la API')));

    expect(lectura.valor).toBe('de la API');
  });

  it('si no se puede leer la copia, es como no tenerla', async () => {
    vi.spyOn(cicloActual()?.almacen ?? ({} as never), 'leerLectura').mockRejectedValue(
      new Error('no se pudo descifrar'),
    );
    const traer = vi.fn(() => Promise.resolve(nuevo('de la API')));

    const lectura = await leerConCopia(CLAVE, traer);

    expect(traer).toHaveBeenCalledWith(null);
    expect(lectura.valor).toBe('de la API');
  });

  it.each([
    ['un texto', 'no soy una copia'],
    ['nulo', null],
    ['un objeto sin valor', { etag: 'x' }],
  ])('una copia con otra forma (%s) es como no tenerla', async (_nombre, forma) => {
    await cicloActual()?.almacen.guardarLectura(CLAVE, forma, new Date());

    const traer = vi.fn(() => Promise.resolve(nuevo('de la API')));

    await leerConCopia(CLAVE, traer);

    expect(traer).toHaveBeenCalledWith(null);
  });

  it('cada persona tiene su copia: la de una no la ve otra', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('de Ana')));
    await alCambiarLaSesion('beto', NO_RECORDADA);

    expect(await leerSoloLaCopia(CLAVE)).toBeNull();
  });
});

describe('leerSoloLaCopia', () => {
  it('devuelve lo guardado, sin preguntar a nadie', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo({ a: 1 })));

    expect(await leerSoloLaCopia(CLAVE)).toEqual({ a: 1 });
  });

  it('lo que no se guardo, nulo', async () => {
    expect(await leerSoloLaCopia('otra-clave')).toBeNull();
  });

  it('un valor guardado que es falso o cero se devuelve tal cual', async () => {
    await leerConCopia('cero', () => Promise.resolve(nuevo(0)));

    expect(await leerSoloLaCopia('cero')).toBe(0);
  });
});

describe('leerSoloLaCopiaConFecha (SCRUM-142)', () => {
  it('devuelve lo guardado y cuando se guardo, sin preguntar a nadie', async () => {
    const antes = Date.now();

    await leerConCopia(CLAVE, () => Promise.resolve(nuevo({ a: 1 })));

    const guardada = await leerSoloLaCopiaConFecha<{ a: number }>(CLAVE);

    expect(guardada?.valor).toEqual({ a: 1 });
    expect(Date.parse(guardada?.guardadoEn ?? '')).toBeGreaterThanOrEqual(antes);
    expect(Date.parse(guardada?.guardadoEn ?? '')).toBeLessThanOrEqual(Date.now());
  });

  it('lo que no se guardo, nulo', async () => {
    expect(await leerSoloLaCopiaConFecha('otra-clave')).toBeNull();
  });

  it('un valor falso o cero se devuelve tal cual, no como si no hubiera nada', async () => {
    await leerConCopia('cero', () => Promise.resolve(nuevo(0)));

    expect((await leerSoloLaCopiaConFecha<number>('cero'))?.valor).toBe(0);
  });

  it('sin almacen abierto, nulo', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await leerSoloLaCopiaConFecha(CLAVE)).toBeNull();
  });

  it('dice lo mismo que dice la lectura sin red', async () => {
    await leerConCopia(CLAVE, () => Promise.resolve(nuevo('la copia')));

    const sinRed = await leerConCopia(CLAVE, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    const guardada = await leerSoloLaCopiaConFecha<string>(CLAVE);

    expect(guardada).toEqual({ valor: sinRed.valor, guardadoEn: sinRed.guardadoEn });
  });
});

describe('modificarLaCopia (SCRUM-139)', () => {
  it('sin nada guardado, recibe nulo y lo que devuelve queda guardado', async () => {
    const cambiar = vi.fn((actual: string[] | null) => [...(actual ?? []), 'uno']);

    await modificarLaCopia('lista', cambiar);

    expect(cambiar).toHaveBeenCalledWith(null);
    expect(await leerSoloLaCopia('lista')).toEqual(['uno']);
  });

  it('con algo guardado, recibe lo que hay y guarda lo nuevo encima', async () => {
    await modificarLaCopia('lista', () => ['uno']);
    await modificarLaCopia<string[]>('lista', (actual) => [...(actual ?? []), 'dos']);

    expect(await leerSoloLaCopia('lista')).toEqual(['uno', 'dos']);
  });

  it('si devuelve nulo, no toca lo guardado ni guarda nada', async () => {
    await modificarLaCopia('lista', () => ['uno']);
    await modificarLaCopia('lista', () => null);
    await modificarLaCopia('otra', () => null);

    expect(await leerSoloLaCopia('lista')).toEqual(['uno']);
    expect(await leerSoloLaCopia('otra')).toBeNull();
  });

  it('conserva el ETag de lo que se leyo de la API', async () => {
    await leerConCopia('con-etag', () => Promise.resolve(nuevo(['uno'], 'W/"a"')));
    await modificarLaCopia<string[]>('con-etag', (actual) => [...(actual ?? []), 'dos']);

    const traer = vi.fn(() => Promise.resolve(nuevo(['tres'], 'W/"b"')));

    await leerConCopia('con-etag', traer);

    expect(traer).toHaveBeenCalledWith('W/"a"');
  });

  it('sin almacen abierto no hace nada y no falla', async () => {
    reiniciarElCicloParaLasPruebas();

    await expect(modificarLaCopia('lista', () => ['uno'])).resolves.toBeUndefined();
  });

  it('si no hay espacio para guardar, no falla: lo que se sabe se sigue sabiendo', async () => {
    vi.spyOn(cicloActual()!.almacen, 'guardarLectura').mockRejectedValue(new AlmacenLleno());

    await expect(modificarLaCopia('lista', () => ['uno'])).resolves.toBeUndefined();
  });
});
