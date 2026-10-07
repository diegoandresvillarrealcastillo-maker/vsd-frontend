import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cajaDelRecorte,
  CALIDADES_DE_LA_FOTO,
  comprimirHastaQueCaiga,
  esUnaFotoPermitida,
  FotoRechazada,
  LADOS_DE_LA_FOTO,
  PESO_MAXIMO_DE_LA_FOTO,
  PESO_MAXIMO_DEL_ORIGINAL,
  PESO_OBJETIVO_DE_LA_FOTO,
  prepararLaFoto,
} from './prepararLaFoto.ts';

/** Un blob del peso que se pida. */
const blobDe = (bytes: number): Blob => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

/** El motivo con el que falla, o `undefined` si sale bien. */
async function motivoDe(accion: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await accion();

    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(FotoRechazada);

    return (error as FotoRechazada).motivo;
  }
}

describe('los limites', () => {
  it('apuntan por debajo de lo que acepta la API, para no quedar a un byte', () => {
    expect(PESO_MAXIMO_DE_LA_FOTO).toBe(51_200);
    expect(PESO_OBJETIVO_DE_LA_FOTO).toBeLessThan(PESO_MAXIMO_DE_LA_FOTO);
  });

  it('se prueban primero los lados y las calidades mayores', () => {
    expect(LADOS_DE_LA_FOTO).toEqual([256, 192, 128]);
    expect([...CALIDADES_DE_LA_FOTO].sort((a, b) => b - a)).toEqual(CALIDADES_DE_LA_FOTO);
  });
});

describe('esUnaFotoPermitida', () => {
  it.each([
    ['image/jpeg', 'foto.jpg'],
    ['image/png', 'foto.png'],
    ['IMAGE/JPEG', 'foto.JPG'],
  ])('%s se acepta', (type, name) => {
    expect(esUnaFotoPermitida({ type, name })).toBe(true);
  });

  it.each([['foto.jpg'], ['foto.JPEG'], ['foto.png'], ['mi.foto.de.verano.PNG']])(
    'sin tipo, se mira la extension: %s',
    (name) => {
      expect(esUnaFotoPermitida({ type: '', name })).toBe(true);
      expect(esUnaFotoPermitida({ type: 'application/octet-stream', name })).toBe(true);
    },
  );

  it.each([
    ['image/gif', 'foto.gif'],
    ['image/webp', 'foto.webp'],
    ['image/svg+xml', 'foto.svg'],
    ['image/heic', 'foto.heic'],
    ['application/pdf', 'foto.pdf'],
    ['text/html', 'foto.html'],
    // Lo que dice el navegador pesa mas que el nombre.
    ['image/gif', 'foto.png'],
    ['', 'foto.gif'],
    ['', 'foto'],
    ['', 'foto.png.exe'],
  ])('%s (%s) no se acepta', (type, name) => {
    expect(esUnaFotoPermitida({ type, name })).toBe(false);
  });
});

describe('cajaDelRecorte', () => {
  it('una foto horizontal pierde los lados', () => {
    expect(cajaDelRecorte(400, 300)).toEqual({ x: 50, y: 0, lado: 300 });
  });

  it('una foto vertical pierde arriba y abajo', () => {
    expect(cajaDelRecorte(300, 400)).toEqual({ x: 0, y: 50, lado: 300 });
  });

  it('una foto cuadrada no pierde nada', () => {
    expect(cajaDelRecorte(300, 300)).toEqual({ x: 0, y: 0, lado: 300 });
  });

  it('con una diferencia impar, el sobrante se redondea hacia abajo', () => {
    expect(cajaDelRecorte(301, 300)).toEqual({ x: 0, y: 0, lado: 300 });
    expect(cajaDelRecorte(305, 300)).toEqual({ x: 2, y: 0, lado: 300 });
  });
});

