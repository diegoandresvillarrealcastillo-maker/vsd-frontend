import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoriaDelCatalogo } from '../infraestructura/api/catalogo.ts';
import { leerSiCambio } from '../infraestructura/api/clienteHttp.ts';
import {
  CLAVE_DEL_CATALOGO,
  buscarActividadConCopia,
  nombreDeLaActividad,
  traerElCatalogoConCopia,
} from './catalogoLocal.ts';
import { alCambiarLaSesion, cicloActual, reiniciarElCicloParaLasPruebas } from './ciclo.ts';
import { ESPERA_CON_COPIA_EN_MS } from './lecturas.ts';

// El resto del cliente (el tipo de error que reconoce `clasificarFallo`) es el de verdad.
vi.mock('../infraestructura/api/clienteHttp.ts', async (original) => ({
  ...(await original<typeof import('../infraestructura/api/clienteHttp.ts')>()),
  leerSiCambio: vi.fn(),
}));

const CATALOGO: readonly CategoriaDelCatalogo[] = [
  {
    id: 'c1',
    nombre: 'Bienestar',
    actividades: [
      { id: 'a1', nombre: 'Como dormiste anoche', produceNivel: true },
      { id: 'a2', nombre: 'Un momento bueno', produceNivel: false },
    ],
  },
  {
    id: 'c2',
    nombre: 'Cognicion',
    actividades: [{ id: 'a3', nombre: 'Parejas de cartas', produceNivel: true }],
  },
];

const leer = vi.mocked(leerSiCambio);
const SIN_RED = new TypeError('Failed to fetch');

beforeEach(async () => {
  leer.mockReset();
  reiniciarElCicloParaLasPruebas();
  await alCambiarLaSesion('ana', { persistente: false });
});

afterEach(() => {
  reiniciarElCicloParaLasPruebas();
});

describe('traerElCatalogoConCopia (SCRUM-138)', () => {
  it('la copia se guarda bajo la clave "catalogo", que no se comparte con otra lectura', () => {
    expect(CLAVE_DEL_CATALOGO).toBe('catalogo');
  });

  it('pide el catalogo a la API, con la ruta de siempre', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: 'W/"1"' });

    const lectura = await traerElCatalogoConCopia();

    expect(lectura.valor).toEqual(CATALOGO);
    expect(leer).toHaveBeenCalledWith('/api/catalogo', { etag: null });
  });

  it('la segunda vez manda el ETag de la copia, y si no cambio usa la copia', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: CATALOGO, etag: 'W/"1"' });
    await traerElCatalogoConCopia();
    leer.mockResolvedValueOnce({ estado: 'sin_cambios' });

    const lectura = await traerElCatalogoConCopia();

    expect(leer).toHaveBeenLastCalledWith('/api/catalogo', { etag: 'W/"1"' });
    expect(lectura.valor).toEqual(CATALOGO);
    expect(lectura.deLaCopia).toBe(false);
  });

  it('sin conexion, usa la copia', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: CATALOGO, etag: 'W/"1"' });
    await traerElCatalogoConCopia();
    leer.mockRejectedValueOnce(SIN_RED);

    const lectura = await traerElCatalogoConCopia();

    expect(lectura.valor).toEqual(CATALOGO);
    expect(lectura.deLaCopia).toBe(true);
  });

  it('pasa la senal de cancelacion a la lectura', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: null });

    const control = new AbortController();

    await traerElCatalogoConCopia(control.signal);

    expect(leer).toHaveBeenCalledWith('/api/catalogo', { etag: null, senal: control.signal });
  });

  it('la copia se guarda bajo la clave del catalogo', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: null });
    await traerElCatalogoConCopia();

    expect(await cicloActual()?.almacen.leerLectura(CLAVE_DEL_CATALOGO)).not.toBeNull();
  });
});

describe('buscarActividadConCopia', () => {
  it('encuentra la actividad con su categoria', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: null });

    const ficha = await buscarActividadConCopia('a3');

    expect(ficha?.actividad.nombre).toBe('Parejas de cartas');
    expect(ficha?.categoria.nombre).toBe('Cognicion');
  });

  it('una que no existe es nulo, no un fallo', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: null });

    expect(await buscarActividadConCopia('no-existe')).toBeNull();
  });

  it('SIN CONEXION se abre desde la copia: eso es lo que hace falta', async () => {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: CATALOGO, etag: null });
    await traerElCatalogoConCopia();
    leer.mockRejectedValueOnce(SIN_RED);

    const ficha = await buscarActividadConCopia('a1');

    expect(ficha?.actividad.nombre).toBe('Como dormiste anoche');
  });

  it('sin conexion y sin copia, el fallo sale: hace falta conexion la primera vez', async () => {
    leer.mockRejectedValue(SIN_RED);

    await expect(buscarActividadConCopia('a1')).rejects.toBe(SIN_RED);
  });
});

