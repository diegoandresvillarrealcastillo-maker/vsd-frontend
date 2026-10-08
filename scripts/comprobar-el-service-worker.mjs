/**
 * Comprueba el service worker ya compilado (SCRUM-135).
 *
 * Corre al final de `npm run build`, y por tanto tambien en el CI y en cada
 * despliegue de Vercel. Si algo de esto falla, **la compilacion falla**: un
 * service worker roto no se publica.
 *
 * ---------------------------------------------------------------------------
 * Por que esto no es una prueba de Vitest
 * ---------------------------------------------------------------------------
 *
 * Lo que se publica no es `src/sw.ts`, es `dist/sw.js`: el resultado de
 * compilarlo, con Workbox dentro y la lista de archivos inyectada. Las pruebas
 * de `src/pwa/` cubren las reglas (que ruta es una pantalla, que aviso se
 * muestra), pero no pueden cubrir que el archivo final este armado como hay que
 * armarlo. Esto si: lo carga en un entorno simulado y le manda eventos.
 *
 * ---------------------------------------------------------------------------
 * Que garantiza
 * ---------------------------------------------------------------------------
 *
 * 1. **Guarda todo lo que la aplicacion necesita:** `index.html` y cada JS y
 *    CSS de `dist/assets`. Si un archivo se quedara fuera (por ejemplo por un
 *    patron de `globPatterns` que no lo cubre), la aplicacion abriria sin
 *    conexion con un error. Aqui se detecta.
 * 2. **No toca lo que no es suyo:** una peticion a la API, a Supabase o a
 *    cualquier otro origen no la responde el service worker. Lo que devuelve la
 *    API es de una persona, y esa copia no se borraria al cerrar sesion.
 * 3. **No toma el control solo:** instalarse no llama a `skipWaiting`. Solo lo
 *    hace cuando la pagina se lo pide. Ver el comentario de `src/sw.ts`.
 * 4. **Los avisos siguen funcionando**, y una ruta hostil no sale del sitio.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const DIST = new URL('../dist/', import.meta.url);
const ORIGEN = 'https://vsd-health.example';

const fallos = [];
let comprobaciones = 0;

function comprobar(descripcion, condicion, detalle = '') {
  comprobaciones += 1;

  if (!condicion) {
    fallos.push(detalle === '' ? descripcion : `${descripcion} (${detalle})`);
  }
}

function leer(ruta) {
  return readFileSync(new URL(ruta, DIST), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. La lista de archivos que guarda
// ---------------------------------------------------------------------------

if (!existsSync(new URL('sw.js', DIST))) {
  console.error('No existe dist/sw.js: la compilacion no genero el service worker.');
  process.exit(1);
}

const codigo = leer('sw.js');

const guardados = [...codigo.matchAll(/\{"revision":(?:null|"[^"]*"),"url":"([^"]+)"\}/g)].map(
  (coincidencia) => coincidencia[1],
);

comprobar('el service worker trae una lista de archivos que guardar', guardados.length > 0);
comprobar('guarda index.html', guardados.includes('index.html'));
comprobar('no queda ningun marcador sin reemplazar', !codigo.includes('__WB_MANIFEST'));

for (const url of guardados) {
  comprobar(`el archivo guardado existe: ${url}`, existsSync(new URL(url, DIST)));
  comprobar(
    `solo guarda archivos propios, no direcciones ni rutas de la API: ${url}`,
    !/^[a-z]+:/i.test(url) && !url.startsWith('/') && !url.startsWith('api/'),
  );
}

// Cada JS y CSS de la compilacion tiene que estar en la lista. Si falta uno, la
// aplicacion abre sin conexion y falla al pedir ese archivo.
const carpetaDeAssets = new URL('assets/', DIST);
const enLaCompilacion = existsSync(carpetaDeAssets)
  ? readdirSync(carpetaDeAssets).filter((nombre) => /\.(js|css)$/.test(nombre))
  : [];

comprobar('la compilacion trae archivos en assets/', enLaCompilacion.length > 0);

for (const nombre of enLaCompilacion) {
  comprobar(
    `guarda assets/${nombre}`,
    guardados.includes(`assets/${nombre}`),
    'revisa globPatterns en vite.config.ts',
  );
}

// Y los que nombra index.html: sin ellos no arranca nada.
const html = leer('index.html');
const nombrados = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((c) => c[1]);

comprobar('index.html nombra al menos un archivo de assets/', nombrados.length > 0);

for (const archivo of nombrados) {
  comprobar(`guarda lo que index.html pide: ${archivo}`, guardados.includes(archivo));
}

// ---------------------------------------------------------------------------
// 2. Su comportamiento, con eventos simulados
// ---------------------------------------------------------------------------

const oyentes = new Map();
const llamadas = { skipWaiting: 0, claim: 0, avisos: [], ventanasAbiertas: [] };

/** Un Cache de memoria, lo justo para que Workbox no se queje. */
function crearCache() {
  const almacen = new Map();
  const clave = (peticion) => (typeof peticion === 'string' ? peticion : peticion.url);

  return {
    put: (peticion, respuesta) => {
      almacen.set(clave(peticion), respuesta);

      return Promise.resolve();
    },
    match: (peticion) => Promise.resolve(almacen.get(clave(peticion))),
    delete: (peticion) => Promise.resolve(almacen.delete(clave(peticion))),
    keys: () => Promise.resolve([...almacen.keys()].map((url) => ({ url }))),
  };
}