describe('comprimirHastaQueCaiga', () => {
  it('devuelve la primera que cabe, sin seguir probando', async () => {
    const intentos: [number, number][] = [];
    const buena = blobDe(1000);

    const resultado = await comprimirHastaQueCaiga((lado, calidad) => {
      intentos.push([lado, calidad]);

      return Promise.resolve(buena);
    }, 256);

    expect(resultado).toBe(buena);
    expect(intentos).toEqual([[256, 0.9]]);
  });

  it('si no cabe, baja la calidad antes que el tamano', async () => {
    const intentos: [number, number][] = [];

    await comprimirHastaQueCaiga((lado, calidad) => {
      intentos.push([lado, calidad]);

      return Promise.resolve(blobDe(calidad > 0.7 ? 80_000 : 20_000));
    }, 256);

    expect(intentos).toEqual([
      [256, 0.9],
      [256, 0.8],
      [256, 0.7],
    ]);
  });

  it('si ni con la peor calidad cabe, achica el lado', async () => {
    const intentos: [number, number][] = [];

    await comprimirHastaQueCaiga((lado, calidad) => {
      intentos.push([lado, calidad]);

      return Promise.resolve(blobDe(lado === 256 ? 80_000 : 20_000));
    }, 256);

    expect(intentos.slice(0, CALIDADES_DE_LA_FOTO.length).every(([lado]) => lado === 256)).toBe(
      true,
    );
    expect(intentos[CALIDADES_DE_LA_FOTO.length]).toEqual([192, CALIDADES_DE_LA_FOTO[0]]);
  });

  it('lo que devuelve es lo ya codificado: no se vuelve a codificar', async () => {
    const elegida = blobDe(30_000);
    let llamadas = 0;

    const resultado = await comprimirHastaQueCaiga(() => {
      llamadas += 1;

      return Promise.resolve(llamadas === 2 ? elegida : blobDe(80_000));
    }, 256);

    expect(resultado).toBe(elegida);
    expect(llamadas).toBe(2);
  });

  it('justo en el objetivo cabe, y un byte de mas no', async () => {
    expect(
      await comprimirHastaQueCaiga(() => Promise.resolve(blobDe(PESO_OBJETIVO_DE_LA_FOTO)), 256),
    ).toHaveProperty('size', PESO_OBJETIVO_DE_LA_FOTO);

    const intentos: number[] = [];

    await comprimirHastaQueCaiga((_lado, calidad) => {
      intentos.push(calidad);

      return Promise.resolve(blobDe(PESO_OBJETIVO_DE_LA_FOTO + (calidad === 0.9 ? 1 : 0)));
    }, 256);

    expect(intentos).toEqual([0.9, 0.8]);
  });

  it('si nada cabe, lo dice con su motivo', async () => {
    expect(
      await motivoDe(() => comprimirHastaQueCaiga(() => Promise.resolve(blobDe(900_000)), 256)),
    ).toBe('no-cabe');
  });

  it('prueba todas las combinaciones antes de rendirse', async () => {
    let llamadas = 0;

    await motivoDe(() =>
      comprimirHastaQueCaiga(() => {
        llamadas += 1;

        return Promise.resolve(blobDe(900_000));
      }, 256),
    );

    expect(llamadas).toBe(LADOS_DE_LA_FOTO.length * CALIDADES_DE_LA_FOTO.length);
  });

  it('si el navegador no pudo codificar, es que no se pudo leer', async () => {
    expect(await motivoDe(() => comprimirHastaQueCaiga(() => Promise.resolve(null), 256))).toBe(
      'ilegible',
    );
  });

  it('una imagen que ya es chica no se agranda ni se prueba con lados mayores', async () => {
    const lados: number[] = [];

    await motivoDe(() =>
      comprimirHastaQueCaiga((lado) => {
        lados.push(lado);

        return Promise.resolve(blobDe(900_000));
      }, 150),
    );

    expect(new Set(lados)).toEqual(new Set([150, 128]));
  });

  it('una imagen mas chica que todos los lados se prueba solo con el suyo', async () => {
    const lados: number[] = [];

    await motivoDe(() =>
      comprimirHastaQueCaiga((lado) => {
        lados.push(lado);

        return Promise.resolve(blobDe(900_000));
      }, 100),
    );

    expect(new Set(lados)).toEqual(new Set([100]));
  });
});