describe('buscarActividadConCopia con una copia vieja (SCRUM-232)', () => {
  // El catalogo de despues de publicar algo: la copia guardada es la de antes.
  const CATALOGO_NUEVO: readonly CategoriaDelCatalogo[] = [
    CATALOGO[0]!,
    {
      id: 'c2',
      nombre: 'Cognicion',
      actividades: [
        ...CATALOGO[1]!.actividades,
        { id: 'a9', nombre: 'La palabra que sobra', produceNivel: true },
      ],
    },
  ];

  async function guardarLaCopiaVieja(): Promise<void> {
    leer.mockResolvedValueOnce({ estado: 'nuevo', valor: CATALOGO, etag: 'W/"1"' });
    await traerElCatalogoConCopia();
    leer.mockReset();
  }

  /** Una API que tarda en contestar: mas que lo que `leerConCopia` espera con una copia. */
  function unaApiLenta(contestacion: Awaited<ReturnType<typeof leerSiCambio>>, ms: number): void {
    leer.mockImplementation(
      () =>
        new Promise((resolver) => {
          setTimeout(() => {
            resolver(contestacion);
          }, ms);
        }),
    );
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('una actividad que la copia no tiene NO es "no existe": espera a la API aunque tarde', async () => {
    await guardarLaCopiaVieja();
    vi.useFakeTimers();
    unaApiLenta(
      { estado: 'nuevo', valor: CATALOGO_NUEVO, etag: 'W/"2"' },
      ESPERA_CON_COPIA_EN_MS + 1500,
    );

    const busqueda = buscarActividadConCopia('a9');

    await vi.advanceTimersByTimeAsync(3 * ESPERA_CON_COPIA_EN_MS);

    expect((await busqueda)?.actividad.nombre).toBe('La palabra que sobra');
  });

  it('lo que trae la API se guarda: la proxima vez la copia ya la tiene', async () => {
    await guardarLaCopiaVieja();
    vi.useFakeTimers();
    unaApiLenta(
      { estado: 'nuevo', valor: CATALOGO_NUEVO, etag: 'W/"2"' },
      ESPERA_CON_COPIA_EN_MS + 1500,
    );

    const busqueda = buscarActividadConCopia('a9');

    await vi.advanceTimersByTimeAsync(3 * ESPERA_CON_COPIA_EN_MS);
    await busqueda;

    expect(await nombreDeLaActividad('a9')).toBe('La palabra que sobra');
  });

  it('sin conexion y sin la actividad en la copia, sale el fallo: no se dice "no existe"', async () => {
    await guardarLaCopiaVieja();
    leer.mockRejectedValue(SIN_RED);

    await expect(buscarActividadConCopia('a9')).rejects.toBe(SIN_RED);
  });

  it('si la API confirma que no cambio y no la tiene, no existe, sin insistir', async () => {
    await guardarLaCopiaVieja();
    leer.mockResolvedValue({ estado: 'sin_cambios' });

    expect(await buscarActividadConCopia('a9')).toBeNull();
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it('una que SI esta en la copia abre sin esperar a la API y sin preguntar dos veces', async () => {
    await guardarLaCopiaVieja();
    vi.useFakeTimers();
    unaApiLenta({ estado: 'sin_cambios' }, 60_000);

    const busqueda = buscarActividadConCopia('a1');

    await vi.advanceTimersByTimeAsync(ESPERA_CON_COPIA_EN_MS + 1);

    expect((await busqueda)?.actividad.nombre).toBe('Como dormiste anoche');
    expect(leer).toHaveBeenCalledTimes(1);
  });
});

describe('nombreDeLaActividad: solo de la copia', () => {
  it('dice como se llama, sin preguntar a la API', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: null });
    await traerElCatalogoConCopia();
    leer.mockClear();

    expect(await nombreDeLaActividad('a2')).toBe('Un momento bueno');
    expect(leer).not.toHaveBeenCalled();
  });

  it('una actividad que no esta en la copia, nulo', async () => {
    leer.mockResolvedValue({ estado: 'nuevo', valor: CATALOGO, etag: null });
    await traerElCatalogoConCopia();

    expect(await nombreDeLaActividad('no-existe')).toBeNull();
  });

  it('sin copia, nulo', async () => {
    expect(await nombreDeLaActividad('a1')).toBeNull();
  });

  it('una copia con otra forma no rompe: nulo', async () => {
    await cicloActual()?.almacen.guardarLectura(
      CLAVE_DEL_CATALOGO,
      { valor: [{ id: 'c1' }], etag: null },
      new Date(),
    );

    expect(await nombreDeLaActividad('a1')).toBeNull();
  });

  it('sin almacen abierto, nulo', async () => {
    reiniciarElCicloParaLasPruebas();

    expect(await nombreDeLaActividad('a1')).toBeNull();
  });
});
