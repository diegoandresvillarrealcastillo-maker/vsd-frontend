import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearElAlmacenDeArchivo } from './almacenDeArchivo.ts';

const ANA = 'cuenta-de-ana';
const BETO = 'cuenta-de-beto';
const ANTES = '2026-10-09T15:30:00.000Z';
const DESPUES = '2026-10-10T08:00:00.000Z';

const archivo = (valor: number, tipo = 'image/jpeg'): Blob =>
  new Blob([new Uint8Array([valor])], { type: tipo });

function aplazada<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((alResolver, alRechazar) => {
    resolver = alResolver;
    rechazar = alRechazar;
  });

  return { promesa, resolver, rechazar };
}

async function esperar(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

let creadas: { url: string; blob: Blob }[];
let liberadas: string[];

beforeEach(() => {
  creadas = [];
  liberadas = [];

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:archivo-${creadas.length + 1}`;

    creadas.push({ url, blob: blob as Blob });

    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    liberadas.push(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('el almacen de un archivo de la persona (SCRUM-122)', () => {
  describe('cargando: lo que dice mientras llega', () => {
    it('empieza sin nada', () => {
      const almacen = crearElAlmacenDeArchivo({ pedir: vi.fn() });
      const { result } = renderHook(() => almacen.usarElEstado());

      expect(result.current).toEqual({ cuenta: null, marca: null, url: null, cargando: false });
    });

    it('con una marca, esta cargando hasta que llega, y despues ya no', async () => {
      const respuesta = aplazada<Blob>();
      const almacen = crearElAlmacenDeArchivo({ pedir: () => respuesta.promesa });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, ANTES);
      });

      expect(result.current.cargando).toBe(true);
      expect(result.current.url).toBeNull();

      respuesta.resolver(archivo(1));
      await esperar();

      expect(result.current).toMatchObject({
        cargando: false,
        url: 'blob:archivo-1',
        marca: ANTES,
      });
    });

    it('sin marca, no carga nada', () => {
      const pedir = vi.fn();
      const almacen = crearElAlmacenDeArchivo({ pedir });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, null);
      });

      expect(result.current.cargando).toBe(false);
      expect(pedir).not.toHaveBeenCalled();
    });

    it('si falla, deja de cargar y queda sin archivo', async () => {
      const almacen = crearElAlmacenDeArchivo({ pedir: () => Promise.reject(new Error('x')) });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, ANTES);
      });
      await esperar();

      expect(result.current).toMatchObject({ cargando: false, url: null });
    });

    it('con un archivo a mano, no carga: lo usa', () => {
      const pedir = vi.fn();
      const almacen = crearElAlmacenDeArchivo({ pedir });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, ANTES, archivo(7));
      });

      expect(result.current).toMatchObject({ cargando: false, url: 'blob:archivo-1' });
      expect(pedir).not.toHaveBeenCalled();
    });

    it('al salir, deja de cargar y la respuesta que llegue despues se descarta', async () => {
      const respuesta = aplazada<Blob>();
      const almacen = crearElAlmacenDeArchivo({ pedir: () => respuesta.promesa });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, ANTES);
        almacen.olvidar();
      });

      expect(result.current.cargando).toBe(false);

      respuesta.resolver(archivo(1));
      await esperar();

      expect(result.current.url).toBeNull();
      expect(creadas).toEqual([]);
    });
  });

  describe('mientras llega el nuevo, se sigue mostrando el anterior', () => {
    it('la direccion vieja no desaparece de golpe', async () => {
      const respuestas = [aplazada<Blob>(), aplazada<Blob>()];
      let pedido = 0;
      const almacen = crearElAlmacenDeArchivo({
        pedir: () => respuestas[pedido++]?.promesa ?? Promise.reject(new Error('de mas')),
      });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, ANTES);
      });
      respuestas[0]?.resolver(archivo(1));
      await esperar();

      expect(result.current.url).toBe('blob:archivo-1');

      act(() => {
        almacen.sincronizar(ANA, DESPUES);
      });

      // Cargando el nuevo, pero el anterior sigue ahi y no se libero.
      expect(result.current).toMatchObject({ cargando: true, url: 'blob:archivo-1', marca: ANTES });
      expect(liberadas).toEqual([]);

      respuestas[1]?.resolver(archivo(2));
      await esperar();

      expect(result.current).toMatchObject({
        cargando: false,
        url: 'blob:archivo-2',
        marca: DESPUES,
      });
      expect(liberadas).toEqual(['blob:archivo-1']);
    });

    it('la cuenta de otra persona no ve el de la anterior ni mientras llega el suyo', async () => {
      const respuesta = aplazada<Blob>();
      const almacen = crearElAlmacenDeArchivo({
        pedir: vi.fn().mockResolvedValueOnce(archivo(1)).mockReturnValueOnce(respuesta.promesa),
      });
      const { result } = renderHook(() => almacen.usarElEstado());

      act(() => {
        almacen.sincronizar(ANA, ANTES);
      });
      await esperar();
      act(() => {
        almacen.sincronizar(BETO, ANTES);
      });

      expect(result.current).toMatchObject({ cuenta: BETO, url: null, cargando: true });
      expect(liberadas).toEqual(['blob:archivo-1']);
    });
  });

  describe('el tipo del archivo', () => {
    it('si se pide un tipo y el archivo no lo trae, se le pone: un SVG sin tipo no se pinta', async () => {
      const almacen = crearElAlmacenDeArchivo({
        pedir: () => Promise.resolve(archivo(1, '')),
        tipo: 'image/svg+xml',
      });

      almacen.sincronizar(ANA, ANTES);
      await esperar();

      expect(creadas[0]?.blob.type).toBe('image/svg+xml');
    });

    it('si el archivo ya trae otro tipo, tambien se le pone el pedido', async () => {
      const almacen = crearElAlmacenDeArchivo({
        pedir: () => Promise.resolve(archivo(1, 'application/octet-stream')),
        tipo: 'image/svg+xml',
      });

      almacen.sincronizar(ANA, ANTES);
      await esperar();

      expect(creadas[0]?.blob.type).toBe('image/svg+xml');
    });

    it('con un archivo a mano, tambien', () => {
      const almacen = crearElAlmacenDeArchivo({ pedir: vi.fn(), tipo: 'image/svg+xml' });

      almacen.sincronizar(ANA, ANTES, archivo(1, 'text/plain'));

      expect(creadas[0]?.blob.type).toBe('image/svg+xml');
    });

    it('si el archivo ya trae el tipo pedido, no se copia', async () => {
      const original = archivo(1, 'image/svg+xml');
      const almacen = crearElAlmacenDeArchivo({
        pedir: () => Promise.resolve(original),
        tipo: 'image/svg+xml',
      });

      almacen.sincronizar(ANA, ANTES);
      await esperar();

      expect(creadas[0]?.blob).toBe(original);
    });

    it('sin tipo pedido, el archivo se usa como llega', async () => {
      const original = archivo(1, 'image/png');
      const almacen = crearElAlmacenDeArchivo({ pedir: () => Promise.resolve(original) });

      almacen.sincronizar(ANA, ANTES);
      await esperar();

      expect(creadas[0]?.blob).toBe(original);
    });
  });

  describe('dos almacenes no se mezclan', () => {
    it('lo de uno no sale en el otro', async () => {
      const fotos = crearElAlmacenDeArchivo({ pedir: () => Promise.resolve(archivo(1)) });
      const mascotas = crearElAlmacenDeArchivo({ pedir: () => Promise.resolve(archivo(2)) });
      const foto = renderHook(() => fotos.usarLaDireccion());
      const mascota = renderHook(() => mascotas.usarLaDireccion());

      act(() => {
        fotos.sincronizar(ANA, ANTES);
      });
      await esperar();

      expect(foto.result.current).not.toBeNull();
      expect(mascota.result.current).toBeNull();

      act(() => {
        fotos.olvidar();
      });

      expect(foto.result.current).toBeNull();
    });

    it('olvidar uno no toca al otro', async () => {
      const fotos = crearElAlmacenDeArchivo({ pedir: () => Promise.resolve(archivo(1)) });
      const mascotas = crearElAlmacenDeArchivo({ pedir: () => Promise.resolve(archivo(2)) });
      const mascota = renderHook(() => mascotas.usarLaDireccion());

      mascotas.sincronizar(ANA, ANTES);
      fotos.sincronizar(ANA, ANTES);
      await esperar();
      act(() => {
        fotos.olvidar();
      });

      expect(mascota.result.current).not.toBeNull();
    });
  });
});