describe('prepararLaFoto', () => {
  /** Lo que el lienzo de mentira anota de cada dibujo. */
  const dibujos: {
    ancho: number;
    alto: number;
    relleno: string;
    llamadas: unknown[][];
    calidad: number;
  }[] = [];
  const cerrar = vi.fn();
  let pesoSegunCalidad: (calidad: number, lado: number) => number;

  function archivo(nombre = 'foto.png', tipo = 'image/png', bytes = 1000): File {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo });
  }

  function imagenDe(ancho: number, alto: number): void {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: ancho, height: alto, close: cerrar }),
    );
  }

  beforeEach(() => {
    dibujos.length = 0;
    cerrar.mockClear();
    pesoSegunCalidad = () => 10_000;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      const dibujo: (typeof dibujos)[number] = {
        ancho: this.width,
        alto: this.height,
        relleno: '',
        llamadas: [],
        calidad: 0,
      };

      dibujos.push(dibujo);

      return {
        set fillStyle(valor: string) {
          dibujo.relleno = valor;
        },
        set imageSmoothingQuality(_valor: string) {
          // No importa para la prueba.
        },
        fillRect: (...argumentos: unknown[]) => dibujo.llamadas.push(['fillRect', ...argumentos]),
        drawImage: (...argumentos: unknown[]) => dibujo.llamadas.push(['drawImage', ...argumentos]),
      } as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      resolver: BlobCallback,
      tipo?: string,
      calidad?: unknown,
    ) {
      const actual = dibujos[dibujos.length - 1];

      if (actual) {
        actual.calidad = Number(calidad);
      }

      resolver(
        new Blob([new Uint8Array(pesoSegunCalidad(Number(calidad), this.width))], {
          type: tipo ?? '',
        }),
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('lo que se rechaza sin abrir el archivo', () => {
    it.each([
      ['un GIF', archivo('foto.gif', 'image/gif')],
      ['un SVG', archivo('foto.svg', 'image/svg+xml')],
      ['un PDF', archivo('foto.pdf', 'application/pdf')],
    ])('%s se rechaza por su tipo', async (_cual, elegido) => {
      imagenDe(400, 300);

      expect(await motivoDe(() => prepararLaFoto(elegido))).toBe('tipo');
      expect(createImageBitmap).not.toHaveBeenCalled();
    });

    it('un archivo de mas de 10 MB se rechaza sin abrirlo', async () => {
      imagenDe(400, 300);

      const enorme = archivo('foto.jpg', 'image/jpeg', PESO_MAXIMO_DEL_ORIGINAL + 1);

      expect(await motivoDe(() => prepararLaFoto(enorme))).toBe('pesado');
      expect(createImageBitmap).not.toHaveBeenCalled();
    });

    it('justo en 10 MB se abre', async () => {
      imagenDe(400, 300);

      await prepararLaFoto(archivo('foto.jpg', 'image/jpeg', PESO_MAXIMO_DEL_ORIGINAL));

      expect(createImageBitmap).toHaveBeenCalledOnce();
    });
  });

  describe('lo que sale', () => {
    it('es un JPEG de 256 px, recortado del centro', async () => {
      imagenDe(400, 300);

      const foto = await prepararLaFoto(archivo());

      expect(foto.type).toBe('image/jpeg');
      expect(dibujos).toHaveLength(1);
      expect(dibujos[0]?.ancho).toBe(256);
      expect(dibujos[0]?.alto).toBe(256);
      // El cuadrado de en medio (300 x 300, desde x = 50), pintado en 256 x 256.
      expect(dibujos[0]?.llamadas).toContainEqual([
        'drawImage',
        expect.anything(),
        50,
        0,
        300,
        300,
        0,
        0,
        256,
        256,
      ]);
    });

    it('pinta antes un fondo blanco: lo transparente de un PNG no queda negro', async () => {
      imagenDe(400, 300);

      await prepararLaFoto(archivo());

      expect(dibujos[0]?.relleno).toBe('#ffffff');
      expect(dibujos[0]?.llamadas[0]).toEqual(['fillRect', 0, 0, 256, 256]);
      expect(dibujos[0]?.llamadas[1]?.[0]).toBe('drawImage');
    });

    it('una foto vertical se recorta arriba y abajo', async () => {
      imagenDe(300, 500);

      await prepararLaFoto(archivo());

      expect(dibujos[0]?.llamadas).toContainEqual([
        'drawImage',
        expect.anything(),
        0,
        100,
        300,
        300,
        0,
        0,
        256,
        256,
      ]);
    });

    it('una imagen mas chica que 256 px no se agranda', async () => {
      imagenDe(100, 80);

      await prepararLaFoto(archivo());

      expect(dibujos[0]?.ancho).toBe(80);
      expect(dibujos[0]?.alto).toBe(80);
    });

    it('empieza por la mejor calidad', async () => {
      imagenDe(400, 300);

      await prepararLaFoto(archivo());

      expect(dibujos[0]?.calidad).toBe(0.9);
    });

    it('si no cabe, baja la calidad y luego el lado, y entrega la que cabe', async () => {
      imagenDe(400, 300);
      pesoSegunCalidad = (_calidad, lado) => (lado === 256 ? 80_000 : 20_000);

      const foto = await prepararLaFoto(archivo());

      expect(foto.size).toBe(20_000);
      // 6 calidades a 256 px y la primera de 192 px, que ya cabe.
      expect(dibujos.map((d) => d.ancho)).toEqual([256, 256, 256, 256, 256, 256, 192]);
    });

    it('si no hay forma de que quepa, lo dice', async () => {
      imagenDe(400, 300);
      pesoSegunCalidad = () => 900_000;

      expect(await motivoDe(() => prepararLaFoto(archivo()))).toBe('no-cabe');
    });
  });

  describe('lo que no se pudo leer', () => {
    it('un archivo que no se deja abrir', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no es una imagen')));
      vi.stubGlobal(
        'Image',
        class {
          src = '';
          decode(): Promise<void> {
            return Promise.reject(new Error('no es una imagen'));
          }
        },
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

      expect(await motivoDe(() => prepararLaFoto(archivo()))).toBe('ilegible');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba');
    });

    it.each([
      [0, 0],
      [0, 50],
      [50, 0],
    ])('una imagen sin tamano (%i x %i)', async (ancho, alto) => {
      imagenDe(ancho, alto);

      expect(await motivoDe(() => prepararLaFoto(archivo()))).toBe('ilegible');
    });

    it('si no hay forma de dibujar, no se pudo leer', async () => {
      imagenDe(400, 300);
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

      expect(await motivoDe(() => prepararLaFoto(archivo()))).toBe('ilegible');
    });

    it('si el lienzo no entrega nada, no se pudo leer', async () => {
      imagenDe(400, 300);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((resolver) => {
        resolver(null);
      });

      expect(await motivoDe(() => prepararLaFoto(archivo()))).toBe('ilegible');
    });
  });

  describe('sin createImageBitmap, se abre con una imagen normal', () => {
    it('la dibuja igual, y suelta su direccion al terminar', async () => {
      vi.stubGlobal('createImageBitmap', undefined);

      const imagen = { naturalWidth: 400, naturalHeight: 300, src: '', decode: vi.fn() };

      imagen.decode.mockResolvedValue(undefined);
      vi.stubGlobal(
        'Image',
        vi.fn(function () {
          return imagen;
        }),
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

      const foto = await prepararLaFoto(archivo());

      expect(foto.type).toBe('image/jpeg');
      expect(dibujos[0]?.llamadas).toContainEqual([
        'drawImage',
        imagen,
        50,
        0,
        300,
        300,
        0,
        0,
        256,
        256,
      ]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba');
    });
  });

  describe('la memoria', () => {
    it('suelta la imagen abierta al terminar bien', async () => {
      imagenDe(400, 300);

      await prepararLaFoto(archivo());

      expect(cerrar).toHaveBeenCalledOnce();
    });

    it('y tambien cuando algo falla', async () => {
      imagenDe(400, 300);
      pesoSegunCalidad = () => 900_000;

      await motivoDe(() => prepararLaFoto(archivo()));

      expect(cerrar).toHaveBeenCalledOnce();
    });
  });
});
