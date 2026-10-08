// Genera lo que los buscadores y los asistentes de IA leen: robots.txt, sitemap.xml,
// llms.txt y la pagina 404 (SEO-02 de la auditoria 360).
//
// Se ejecuta al final de `npm run build`, sobre `dist/`, y su resultado depende del
// ambiente (`VITE_APP_ENV`):
//
// - **production**: robots.txt que permite la portada y los documentos legales y
//   cierra lo privado; sitemap.xml con las paginas publicas; llms.txt que cuenta
//   que es VSD Health. Exige `VITE_URL_PUBLICA` (el dominio, con https): un sitemap
//   con direcciones relativas no sirve, y generarlo sin dominio en silencio seria
//   publicar un archivo roto sin enterarse.
//
// - **cualquier otro (development, preproduction)**: robots.txt que lo cierra TODO,
//   sin sitemap, y un llms.txt que dice que el ambiente no es publico. PRE tiene
//   cuentas de prueba y datos de prueba: que Google lo indexe no le sirve a nadie.
//   Es una de tres capas (las otras: la etiqueta `noindex` del HTML y la cabecera
//   `X-Robots-Tag` que manda Vercel en PRE y en las vistas previas de las ramas).
//
// Nunca falla por falta de dominio fuera de produccion: ahi no se usa.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Las paginas que se pueden indexar: la portada y los documentos legales. */
export const PAGINAS_PUBLICAS = [
  { ruta: '/', nombre: 'Inicio', descripcion: 'Qué es VSD Health, para quién es y qué no hace.' },
  {
    ruta: '/privacidad',
    nombre: 'Política de privacidad',
    descripcion: 'Qué datos guardamos, para qué, por cuánto tiempo y cómo borrarlos.',
  },
  {
    ruta: '/terminos',
    nombre: 'Términos y condiciones',
    descripcion: 'Las condiciones de uso de la aplicación.',
  },
  {
    ruta: '/cookies',
    nombre: 'Política de cookies',
    descripcion: 'Qué guarda la aplicación en tu navegador y por qué.',
  },
];

/**
 * Lo que se cierra a los buscadores: lo que solo existe con una cuenta. No hay nada
 * que ver ahi sin sesion, y un enlace compartido por error no tiene que acabar en
 * un resultado de busqueda.
 */
export const RUTAS_PRIVADAS = [
  '/panel',
  '/perfil',
  '/diario',
  '/modulo/',
  '/actividad/',
  '/contrasena-nueva',
  '/completa-tu-registro',
];

const ENTORNOS = ['development', 'preproduction', 'production'];

/** El dominio sin barra final, o lanza si falta o no es una direccion https. */
export function dominioPublico(valor) {
  const texto = (valor ?? '').trim().replace(/\/+$/, '');

  if (texto === '') {
    throw new Error(
      'Falta VITE_URL_PUBLICA. Con VITE_APP_ENV=production hace falta el dominio (por ejemplo ' +
        'https://vsdhealth.example) para escribir el sitemap y el llms.txt con direcciones completas.',
    );
  }

  let url;

  try {
    url = new URL(texto);
  } catch {
    throw new Error(`VITE_URL_PUBLICA no es una direccion: "${texto}".`);
  }

  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(
      `VITE_URL_PUBLICA tiene que ser solo el dominio con https, sin ruta ni consulta: "${texto}".`,
    );
  }

  return url.origin;
}

export function robotsDeProduccion(dominio) {
  return [
    'User-agent: *',
    'Allow: /',
    ...RUTAS_PRIVADAS.map((ruta) => `Disallow: ${ruta}`),
    '',
    `Sitemap: ${dominio}/sitemap.xml`,
    '',
  ].join('\n');
}

export function robotsCerrado() {
  return ['User-agent: *', 'Disallow: /', ''].join('\n');
}

