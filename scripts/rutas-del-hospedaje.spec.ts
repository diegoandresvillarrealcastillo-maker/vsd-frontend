import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { RUTAS } from '../src/rutas/rutas.ts';

/**
 * Las rutas que el hospedaje deja pasar a la aplicacion (SEO-02 de la auditoria 360).
 *
 * Antes, `vercel.json` y nginx mandaban TODA direccion a `index.html` con un 200:
 * una URL inventada parecia una pagina, y a Google eso le parece un «soft 404». Ahora
 * solo se reescriben las pantallas que existen y todo lo demas es un 404 de verdad.
 *
 * El riesgo de ese cambio es el contrario: una pantalla nueva en `rutas.ts` que nadie
 * agrega a las reescrituras daria un 404 en produccion, al recargar la pagina o al
 * abrir un enlace. Esta prueba lo impide: cada ruta de `rutas.ts` tiene que estar en
 * `vercel.json` y en nginx, y ninguna de las dos deja pasar una direccion inventada.
 */
const VERCEL = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};
const NGINX = readFileSync(resolve('nginx/default.conf'), 'utf8');

/**
 * Una ruta de Vercel, como expresion regular: `:id` es un tramo cualquiera, y la
 * barra final es opcional (es lo que hace Vercel por omision).
 */
function desdeVercel(origen: string): RegExp {
  return new RegExp(`^${origen.replace(/:[a-z]+/gi, '[^/]+')}/?$`);
}

/** Las expresiones de los `location ~` de nginx que reescriben a `index.html`. */
function desdeNginx(): RegExp[] {
  const bloques = [...NGINX.matchAll(/location ~ (\S+) \{\s*rewrite \^ \/index\.html last;\s*\}/g)];

  return bloques.map((bloque) => new RegExp(bloque[1] ?? ''));
}

const DE_VERCEL = VERCEL.rewrites.map((regla) => desdeVercel(regla.source));
const DE_NGINX = desdeNginx();

/** Una direccion de ejemplo de cada ruta de la aplicacion, con sus parametros llenos. */
const EJEMPLOS = (Object.values(RUTAS) as string[])
  .filter((ruta) => ruta !== RUTAS.INICIO)
  .map((ruta) => ruta.replace(/:[a-z]+/gi, 'ejemplo'));

const INVENTADAS = [
  '/aceso',
  '/panel/otro',
  '/panel.html',
  '/modulo',
  '/actividad',
  '/modulo/uno/dos',
  '/admin',
  '/wp-login.php',
  '/.env',
  '/index.html.bak',
  '/privacidad/mas',
];

describe('las reescrituras de vercel.json', () => {
  it('todas mandan a index.html', () => {
    expect(VERCEL.rewrites.length).toBeGreaterThan(0);
    expect(VERCEL.rewrites.every((regla) => regla.destination === '/index.html')).toBe(true);
  });

  it.each(EJEMPLOS)('cubren %s', (ruta) => {
    expect(DE_VERCEL.some((expresion) => expresion.test(ruta))).toBe(true);
    // Con barra final tambien: React Router la tolera y los enlaces la pueden traer.
    expect(DE_VERCEL.some((expresion) => expresion.test(`${ruta}/`))).toBe(true);
  });

  it.each(INVENTADAS)('no dejan pasar %s: es un 404', (ruta) => {
    expect(DE_VERCEL.some((expresion) => expresion.test(ruta))).toBe(false);
  });

  it('ya no hay una regla que mande todo a index.html', () => {
    expect(VERCEL.rewrites.some((regla) => regla.source === '/(.*)')).toBe(false);
  });
});

describe('las reescrituras de nginx', () => {
  it('hay reescrituras, y las encontramos', () => {
    // Si el formato de default.conf cambia y esto da cero, las pruebas de abajo
    // pasarian sin probar nada.
    expect(DE_NGINX.length).toBeGreaterThanOrEqual(2);
  });

  it.each(EJEMPLOS)('cubren %s', (ruta) => {
    expect(DE_NGINX.some((expresion) => expresion.test(ruta))).toBe(true);
    expect(DE_NGINX.some((expresion) => expresion.test(`${ruta}/`))).toBe(true);
  });

  it.each(INVENTADAS)('no dejan pasar %s: es un 404', (ruta) => {
    expect(DE_NGINX.some((expresion) => expresion.test(ruta))).toBe(false);
  });

  it('lo demas es un 404 de verdad, con su pagina', () => {
    expect(NGINX).toMatch(/location \/ \{\s*try_files \$uri \$uri\/ =404;/);
    expect(NGINX).toMatch(/error_page 404 \/404\.html;/);
    expect(NGINX).toMatch(/location = \/404\.html \{\s*internal;/);
    // El comodin antiguo, que devolvia la aplicacion con un 200 para cualquier cosa.
    expect(NGINX).not.toMatch(/try_files \$uri \/index\.html/);
  });
});

describe('las dos dicen lo mismo', () => {
  it('Vercel y nginx dejan pasar exactamente las mismas direcciones', () => {
    for (const ruta of [...EJEMPLOS, ...INVENTADAS]) {
      const enVercel = DE_VERCEL.some((expresion) => expresion.test(ruta));
      const enNginx = DE_NGINX.some((expresion) => expresion.test(ruta));

      expect(enNginx, `${ruta}: Vercel ${enVercel}, nginx ${enNginx}`).toBe(enVercel);
    }
  });
});
