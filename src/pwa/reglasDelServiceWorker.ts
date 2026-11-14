/**
 * Las decisiones del service worker que no necesitan el navegador (SCRUM-135).
 *
 * Viven aqui y no dentro de `sw.ts` por una razon concreta: el service worker
 * corre en otro mundo, sin pagina, y no se puede probar con las herramientas
 * normales. Todo lo que se pueda decidir con un valor de entrada y uno de
 * salida se saca aqui, donde si se prueba. En `sw.ts` solo queda el cableado.
 *
 * Este archivo lo importan dos proyectos de TypeScript (el de la aplicacion y
 * el del service worker), asi que no puede tocar nada de `window` ni de
 * `self`.
 */

/** La ruta a la que se lleva un aviso cuando no trae una valida. */
export const RUTA_POR_OMISION = '/panel';

/**
 * Una ruta de esta misma aplicacion, o el panel.
 *
 * El aviso viene del servidor, pero no se fia: llevar a otro sitio desde una
 * notificacion es justo la forma de usar un aviso legitimo para enganar a
 * alguien. Solo se aceptan rutas que empiezan por una sola barra.
 *
 * Tampoco se acepta la barra invertida: los navegadores la tratan como una
 * barra normal, de modo que `/\evil.example` se lee como `//evil.example`, que
 * es otro sitio. Ni los caracteres de control, que se usan para esconder lo que
 * de verdad dice una direccion.
 */
export function rutaPropia(ruta: unknown): string {
  if (typeof ruta !== 'string') {
    return RUTA_POR_OMISION;
  }

  // eslint-disable-next-line no-control-regex
  const tieneControl = /[\u0000-\u001f\u007f]/u.test(ruta);

  if (!ruta.startsWith('/') || ruta.startsWith('//') || ruta.includes('\\') || tieneControl) {
    return RUTA_POR_OMISION;
  }

  return ruta;
}

/** El icono de la aplicacion: el de todo aviso que no trae el de una mascota. */
export const ICONO_POR_OMISION = '/icono-192.png';

/**
 * Las formas de mascota que tienen icono en `public/mascotas/` (SCRUM-243).
 *
 * El servidor manda la forma elegida en la cuenta (`mascota`) y el aviso muestra su cara. La lista vive
 * aqui y no se importa de `personajes.ts` porque el service worker no tiene `window` ni
 * `import.meta.glob`; una prueba comprueba que sea la misma que la de los personajes y que cada forma
 * tenga su archivo. La mascota propia no esta: su dibujo es privado y no se puede pedir desde una
 * notificacion, asi que lleva el icono de la aplicacion.
 */
export const FORMAS_CON_ICONO = ['fungito', 'sparky', 'ori', 'gato', 'obsidian'] as const;

/**
 * El icono de un aviso: el de la mascota si es de la lista, y si no el de la aplicacion.
 *
 * Viene del servidor pero no se fia: la forma se compara con la lista, y nada que no este en ella
 * —una ruta, una forma desconocida, un intento de salirse de la carpeta— llega a la direccion.
 */
export function iconoDelAviso(mascota: unknown): string {
  const forma = FORMAS_CON_ICONO.find((una) => una === mascota);

  return forma === undefined ? ICONO_POR_OMISION : `/mascotas/${forma}.webp`;
}

/** Lo que muestra un aviso, ya saneado. */
export interface AvisoParaMostrar {
  readonly titulo: string;
  readonly cuerpo: string;
  /** Uno nuevo del mismo tipo reemplaza al anterior en vez de apilarse. */
  readonly etiqueta: string;
  readonly ruta: string;
  /** El icono: la cara de la mascota de la cuenta, o el de la aplicacion. */
  readonly icono: string;
}

/**
 * Lo que dice el servidor, convertido en lo que se muestra.
 *
 * Lo que llega puede ser cualquier cosa (un cuerpo que no es JSON, un campo con
 * otro tipo): cada campo que no es un texto se sustituye por su valor por
 * omision en lugar de romper el aviso.
 */
export function avisoDesde(datos: unknown): AvisoParaMostrar {
  const objeto: DatosDelAviso = typeof datos === 'object' && datos !== null ? datos : {};

  return {
    titulo: typeof objeto.titulo === 'string' ? objeto.titulo : 'VSD Health',
    cuerpo: typeof objeto.cuerpo === 'string' ? objeto.cuerpo : '',
    etiqueta: typeof objeto.tipo === 'string' ? objeto.tipo : 'vsd-health',
    ruta: rutaPropia(objeto.ruta),
    icono: iconoDelAviso(objeto.mascota),
  };
}

/** Lo que el servidor puede mandar. Cada campo es opcional y de tipo desconocido. */
interface DatosDelAviso {
  readonly titulo?: unknown;
  readonly cuerpo?: unknown;
  readonly tipo?: unknown;
  readonly ruta?: unknown;
  readonly mascota?: unknown;
}

/**
 * Si una direccion es una pantalla de la aplicacion y no un archivo.
 *
 * Es lo que decide si, sin conexion, se sirve la aplicacion (`index.html`) en
 * lugar de ir a la red:
 *
 * - **Una pantalla** (`/panel`, `/diario`, `/actividad/abc`): la dibuja el
 *   enrutador de React, asi que `index.html` sirve para todas.
 * - **Un archivo** (`/guia.pdf`, `/icono.png`, `/assets/x.js`): tiene que
 *   devolver ese archivo. Servirle `index.html` a quien pidio un PDF le
 *   ensenaria la portada dentro de un visor de PDF.
 *
 * Las de otro origen nunca: la API, Supabase y las fuentes no son de la
 * aplicacion, y no se tocan.
 */
export function esPantallaDeLaApp(direccion: URL, origenDeLaApp: string): boolean {
  if (direccion.origin !== origenDeLaApp) {
    return false;
  }

  // Cualquier cosa que cuelgue de /api es de la API, por si algun dia se
  // sirviera desde el mismo origen. Nunca se responde con index.html.
  if (direccion.pathname === '/api' || direccion.pathname.startsWith('/api/')) {
    return false;
  }

  // El ultimo tramo con extension es un archivo. Hasta 12 letras: `.webmanifest`
  // tiene 11, y con un limite menor se tomaria por una pantalla.
  const ultimoTramo = direccion.pathname.split('/').pop() ?? '';

  return !/\.[a-z0-9]{1,12}$/i.test(ultimoTramo);
}

/**
 * El mensaje con el que la pagina le dice a un service worker nuevo que tome el
 * control. Es de la forma que manda `vite-plugin-pwa`.
 */
export function esOrdenDeActualizar(datos: unknown): boolean {
  return (
    typeof datos === 'object' &&
    datos !== null &&
    (datos as { type?: unknown }).type === 'SKIP_WAITING'
  );
}