const caches = new Map();
const cachesFalsos = {
  open: (nombre) => {
    if (!caches.has(nombre)) {
      caches.set(nombre, crearCache());
    }

    return Promise.resolve(caches.get(nombre));
  },
  match: () => Promise.resolve(undefined),
  keys: () => Promise.resolve([...caches.keys()]),
  delete: (nombre) => Promise.resolve(caches.delete(nombre)),
  has: (nombre) => Promise.resolve(caches.has(nombre)),
};

const registro = {
  scope: `${ORIGEN}/`,
  showNotification: (titulo, opciones) => {
    llamadas.avisos.push({ titulo, opciones });

    return Promise.resolve();
  },
};

const entorno = {
  URL,
  URLSearchParams,
  Request,
  Response,
  Headers,
  AbortController,
  TextEncoder,
  TextDecoder,
  console,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  structuredClone,
  Event,
  EventTarget,
  fetch: () => Promise.resolve(new Response('simulado')),
  caches: cachesFalsos,
  registration: registro,
  location: new URL(`${ORIGEN}/`),
  addEventListener: (tipo, funcion) => {
    oyentes.set(tipo, [...(oyentes.get(tipo) ?? []), funcion]);
  },
  skipWaiting: () => {
    llamadas.skipWaiting += 1;

    return Promise.resolve();
  },
  clients: {
    claim: () => {
      llamadas.claim += 1;

      return Promise.resolve();
    },
    matchAll: () => Promise.resolve([]),
    openWindow: (ruta) => {
      llamadas.ventanasAbiertas.push(ruta);

      return Promise.resolve(null);
    },
  },
};
entorno.self = entorno;

createContext(entorno);
runInContext(codigo, entorno);

/** Manda un evento a quien lo escuche y espera a que terminen sus promesas. */
async function disparar(tipo, evento = {}) {
  const pendientes = [];
  const respuestas = [];

  const completo = {
    ...evento,
    waitUntil: (promesa) => pendientes.push(Promise.resolve(promesa).catch(() => undefined)),
    respondWith: (promesa) => {
      respuestas.push(1);
      pendientes.push(Promise.resolve(promesa).catch(() => undefined));
    },
  };

  for (const funcion of oyentes.get(tipo) ?? []) {
    funcion(completo);
  }

  await Promise.all(pendientes);

  return { respondio: respuestas.length > 0 };
}

/** Una peticion de las que Workbox sabe leer. */
function peticion(ruta, { modo = 'cors', metodo = 'GET', origen = ORIGEN } = {}) {
  return { url: new URL(ruta, origen).href, mode: modo, method: metodo, headers: new Headers() };
}

async function preguntar(descripcion, req, debeResponder) {
  const { respondio } = await disparar('fetch', { request: req });

  comprobar(
    `${debeResponder ? 'responde' : 'NO responde'}: ${descripcion}`,
    respondio === debeResponder,
  );
}

// ----- instalarse y activarse -----

await disparar('install');
comprobar(
  'instalarse NO llama a skipWaiting: la version nueva espera a que la persona acepte',
  llamadas.skipWaiting === 0,
);

await disparar('activate');
comprobar('al activarse toma el control de las paginas abiertas', llamadas.claim === 1);

// ----- la orden de la pagina -----

await disparar('message', { data: { type: 'OTRA_COSA' } });
await disparar('message', { data: 'SKIP_WAITING' });
await disparar('message', { data: null });
comprobar('un mensaje que no es la orden no activa nada', llamadas.skipWaiting === 0);

await disparar('message', { data: { type: 'SKIP_WAITING' } });
comprobar('la orden de la pagina si activa la version nueva', llamadas.skipWaiting === 1);

// ----- que responde y que no -----

const primerJs = guardados.find((url) => url.endsWith('.js'));

await preguntar('la pantalla /panel sin conexion', peticion('/panel', { modo: 'navigate' }), true);
await preguntar('la raiz', peticion('/', { modo: 'navigate' }), true);
await preguntar(
  'una ruta con consulta y ancla',
  peticion('/contrasena-nueva?x=1#acceso', { modo: 'navigate' }),
  true,
);
await preguntar(`un archivo de la compilacion (${primerJs})`, peticion(`/${primerJs}`), true);
// La tipografia ya no se pide a Google: viaja con la aplicacion, y sus archivos
// estan en la lista de arriba. Si alguna vez volviera a pedirse a un tercero, este
// service worker no debe guardarlo.
await preguntar(
  'la hoja de estilos de Google Fonts (ya no se usa)',
  peticion('https://fonts.googleapis.com/css2?family=Manrope'),
  false,
);
await preguntar(
  'una letra de Google Fonts (ya no se usa)',
  peticion('https://fonts.gstatic.com/s/manrope/v15/a.woff2'),
  false,
);

