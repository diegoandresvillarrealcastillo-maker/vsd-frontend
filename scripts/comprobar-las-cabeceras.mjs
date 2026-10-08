// Comprueba las cabeceras de seguridad del frontend (S-05 de la auditoria 360).
//
// Se ejecuta al final de `npm run build`, sobre lo que acaba de compilarse, y
// falla si algo no cuadra. Comprueba tres cosas que se rompen sin avisar:
//
// 1. Que `vercel.json` (PRE y PROD) y `nginx/cabeceras-de-seguridad.conf` (la imagen
//    de Docker, el entorno completo y el CI) manden LAS MISMAS cabeceras, con los
//    mismos valores. Dos copias a mano acaban divergiendo, y lo que se prueba en una
//    no seria lo que sale en la otra.
//
// 2. Que cada script en linea de `dist/index.html` este autorizado en la politica de
//    contenido por su hash, y que no sobre ninguno. Si alguien cambia el script del
//    tema, el hash viejo deja de valer: con la politica en vigor, el navegador lo
//    bloquearia y la pagina se vería con el tema equivocado hasta que alguien
//    averiguara por que. Si sobra uno, es una autorizacion a un script que ya no
//    existe. Tambien se comprueba que `index.html` no cargue nada de otro dominio.
//
// 3. Que la politica no se haya aflojado: nada de `unsafe-eval`, ni comodines en los
//    scripts, ni Google Fonts (las tipografias viajan con la aplicacion).
//
// Si el hash no cuadra, el mensaje dice cual es el correcto.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const problemas = [];
let comprobaciones = 0;

function comprobar(descripcion, cumple) {
  comprobaciones += 1;

  if (!cumple) {
    problemas.push(descripcion);
  }
}

// ----- lo que manda Vercel -----

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
// Las de seguridad, que salen en TODOS los ambientes. La regla que solo sale en
// algunos (la de `has`, abajo) no cuenta para esto.
const reglas = (vercel.headers ?? []).filter(
  (regla) => regla.source === '/(.*)' && regla.has === undefined,
);

comprobar(
  'vercel.json tiene una regla de cabeceras para todas las rutas (/(.*))',
  reglas.length === 1,
);

const deVercel = new Map((reglas[0]?.headers ?? []).map(({ key, value }) => [key, value]));

// ----- lo que Vercel manda solo fuera de produccion (SEO-02) -----

const reglasDeLosVercelApp = (vercel.headers ?? []).filter(
  (regla) =>
    regla.source === '/(.*)' &&
    (regla.has ?? []).some(
      (condicion) => condicion.type === 'host' && /vercel/.test(condicion.value),
    ),
);
const robotsDeVercel = reglasDeLosVercelApp
  .flatMap((regla) => regla.headers)
  .find(({ key }) => key === 'X-Robots-Tag');

comprobar(
  'vercel.json manda X-Robots-Tag noindex en PRE y en las vistas previas de las ramas',
  robotsDeVercel !== undefined && /noindex/.test(robotsDeVercel.value),
);

// El dominio de produccion sera uno generico de Vercel (`algo.vercel.app`), asi que la
// regla NO puede cubrir todo `vercel.app`: cerraria produccion a los buscadores. Se
// comprueba con direcciones de ejemplo, una por cada cosa que tiene que pasar.
const hostDeLaRegla = reglasDeLosVercelApp
  .flatMap((regla) => regla.has ?? [])
  .find((condicion) => condicion.type === 'host')?.value;

function cubre(host) {
  try {
    return new RegExp(`^(?:${hostDeLaRegla})$`).test(host);
  } catch {
    return false;
  }
}

comprobar(
  'la regla del noindex cubre PRE (vsd-health-pre.vercel.app)',
  cubre('vsd-health-pre.vercel.app'),
);
comprobar(
  'la regla del noindex cubre las vistas previas de las ramas (-git-)',
  cubre('vsd-health-git-feature-algo-vsd-company.vercel.app'),
);
for (const produccion of ['vsd-health.vercel.app', 'vsd-health-app.vercel.app', 'vsd.vercel.app']) {
  comprobar(
    `la regla del noindex NO cubre un posible dominio de produccion (${produccion}): lo cerraria`,
    !cubre(produccion),
  );
}
comprobar(
  'la cabecera noindex NO sale en todas las rutas de todos los ambientes: cerraria produccion',
  !deVercel.has('X-Robots-Tag'),
);

// ----- lo que manda nginx -----

const rutaDeNginx = 'nginx/cabeceras-de-seguridad.conf';

comprobar(`existe ${rutaDeNginx}`, existsSync(rutaDeNginx));

const deNginx = new Map();

if (existsSync(rutaDeNginx)) {
  for (const linea of readFileSync(rutaDeNginx, 'utf8').split('\n')) {
    const coincidencia = /^add_header\s+(\S+)\s+"(.*)"\s+always;\s*$/.exec(linea.trim());

    if (coincidencia) {
      deNginx.set(coincidencia[1], coincidencia[2]);
    }
  }
}

// ----- lo que nginx manda de mas: la imagen nunca es publica -----

const robotsDeNginx = deNginx.get('X-Robots-Tag');

comprobar(
  'nginx manda X-Robots-Tag noindex: la imagen es local y nunca se indexa',
  robotsDeNginx !== undefined && /noindex/.test(robotsDeNginx),
);

// Se saca de la comparacion de abajo: en Vercel no sale en todos los ambientes.
deNginx.delete('X-Robots-Tag');

// ----- las mismas, con los mismos valores -----

const OBLIGATORIAS = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Content-Security-Policy-Report-Only',
];

