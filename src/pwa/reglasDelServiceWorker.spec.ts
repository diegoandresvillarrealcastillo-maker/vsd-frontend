import { describe, expect, it } from 'vitest';

import { PERSONAJES } from '../mascota/personajes.ts';
import {
  avisoDesde,
  esOrdenDeActualizar,
  esPantallaDeLaApp,
  FORMAS_CON_ICONO,
  ICONO_POR_OMISION,
  iconoDelAviso,
  RUTA_POR_OMISION,
  rutaPropia,
} from './reglasDelServiceWorker.ts';

const ORIGEN = 'https://vsd-health.example';

function direccion(ruta: string, origen = ORIGEN): URL {
  return new URL(ruta, origen);
}

describe('rutaPropia', () => {
  it.each([
    ['el panel', '/panel'],
    ['con consulta', '/diario?dia=2026-10-07'],
    ['con tramo y ancla', '/actividad/abc#fin'],
    ['la raiz', '/'],
  ])('acepta %s', (_nombre, ruta) => {
    expect(rutaPropia(ruta)).toBe(ruta);
  });

  it.each([
    ['sin barra inicial', 'panel'],
    ['de otro sitio, con esquema', 'https://evil.example/panel'],
    ['sin esquema pero de otro sitio (//)', '//evil.example/panel'],
    ['con barra invertida, que el navegador lee como barra', '/\\evil.example'],
    ['con una barra invertida mas adentro', '/panel\\..\\evil'],
    ['un esquema peligroso', 'javascript:alert(1)'],
    ['con un salto de linea', '/panel\nSet-Cookie: x=1'],
    ['con un tabulador', '/pa\tnel'],
    ['con un caracter de control', '/pa\u0000nel'],
    ['con DEL', '/pa\u007fnel'],
    ['vacia', ''],
  ])('rechaza una ruta %s y lleva al panel', (_nombre, ruta) => {
    expect(rutaPropia(ruta)).toBe(RUTA_POR_OMISION);
  });

  it.each([
    ['indefinida', undefined],
    ['nula', null],
    ['un numero', 42],
    ['un objeto', { ruta: '/panel' }],
    ['un arreglo', ['/panel']],
  ])('lo que no es un texto (%s) lleva al panel', (_nombre, ruta) => {
    expect(rutaPropia(ruta)).toBe(RUTA_POR_OMISION);
  });

  it('la ruta por omision es el panel', () => {
    expect(RUTA_POR_OMISION).toBe('/panel');
  });
});

describe('avisoDesde', () => {
  it('toma todo lo que viene bien formado', () => {
    expect(
      avisoDesde({
        titulo: 'Tus pendientes',
        cuerpo: 'Tienes 2 por hacer',
        tipo: 'semaforo',
        ruta: '/diario',
      }),
    ).toEqual({
      titulo: 'Tus pendientes',
      cuerpo: 'Tienes 2 por hacer',
      etiqueta: 'semaforo',
      ruta: '/diario',
      icono: '/icono-192.png',
    });
  });

  it('lo que falta toma su valor por omision', () => {
    expect(avisoDesde({})).toEqual({
      titulo: 'VSD Health',
      cuerpo: '',
      etiqueta: 'vsd-health',
      ruta: '/panel',
      icono: '/icono-192.png',
    });
  });

  it.each([
    ['nulo', null],
    ['indefinido', undefined],
    ['un texto', 'hola'],
    ['un numero', 7],
    ['un arreglo', []],
  ])('un cuerpo que es %s no rompe el aviso', (_nombre, datos) => {
    expect(avisoDesde(datos)).toEqual({
      titulo: 'VSD Health',
      cuerpo: '',
      etiqueta: 'vsd-health',
      ruta: '/panel',
      icono: '/icono-192.png',
    });
  });

  it('un campo con otro tipo se sustituye, sin tirar los demas', () => {
    expect(avisoDesde({ titulo: 5, cuerpo: 'Sigue', tipo: ['x'], ruta: 8 })).toEqual({
      titulo: 'VSD Health',
      cuerpo: 'Sigue',
      etiqueta: 'vsd-health',
      ruta: '/panel',
      icono: '/icono-192.png',
    });
  });

  it('una ruta de otro sitio no sobrevive al aviso', () => {
    expect(avisoDesde({ ruta: 'https://evil.example' }).ruta).toBe('/panel');
    expect(avisoDesde({ ruta: '/\\evil.example' }).ruta).toBe('/panel');
  });
});