export function sitemap(dominio) {
  const direcciones = PAGINAS_PUBLICAS.map(
    ({ ruta }) => `  <url>\n    <loc>${dominio}${ruta}</loc>\n  </url>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...direcciones,
    '</urlset>',
    '',
  ].join('\n');
}

export function llmsDeProduccion(dominio) {
  const enlaces = PAGINAS_PUBLICAS.map(
    ({ ruta, nombre, descripcion }) => `- [${nombre}](${dominio}${ruta}): ${descripcion}`,
  );

  return [
    '# VSD Health',
    '',
    '> VSD Health es una aplicación web de acompañamiento del bienestar emocional y cognitivo. ' +
      'Es solo para mayores de 18 años. No diagnostica, no formula medicamentos y no reemplaza ' +
      'la atención de psicólogos, médicos ni psiquiatras.',
    '',
    '## Qué es',
    '',
    'Una herramienta de uso personal: actividades cortas, un diario y un semáforo de pendientes ' +
      'para llevar el día a día. Los resultados son orientativos, no un diagnóstico.',
    '',
    '## Qué no hace',
    '',
    '- No diagnostica ni da un nivel clínico.',
    '- No compara a una persona con otras.',
    '- No reemplaza la ayuda profesional.',
    '',
    '## Tus datos',
    '',
    'Cada persona puede descargar o borrar sus datos desde su perfil. Los detalles están en la ' +
      `[política de privacidad](${dominio}/privacidad).`,
    '',
    '## Si estás pasando un mal momento (Colombia)',
    '',
    '- Línea 192, opción 4: orientación en salud mental del Ministerio de Salud, en todo el país.',
    '- Línea 123: línea única de emergencias, si hay riesgo inmediato para la vida de alguien.',
    '',
    '## Páginas públicas',
    '',
    ...enlaces,
    '',
  ].join('\n');
}

export function llmsCerrado() {
  return [
    '# VSD Health (ambiente de pruebas)',
    '',
    '> Este ambiente no es público y no hay nada que indexar ni citar.',
    '',
  ].join('\n');
}

/**
 * La pagina de una direccion que no existe. Estatica y sin JavaScript: es un 404 de
 * verdad (Vercel y nginx la sirven con ese estado), no la aplicacion cargando para
 * redirigir a la portada, que es lo que hacia una respuesta 200 a cualquier cosa.
 */
export function paginaNoEncontrada() {
  return `<!doctype html>
<html lang="es-CO">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>No encontramos esta página · VSD Health</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
        font: 1.05rem/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #f5f3ee; color: #1d2420; }
      main { max-width: 32rem; }
      h1 { margin: 0 0 12px; font-size: 1.6rem; line-height: 1.2; }
      p { margin: 0 0 20px; }
      a { color: #2f6b55; font-weight: 600; text-underline-offset: 3px; }
      @media (prefers-color-scheme: dark) {
        body { background: #151c19; color: #f0eee5; }
        a { color: #a5cbb2; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>No encontramos esta página</h1>
      <p>La dirección no existe o cambió de lugar. Puedes volver al inicio y seguir desde ahí.</p>
      <p><a href="/">Volver al inicio</a></p>
    </main>
  </body>
</html>
`;
}

/** Lo que se escribe en `dist/`, segun el ambiente. Un objeto `{ nombreDeArchivo: texto }`. */
export function archivosPara(ambiente, urlPublica) {
  if (!ENTORNOS.includes(ambiente)) {
    throw new Error(
      `VITE_APP_ENV tiene el valor "${ambiente}", que no es ninguno de: ${ENTORNOS.join(', ')}.`,
    );
  }

  if (ambiente !== 'production') {
    return {
      'robots.txt': robotsCerrado(),
      'llms.txt': llmsCerrado(),
      '404.html': paginaNoEncontrada(),
    };
  }

  const dominio = dominioPublico(urlPublica);

  return {
    'robots.txt': robotsDeProduccion(dominio),
    'sitemap.xml': sitemap(dominio),
    'llms.txt': llmsDeProduccion(dominio),
    '404.html': paginaNoEncontrada(),
  };
}

function principal() {
  const ambiente = (process.env.VITE_APP_ENV ?? '').trim() || 'development';
  const archivos = archivosPara(ambiente, process.env.VITE_URL_PUBLICA);

  mkdirSync('dist', { recursive: true });

  for (const [nombre, texto] of Object.entries(archivos)) {
    writeFileSync(join('dist', nombre), texto, 'utf8');
  }

  console.log(`Archivos para buscadores (${ambiente}): ${Object.keys(archivos).join(', ')}.`);
}

try {
  // Solo al ejecutarlo, no al importarlo.
  if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    principal();
  }
} catch (error) {
  console.error(`\nNo se pudieron generar los archivos para buscadores:\n  x ${error.message}\n`);
  process.exit(1);
}
