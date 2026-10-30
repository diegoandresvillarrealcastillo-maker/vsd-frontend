import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { comprobarElServiceWorker, principal } from './comprobar-el-service-worker.mjs';

/**
 * El guardia del service worker compilado (SCRUM-135), probado.
 *
 * `scripts/comprobar-el-service-worker.mjs` carga `dist/sw.js` en una caja aislada, le
 * manda eventos y falla la compilacion si algo no cuadra: que guarde todo lo que la
 * aplicacion necesita, que no responda a lo que no es suyo, que no tome el control solo y
 * que los avisos no lleven fuera del sitio. Un guardia que nunca ve un caso que falle puede
 * estar aprobando todo sin que nadie lo note, asi que aqui se le ensenan los dos: un
 * `sw.js` de mentira bien armado, y una variante rota por cada cosa que dice vigilar.
 *
 * El de mentira no usa Workbox: es una version a mano de lo que `dist/sw.js` tiene que
 * hacer. Lo que se prueba es el guardia, no el service worker (de ese se encargan las
 * pruebas de `src/pwa/` y el propio guardia al compilar). Todo ocurre en una carpeta
 * temporal: nunca toca el `dist/` de verdad. Casi todo llama a `principal` en este mismo
 * proceso, que es lo que deja a Vitest medir cuanto del guardia se ejercita; el final lo
 * lanza de verdad, para vigilar el arranque y el codigo de salida.
 */
const SCRIPT = resolve('scripts/comprobar-el-service-worker.mjs');

interface Entrada {
  revision: string | null;
  url: string;
}

const ENTRADAS: Entrada[] = [
  { revision: null, url: 'index.html' },
  { revision: null, url: 'assets/app-abc.js' },
  { revision: '1a2b3c', url: 'assets/app-abc.css' },
];

const HTML_BUENO =
  '<!doctype html><html><head>' +
  '<script type="module" crossorigin src="/assets/app-abc.js"></script>' +
  '<link rel="stylesheet" href="/assets/app-abc.css">' +
  '</head><body></body></html>';

/** Un service worker armado a mano que cumple todo lo que el guardia vigila. */
function swBueno(entradas: Entrada[] = ENTRADAS): string {
  return String.raw`
const PRECACHE = ${JSON.stringify(entradas)};
const MASCOTAS = ['gato', 'perro'];

function rutaSegura(ruta) {
  const propia = typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') && !ruta.startsWith('/\\');

  return propia ? ruta : '/panel';
}

const CACHE = 'precache-v1';
const CACHE_ANTERIOR = 'precache-v0';

// Al instalarse precachea todo en la cache nueva y, para que haya algo que limpiar al
// activarse, tambien en la de una version anterior; en las dos deja un archivo que la
// version nueva ya no trae.
self.addEventListener('install', (evento) => {
  const rutas = [...PRECACHE.map((entrada) => '/' + entrada.url), '/anterior.js'];

  evento.waitUntil(
    Promise.all(
      [CACHE, CACHE_ANTERIOR].map((nombre) =>
        caches.open(nombre).then((cache) =>
          Promise.all(rutas.map((ruta) => cache.put(ruta, new Response(ruta)))),
        ),
      ),
    ),
  );
});

// Al activarse tira las caches de otras versiones y lo que sobra en la suya, y solo
// entonces toma el control de las paginas abiertas.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(nombres.filter((nombre) => nombre !== CACHE).map((nombre) => caches.delete(nombre))),
      )
      .then(() => caches.open(CACHE))
      .then((cache) =>
        cache.keys().then((claves) =>
          Promise.all(
            claves
              .filter((clave) => !PRECACHE.some((entrada) => clave.url === '/' + entrada.url))
              .map((clave) => cache.delete(clave)),
          ),
        ),
      )
      .then(() => caches.has(CACHE))
      .then((lista) => lista && self.clients.claim()),
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (evento) => {
  const pedida = evento.request;
  const url = new URL(pedida.url);

  if (pedida.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const esPantalla = pedida.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(url.pathname);
  const esArchivo = PRECACHE.some((entrada) => '/' + entrada.url === url.pathname);

  if (esPantalla || esArchivo) {
    // Primero lo guardado, en cualquier cache y luego en la propia; si no esta, la red.
    evento.respondWith(
      caches
        .match(pedida)
        .then((guardada) => guardada || caches.open(CACHE).then((cache) => cache.match(pedida)))
        .then((guardada) => guardada || fetch(pedida)),
    );
  }
});

self.addEventListener('push', (evento) => {
  let datos = {};

  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = {};
  }

  const mascota = MASCOTAS.includes(datos.mascota) ? datos.mascota : null;

  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'VSD Health', {
      body: datos.cuerpo,
      tag: datos.tipo,
      icon: mascota ? '/mascotas/' + mascota + '.webp' : '/icono-192.png',
      data: { ruta: rutaSegura(datos.ruta) },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((ventanas) =>
      ventanas.length > 0
        ? ventanas[0].focus()
        : self.clients.openWindow(rutaSegura(evento.notification.data.ruta)),
    ),
  );
});
`;
}