for (const nombre of OBLIGATORIAS) {
  comprobar(`Vercel manda ${nombre}`, deVercel.has(nombre));
  comprobar(`nginx manda ${nombre}`, deNginx.has(nombre));
  comprobar(
    `${nombre} vale lo mismo en Vercel y en nginx`,
    deVercel.get(nombre) === deNginx.get(nombre),
  );
}

comprobar(
  'Vercel y nginx mandan exactamente las mismas cabeceras',
  [...deVercel.keys()].sort().join(',') === [...deNginx.keys()].sort().join(','),
);

comprobar(
  'X-Content-Type-Options es nosniff',
  deVercel.get('X-Content-Type-Options') === 'nosniff',
);
comprobar('X-Frame-Options es DENY', deVercel.get('X-Frame-Options') === 'DENY');

// ----- la politica de contenido -----

const politica = deVercel.get('Content-Security-Policy-Report-Only') ?? '';
const directivas = new Map(
  politica
    .split(';')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => {
      const [nombre, ...valores] = parte.split(/\s+/);

      return [nombre, valores];
    }),
);

const REQUERIDAS = {
  'default-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

for (const [nombre, esperados] of Object.entries(REQUERIDAS)) {
  comprobar(
    `la politica dice ${nombre} ${esperados.join(' ')}`,
    (directivas.get(nombre) ?? []).join(' ') === esperados.join(' '),
  );
}

const scripts = directivas.get('script-src') ?? [];

comprobar("script-src parte de 'self'", scripts.includes("'self'"));
comprobar("script-src no admite 'unsafe-eval'", !scripts.includes("'unsafe-eval'"));
comprobar("script-src no admite 'unsafe-inline'", !scripts.includes("'unsafe-inline'"));
comprobar(
  'script-src no admite comodines ni esquemas enteros (*, https:, http:, data:)',
  !scripts.some((valor) => ['*', 'https:', 'http:', 'data:', 'blob:'].includes(valor)),
);
comprobar(
  'la politica no abre la puerta a Google Fonts: las tipografias viajan con la aplicacion',
  // Fuente por fuente y con la regex anclada: buscar el dominio suelto en toda la
  // cadena es lo que CodeQL marca como «sin ancla», con razon cuando se usa para
  // decidir sobre una direccion.
  !politica
    .split(/[\s;]+/)
    .some((fuente) => /^(?:https?:\/\/)?fonts\.(?:googleapis|gstatic)\.com$/.test(fuente)),
);

// ----- el CAPTCHA (SCRUM-165) -----
//
// Cloudflare Turnstile necesita tres cosas en la politica: poder descargar su
// script, poder pintar su iframe y poder hablar con su dominio. Si falta alguna,
// el CAPTCHA no carga y, con la proteccion activada en Supabase, nadie puede
// entrar. Y es el unico dominio de fuera que se admite en estas tres directivas:
// autorizar otro es una decision que se toma a proposito, no se cuela.

const TURNSTILE = 'https://challenges.cloudflare.com';
const conexiones = directivas.get('connect-src') ?? [];

// Se compara fuente por fuente con `===`: `includes` sobre una direccion es la forma
// que CodeQL marca como «subcadena en una URL», aunque aqui sea una lista de fuentes.
const esTurnstile = (valor) => valor === TURNSTILE;

comprobar(
  `script-src autoriza ${TURNSTILE}: sin eso el CAPTCHA no se descarga`,
  scripts.some(esTurnstile),
);
comprobar(
  `script-src no autoriza ningun otro dominio de fuera: solo ${TURNSTILE}`,
  scripts.filter((valor) => /^https?:\/\//.test(valor)).every((valor) => valor === TURNSTILE),
);
comprobar(
  `frame-src es exactamente ${TURNSTILE}: el CAPTCHA es lo unico que se pinta en un iframe`,
  (directivas.get('frame-src') ?? []).join(' ') === TURNSTILE,
);
comprobar(`connect-src autoriza ${TURNSTILE}`, conexiones.some(esTurnstile));

// ----- los scripts en linea de la compilacion -----

const rutaDelHtml = 'dist/index.html';

comprobar(`existe ${rutaDelHtml}: hay que compilar antes`, existsSync(rutaDelHtml));

if (existsSync(rutaDelHtml)) {
  const html = readFileSync(rutaDelHtml, 'utf8');
  const enLinea = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    ([, cuerpo]) => `sha256-${createHash('sha256').update(cuerpo, 'utf8').digest('base64')}`,
  );
  const autorizados = scripts
    .filter((valor) => valor.startsWith("'sha256-"))
    .map((valor) => valor.slice(1, -1));

  for (const hash of enLinea) {
    comprobar(
      `el script en linea de index.html esta autorizado: falta '${hash}' en script-src (en vercel.json y en ${rutaDeNginx})`,
      autorizados.includes(hash),
    );
  }

  for (const hash of autorizados) {
    comprobar(
      `'${hash}' autoriza un script que ya no existe en index.html: hay que quitarlo`,
      enLinea.includes(hash),
    );
  }

  comprobar(
    'index.html no carga nada de otro dominio',
    !/(?:src|href)="https?:\/\/(?!www\.w3\.org)/.test(html),
  );
}

if (problemas.length > 0) {
  console.error('\nLas cabeceras de seguridad no cuadran:\n');

  for (const problema of problemas) {
    console.error(`  x ${problema}`);
  }

  console.error(`\n${problemas.length} de ${comprobaciones} comprobaciones fallaron.`);
  process.exit(1);
}

console.log(`Cabeceras de seguridad comprobadas: ${comprobaciones} comprobaciones.`);