await preguntar(
  'un PDF: es un archivo, no una pantalla',
  peticion('/guia.pdf', { modo: 'navigate' }),
  false,
);
await preguntar(
  'una ruta de la API del mismo origen',
  peticion('/api/pendientes', { modo: 'navigate' }),
  false,
);
await preguntar(
  'GET a la API de otro origen',
  peticion('https://vsd-api.example/api/pendientes'),
  false,
);
await preguntar(
  'GET a la cuenta (datos de una persona)',
  peticion('https://vsd-api.example/api/cuenta'),
  false,
);
await preguntar(
  'POST a la API',
  peticion('https://vsd-api.example/api/resultados', { metodo: 'POST' }),
  false,
);
await preguntar(
  'PATCH a la API',
  peticion('https://vsd-api.example/api/pendientes/1', { metodo: 'PATCH' }),
  false,
);
await preguntar(
  'el inicio de sesion de Supabase',
  peticion('https://abcd.supabase.co/auth/v1/token', { metodo: 'POST' }),
  false,
);
await preguntar('la foto de perfil', peticion('https://vsd-api.example/api/cuenta/foto'), false);
await preguntar(
  'un dominio que solo contiene "fonts.googleapis.com"',
  peticion('https://fonts.googleapis.com.evil.example/css'),
  false,
);
await preguntar('un POST al mismo origen', peticion('/algo', { metodo: 'POST' }), false);
// Un navegador no manda al service worker una navegacion a otro origen, pero la
// regla que lo decide no debe depender de eso.
await preguntar(
  'una navegacion a otro dominio',
  peticion('https://evil.example/panel', { modo: 'navigate', origen: 'https://evil.example' }),
  false,
);
await preguntar(
  'una navegacion al mismo dominio con otro puerto',
  peticion('https://vsd-health.example:8443/panel', { modo: 'navigate' }),
  false,
);

// ----- los avisos -----

function aviso(datos) {
  return {
    data: {
      json: () =>
        datos instanceof Error
          ? (() => {
              throw datos;
            })()
          : datos,
    },
  };
}

llamadas.avisos.length = 0;
await disparar(
  'push',
  aviso({ titulo: 'Tus pendientes', cuerpo: 'Tienes 2', tipo: 'semaforo', ruta: '/diario' }),
);
comprobar(
  'un aviso con datos completos se muestra tal cual',
  llamadas.avisos.length === 1 &&
    llamadas.avisos[0].titulo === 'Tus pendientes' &&
    llamadas.avisos[0].opciones.body === 'Tienes 2' &&
    llamadas.avisos[0].opciones.tag === 'semaforo' &&
    llamadas.avisos[0].opciones.data.ruta === '/diario',
);

llamadas.avisos.length = 0;
await disparar('push', aviso(new Error('no es JSON')));
comprobar(
  'un aviso con un cuerpo que no es JSON se muestra con lo de siempre',
  llamadas.avisos.length === 1 &&
    llamadas.avisos[0].titulo === 'VSD Health' &&
    llamadas.avisos[0].opciones.data.ruta === '/panel',
);

llamadas.avisos.length = 0;
await disparar('push', {});
comprobar(
  'un aviso sin datos se muestra',
  llamadas.avisos.length === 1 && llamadas.avisos[0].titulo === 'VSD Health',
);

for (const hostil of [
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  'javascript:alert(1)',
]) {
  llamadas.avisos.length = 0;
  await disparar('push', aviso({ ruta: hostil }));
  comprobar(
    `un aviso con la ruta ${JSON.stringify(hostil)} lleva al panel`,
    llamadas.avisos.length === 1 && llamadas.avisos[0].opciones.data.ruta === '/panel',
  );
}

// ----- tocar un aviso -----

async function tocar(ruta) {
  llamadas.ventanasAbiertas.length = 0;
  await disparar('notificationclick', { notification: { close: () => undefined, data: { ruta } } });

  return llamadas.ventanasAbiertas[0];
}

comprobar('tocar un aviso abre la ruta propia', (await tocar('/diario')) === '/diario');
comprobar(
  'tocar un aviso con una ruta de otro sitio abre el panel',
  (await tocar('https://evil.example')) === '/panel',
);
comprobar(
  'tocar un aviso con una ruta hostil abre el panel',
  (await tocar('/\\evil.example')) === '/panel',
);

// ---------------------------------------------------------------------------

if (fallos.length > 0) {
  console.error(
    `\nEl service worker NO esta bien armado (${fallos.length} de ${comprobaciones}):\n`,
  );

  for (const fallo of fallos) {
    console.error(`  - ${fallo}`);
  }

  console.error(
    '\nNo se publica un service worker asi: ver scripts/comprobar-el-service-worker.mjs.',
  );
  process.exit(1);
}

console.log(
  `Service worker comprobado: ${comprobaciones} comprobaciones, ${guardados.length} archivos guardados.`,
);