/**
 * El service worker bueno con un cambio. Si el texto a cambiar ya no esta, la prueba
 * habria dejado de probar lo que dice: falla en vez de aprobar en silencio.
 */
function swCon(antes: string, despues: string): string {
  const bueno = swBueno();

  expect(bueno, `el service worker de mentira ya no contiene: ${antes}`).toContain(antes);

  return bueno.replace(antes, despues);
}

let carpeta = '';

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'service-worker-'));
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

interface Compilacion {
  /** El `sw.js`, o `null` si no se escribe. */
  sw?: string | null;
  html?: string;
  /** Los archivos de `dist/assets/`. Con la lista vacia, la carpeta ni se crea. */
  assets?: string[];
}

/** Escribe un `dist/` en la carpeta temporal. Sin argumentos, uno bueno. */
function escribir({
  sw = swBueno(),
  html = HTML_BUENO,
  assets = ['app-abc.js', 'app-abc.css'],
}: Compilacion = {}): void {
  const dist = join(carpeta, 'dist');

  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'index.html'), html);

  if (sw !== null) {
    writeFileSync(join(dist, 'sw.js'), sw);
  }

  if (assets.length > 0) {
    mkdirSync(join(dist, 'assets'), { recursive: true });

    for (const nombre of assets) {
      writeFileSync(join(dist, 'assets', nombre), `/* ${nombre} */`);
    }
  }
}

/** Corre el guardia en este proceso y devuelve si aprobo y todo lo que dijo. */
async function correr(): Promise<{ aprobo: boolean; salida: string }> {
  const dicho: string[] = [];
  const codigo = await principal(join(carpeta, 'dist'), {
    log: (texto) => dicho.push(texto),
    error: (texto) => dicho.push(texto),
  });

  return { aprobo: codigo === 0, salida: dicho.join('\n') };
}

describe('un service worker bien armado', () => {
  it('lo aprueba, y dice cuantas cosas miro y cuantos archivos guarda', async () => {
    escribir();

    const { aprobo, salida } = await correr();

    expect(salida).toMatch(/Service worker comprobado: \d+ comprobaciones, 3 archivos guardados\./);
    expect(aprobo).toBe(true);
  });

  it('devuelve la lista de lo que guarda y ningun fallo', async () => {
    escribir();

    const { fallos, guardados, comprobaciones } = await comprobarElServiceWorker(
      join(carpeta, 'dist'),
    );

    expect(fallos).toEqual([]);
    expect(guardados).toEqual(['index.html', 'assets/app-abc.js', 'assets/app-abc.css']);
    expect(comprobaciones).toBeGreaterThan(40);
  });

  it('el de mentira es de verdad bueno: sin entradas con revision de texto tambien', async () => {
    // La lista de Workbox trae `"revision":null` o `"revision":"hash"`: las dos se leen.
    escribir({
      sw: swBueno([
        { revision: 'abc123', url: 'index.html' },
        { revision: null, url: 'assets/app-abc.js' },
        { revision: 'def456', url: 'assets/app-abc.css' },
      ]),
    });

    expect((await correr()).aprobo).toBe(true);
  });
});