describe('iconoDelAviso (SCRUM-243)', () => {
  it('el icono de siempre es el de la aplicacion', () => {
    expect(ICONO_POR_OMISION).toBe('/icono-192.png');
  });

  it.each(FORMAS_CON_ICONO)('la forma «%s» tiene su icono', (forma) => {
    expect(iconoDelAviso(forma)).toBe(`/mascotas/${forma}.webp`);
  });

  it.each([
    ['la mascota propia, cuyo dibujo es privado', 'propia'],
    ['una forma que no se conoce', 'dragon'],
    ['un intento de salirse de la carpeta', '../icono-192'],
    ['una ruta', '/mascotas/gato.webp'],
    ['con mayusculas', 'Gato'],
    ['con espacios', ' gato'],
    ['vacia', ''],
    ['un numero', 42],
    ['nula', null],
    ['indefinida', undefined],
    ['un objeto', { forma: 'gato' }],
    ['un arreglo', ['gato']],
  ])('%s usa el icono de la aplicacion', (_nombre, forma) => {
    expect(iconoDelAviso(forma)).toBe('/icono-192.png');
  });

  it('el aviso toma el icono de la mascota que manda el servidor', () => {
    expect(avisoDesde({ titulo: 'Tu racha de 12 días', mascota: 'ori' }).icono).toBe(
      '/mascotas/ori.webp',
    );
  });

  it('sin mascota, o con una que no es de la lista, queda el de siempre', () => {
    expect(avisoDesde({ titulo: 'x' }).icono).toBe('/icono-192.png');
    expect(avisoDesde({ titulo: 'x', mascota: 'propia' }).icono).toBe('/icono-192.png');
    expect(avisoDesde({ titulo: 'x', mascota: 7 }).icono).toBe('/icono-192.png');
  });

  it('la lista es la de los personajes de la aplicacion: si se agrega uno, esto avisa', () => {
    // El service worker no puede importar `personajes.ts` (no tiene `window` ni `import.meta.glob`),
    // asi que la lista vive aqui y esta prueba la vigila.
    expect([...FORMAS_CON_ICONO].sort()).toEqual(Object.keys(PERSONAJES).sort());
  });

  it('cada forma tiene su archivo en public/mascotas', () => {
    const archivos = Object.keys(
      import.meta.glob('/public/mascotas/*.webp', { query: '?url', import: 'default' }),
    );

    expect(archivos.map((archivo) => archivo.replace('/public/mascotas/', '')).sort()).toEqual(
      FORMAS_CON_ICONO.map((forma) => `${forma}.webp`).sort(),
    );
  });
});

describe('esPantallaDeLaApp', () => {
  it.each([
    ['la raiz', '/'],
    ['el panel', '/panel'],
    ['el diario', '/diario'],
    ['un modulo', '/modulo/cognicion'],
    ['una actividad', '/actividad/9a1c2f7e-4b1d-4f55-9d5e-0c1c2c3d4e5f'],
    ['con consulta', '/panel?x=1'],
    ['con ancla', '/contrasena-nueva#access_token=abc'],
    ['con barra final', '/diario/'],
  ])('%s es una pantalla', (_nombre, ruta) => {
    expect(esPantallaDeLaApp(direccion(ruta), ORIGEN)).toBe(true);
  });

  it.each([
    ['un PDF', '/guia-de-la-mascota-propia.pdf'],
    ['un icono', '/icono-192.png'],
    ['el service worker', '/sw.js'],
    ['el manifiesto', '/manifest.webmanifest'],
    ['un archivo con hash', '/assets/index-wloNZWKd.js'],
    ['un SVG', '/favicon.svg'],
    ['un archivo con extension en MAYUSCULAS', '/Guia.PDF'],
    ['un archivo dentro de una carpeta', '/descargas/informe.v2.json'],
  ])('%s es un archivo, no una pantalla', (_nombre, ruta) => {
    expect(esPantallaDeLaApp(direccion(ruta), ORIGEN)).toBe(false);
  });

  it.each([
    ['la raiz de la API', '/api'],
    ['una ruta de la API', '/api/pendientes'],
    ['una ruta profunda de la API', '/api/cuenta/foto'],
  ])('%s nunca se responde con la aplicacion', (_nombre, ruta) => {
    expect(esPantallaDeLaApp(direccion(ruta), ORIGEN)).toBe(false);
  });

  it('una ruta que solo EMPIEZA parecido a /api si es una pantalla', () => {
    expect(esPantallaDeLaApp(direccion('/apiario'), ORIGEN)).toBe(true);
    expect(esPantallaDeLaApp(direccion('/api-docs'), ORIGEN)).toBe(true);
  });

  it.each([
    ['la API en otro dominio', 'https://vsd-api.example/health'],
    ['el proveedor de identidad', 'https://auth.example/auth/v1/token'],
    ['las fuentes', 'https://fonts.googleapis.com/css2?family=Manrope'],
    ['el mismo dominio con otro puerto', 'https://vsd-health.example:8443/panel'],
    ['el mismo dominio con http', 'http://vsd-health.example/panel'],
  ])('%s nunca es una pantalla de la aplicacion', (_nombre, completa) => {
    expect(esPantallaDeLaApp(new URL(completa), ORIGEN)).toBe(false);
  });
});

describe('esOrdenDeActualizar', () => {
  it('reconoce el mensaje que manda vite-plugin-pwa', () => {
    expect(esOrdenDeActualizar({ type: 'SKIP_WAITING' })).toBe(true);
  });

  it.each([
    ['otro tipo', { type: 'OTRA_COSA' }],
    ['sin tipo', {}],
    ['en minusculas', { type: 'skip_waiting' }],
    ['un texto', 'SKIP_WAITING'],
    ['nulo', null],
    ['indefinido', undefined],
    ['un numero', 1],
  ])('no es una orden: %s', (_nombre, datos) => {
    expect(esOrdenDeActualizar(datos)).toBe(false);
  });
});