describe('la lista de archivos que guarda', () => {
  it('falla, y lo dice, si la compilacion no genero el service worker', async () => {
    escribir({ sw: null });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toBe('No existe dist/sw.js: la compilacion no genero el service worker.');
  });

  it('falla si el service worker no trae ninguna lista', async () => {
    escribir({ sw: swBueno([]) });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('el service worker trae una lista de archivos que guardar');
    expect(salida).toContain('guarda index.html');
  });

  it('falla si no guarda index.html', async () => {
    escribir({ sw: swBueno(ENTRADAS.slice(1)) });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('guarda index.html');
  });

  it('falla si queda el marcador sin reemplazar', async () => {
    escribir({ sw: `${swBueno()}\nself.__WB_MANIFEST;` });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('no queda ningun marcador sin reemplazar');
  });

  it('falla si guarda un archivo que no existe en la compilacion', async () => {
    escribir({ sw: swBueno([...ENTRADAS, { revision: null, url: 'assets/viejo.js' }]) });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('el archivo guardado existe: assets/viejo.js');
  });

  it.each([
    ['una direccion de otro sitio', 'https://cdn.ejemplo.test/a.js'],
    ['una ruta que empieza por barra', '/assets/app-abc.js'],
    ['una ruta de la API', 'api/pendientes'],
  ])('falla si guarda %s', async (_caso, url) => {
    escribir({ sw: swBueno([...ENTRADAS, { revision: null, url }]) });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain(
      `solo guarda archivos propios, no direcciones ni rutas de la API: ${url}`,
    );
  });

  it('falla, y dice donde mirar, si un JS o CSS de la compilacion queda fuera de la lista', async () => {
    escribir({ assets: ['app-abc.js', 'app-abc.css', 'otro-def.js'] });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('guarda assets/otro-def.js (revisa globPatterns en vite.config.ts)');
  });

  it('un archivo de assets que no es JS ni CSS no hace falta en la lista', async () => {
    escribir({ assets: ['app-abc.js', 'app-abc.css', 'logo.svg', 'app-abc.js.map'] });

    expect((await correr()).aprobo).toBe(true);
  });

  it('falla si la compilacion no trae archivos en assets/', async () => {
    escribir({ assets: [] });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('la compilacion trae archivos en assets/');
  });

  it('falla si index.html pide un archivo que el service worker no guarda', async () => {
    escribir({
      html: HTML_BUENO.replace('</head>', '<script src="/assets/nuevo.js"></script></head>'),
      assets: ['app-abc.js', 'app-abc.css', 'nuevo.js'],
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('guarda lo que index.html pide: assets/nuevo.js');
  });

  it('falla si index.html no nombra ningun archivo de assets/', async () => {
    escribir({ html: '<!doctype html><html><body>vacio</body></html>' });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('index.html nombra al menos un archivo de assets/');
  });
});

describe('instalarse, activarse y la orden de la pagina', () => {
  it('falla si al instalarse activa la version nueva sin esperar', async () => {
    escribir({
      sw: swCon(
        "self.addEventListener('install', (evento) => {",
        "self.addEventListener('install', (evento) => { self.skipWaiting();",
      ),
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('instalarse NO llama a skipWaiting');
  });

  it('falla si al activarse no toma el control de las paginas abiertas', async () => {
    escribir({ sw: swCon('lista && self.clients.claim()', 'lista') });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('al activarse toma el control de las paginas abiertas');
  });

  it('falla si cualquier mensaje activa la version nueva', async () => {
    escribir({ sw: swCon("evento.data && evento.data.type === 'SKIP_WAITING'", 'true') });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un mensaje que no es la orden no activa nada');
  });

  it('falla si la orden de la pagina no activa la version nueva', async () => {
    escribir({ sw: swCon('self.skipWaiting();', '') });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('la orden de la pagina si activa la version nueva');
  });
});

describe('que responde y que no', () => {
  it('falla si responde a todo, incluida la API y los datos de una persona', async () => {
    escribir({
      sw: swCon(
        'const url = new URL(pedida.url);',
        "const url = new URL(pedida.url); evento.respondWith(Promise.resolve(new Response('todo')));",
      ),
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('NO responde: GET a la API de otro origen');
    expect(salida).toContain('NO responde: GET a la cuenta (datos de una persona)');
    expect(salida).toContain('NO responde: POST a la API');
    expect(salida).toContain('NO responde: la hoja de estilos de Google Fonts (ya no se usa)');
  });

  it('falla si no responde a nada, ni a las pantallas ni a los archivos guardados', async () => {
    escribir({ sw: swCon('evento.respondWith(', 'Promise.resolve(') });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('responde: la pantalla /panel sin conexion');
    expect(salida).toContain('responde: una ruta con consulta y ancla');
    expect(salida).toContain('responde: un archivo de la compilacion (assets/app-abc.js)');
  });

  it('falla si compara solo el dominio y responde en otro puerto', async () => {
    escribir({
      sw: swCon('url.origin !== self.location.origin', 'url.hostname !== self.location.hostname'),
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('NO responde: una navegacion al mismo dominio con otro puerto');
  });

  it('falla si trata un archivo como una pantalla (un PDF sin conexion)', async () => {
    escribir({ sw: swCon(' && !/\\.[a-z0-9]+$/i.test(url.pathname)', '') });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('NO responde: un PDF: es un archivo, no una pantalla');
  });
});

describe('los avisos', () => {
  it('falla si cualquier texto de mascota se vuelve parte de la ruta del icono', async () => {
    escribir({
      sw: swCon(
        'MASCOTAS.includes(datos.mascota) ? datos.mascota : null',
        "typeof datos.mascota === 'string' ? datos.mascota : null",
      ),
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un aviso con la mascota "propia" lleva el icono de la aplicacion');
    expect(salida).toContain(
      'un aviso con la mascota "../icono-192" lleva el icono de la aplicacion',
    );
  });

  it('falla si la mascota de la cuenta no lleva su icono', async () => {
    escribir({
      sw: swCon("'/mascotas/' + mascota + '.webp'", "'/icono-192.png'"),
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un aviso con la mascota de la cuenta lleva su icono');
  });

  it.each([
    ['el titulo', "datos.titulo || 'VSD Health'", "'VSD Health'"],
    ['el cuerpo', 'body: datos.cuerpo,', ''],
    ['la etiqueta', 'tag: datos.tipo,', ''],
    ['la ruta', 'data: { ruta: rutaSegura(datos.ruta) }', "data: { ruta: '/panel' }"],
  ])('falla si el aviso pierde %s', async (_campo, antes, despues) => {
    escribir({ sw: swCon(antes, despues) });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un aviso con datos completos se muestra tal cual');
  });

  it('falla si un aviso con una ruta de otro sitio lleva a otro sitio', async () => {
    escribir({ sw: swCon("return propia ? ruta : '/panel';", 'return ruta;') });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un aviso con la ruta "https://evil.example" lleva al panel');
    expect(salida).toContain('un aviso con la ruta "javascript:alert(1)" lleva al panel');
    expect(salida).toContain('tocar un aviso con una ruta de otro sitio abre el panel');
    expect(salida).toContain('tocar un aviso con una ruta hostil abre el panel');
  });

  it('falla, sin romperse, si ni siquiera escucha los avisos', async () => {
    escribir({ sw: swCon("self.addEventListener('push',", "self.addEventListener('otra-cosa',") });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un aviso con datos completos se muestra tal cual');
    expect(salida).toContain('un aviso sin datos se muestra');
  });

  it('falla si un cuerpo que no es JSON no se muestra con lo de siempre', async () => {
    escribir({ sw: swCon("datos.titulo || 'VSD Health'", "datos.titulo || 'Otra cosa'") });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('un aviso con un cuerpo que no es JSON se muestra con lo de siempre');
    expect(salida).toContain('un aviso sin datos se muestra');
  });

  it('falla si tocar un aviso no abre su ruta propia', async () => {
    escribir({
      sw: swCon(
        'self.clients.openWindow(rutaSegura(evento.notification.data.ruta))',
        "self.clients.openWindow('/panel')",
      ),
    });

    const { aprobo, salida } = await correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain('tocar un aviso abre la ruta propia');
  });
});

describe('lanzado como lo lanza `npm run build`', () => {
  // El guardia busca `dist/` junto a `scripts/`, asi que para lanzarlo de verdad se arma esa
  // misma distribucion en la carpeta temporal.
  function lanzar(): { codigo: number; salida: string } {
    mkdirSync(join(carpeta, 'scripts'), { recursive: true });
    copyFileSync(SCRIPT, join(carpeta, 'scripts', 'comprobar-el-service-worker.mjs'));

    try {
      const salida = execFileSync(
        process.execPath,
        [join(carpeta, 'scripts', 'comprobar-el-service-worker.mjs')],
        { encoding: 'utf8' },
      );

      return { codigo: 0, salida };
    } catch (error) {
      const fallo = error as { status?: number; stderr?: string; stdout?: string };

      return { codigo: fallo.status ?? -1, salida: `${fallo.stderr ?? ''}${fallo.stdout ?? ''}` };
    }
  }

  // Son las unicas que arrancan el archivo de verdad: vigilan que el arranque protegido siga
  // arrancando y que el codigo de salida llegue a quien lo lanza (sin eso, un service worker
  // roto no pararia la compilacion).
  it('sale con 0 y lo cuenta cuando esta bien armado', () => {
    escribir();

    const { codigo, salida } = lanzar();

    expect(codigo).toBe(0);
    expect(salida).toMatch(/Service worker comprobado: \d+ comprobaciones, 3 archivos guardados/);
  });

  it('sale con 1 y dice que no esta bien armado cuando algo falla', () => {
    escribir({ sw: swCon('lista && self.clients.claim()', 'lista') });

    const { codigo, salida } = lanzar();

    expect(codigo).toBe(1);
    expect(salida).toContain('El service worker NO esta bien armado');
    expect(salida).toContain('No se publica un service worker asi');
  });

  it('sale con 1 si ni siquiera hay service worker', () => {
    escribir({ sw: null });

    const { codigo, salida } = lanzar();

    expect(codigo).toBe(1);
    expect(salida).toContain('No existe dist/sw.js');
  });
});

describe('importarlo no ejecuta nada', () => {
  it('traer el archivo no cambia el codigo de salida del proceso', async () => {
    // Sin el arranque protegido, importar el guardia correria las comprobaciones sobre el
    // `dist/` del repositorio y dejaria un codigo de salida puesto.
    const antes = process.exitCode;

    vi.resetModules();
    await import('./comprobar-el-service-worker.mjs');

    expect(process.exitCode).toBe(antes);
  });
});
