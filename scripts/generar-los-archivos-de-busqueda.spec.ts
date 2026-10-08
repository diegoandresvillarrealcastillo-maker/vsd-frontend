import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RUTAS } from '../src/rutas/rutas.ts';

/**
 * Los archivos para buscadores (SEO-02 de la auditoria 360), probados.
 *
 * `scripts/generar-los-archivos-de-busqueda.mjs` escribe robots.txt, sitemap.xml,
 * llms.txt y la pagina 404 al final de cada compilacion. Lo que sale depende del
 * ambiente, y equivocarse en un sentido es grave: dejar PRE abierto a los
 * buscadores, o cerrar produccion. Se ejecuta de verdad, en una carpeta temporal,
 * con las variables que tendria cada ambiente.
 */
const SCRIPT = resolve('scripts/generar-los-archivos-de-busqueda.mjs');
const DOMINIO = 'https://vsdhealth.example';

let carpeta = '';

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'buscadores-'));
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

function correr(variables: Record<string, string>): { aprobo: boolean; salida: string } {
  try {
    const salida = execFileSync(process.execPath, [SCRIPT], {
      cwd: carpeta,
      encoding: 'utf8',
      // Un entorno limpio: ni VITE_APP_ENV ni VITE_URL_PUBLICA de quien corre la prueba.
      env: { PATH: process.env.PATH ?? '', ...variables },
    });

    return { aprobo: true, salida };
  } catch (error) {
    const fallo = error as { stderr?: string; stdout?: string };

    return { aprobo: false, salida: `${fallo.stderr ?? ''}${fallo.stdout ?? ''}` };
  }
}

function leer(nombre: string): string {
  return readFileSync(join(carpeta, 'dist', nombre), 'utf8');
}

function hay(nombre: string): boolean {
  return existsSync(join(carpeta, 'dist', nombre));
}

/**
 * Que es cada ruta de la aplicacion para un buscador. Una ruta nueva en `rutas.ts`
 * sin una fila aqui hace fallar la prueba de abajo: hay que decidir si se indexa,
 * si se cierra o si es de acceso, y no dejarlo al azar.
 */
const CLASIFICACION: Readonly<Record<string, 'publica' | 'privada' | 'de-acceso'>> = {
  [RUTAS.INICIO]: 'publica',
  [RUTAS.PRIVACIDAD]: 'publica',
  [RUTAS.TERMINOS]: 'publica',
  [RUTAS.COOKIES]: 'publica',
  [RUTAS.ACCESO]: 'de-acceso',
  [RUTAS.REGISTRO]: 'de-acceso',
  [RUTAS.RECUPERAR]: 'de-acceso',
  [RUTAS.CONTRASENA_NUEVA]: 'privada',
  [RUTAS.PANEL]: 'privada',
  [RUTAS.PERFIL]: 'privada',
  [RUTAS.DIARIO]: 'privada',
  [RUTAS.MODULO]: 'privada',
  [RUTAS.ACTIVIDAD]: 'privada',
};

/** `/modulo/:modulo` queda en `/modulo/`: se cierra todo lo que cuelga de ahi. */
const prefijo = (ruta: string): string =>
  ruta.includes(':') ? ruta.slice(0, ruta.indexOf(':')) : ruta;

describe('en produccion', () => {
  const produccion = { VITE_APP_ENV: 'production', VITE_URL_PUBLICA: DOMINIO };

  it('escribe los cuatro archivos', () => {
    const { aprobo } = correr(produccion);

    expect(aprobo).toBe(true);
    for (const nombre of ['robots.txt', 'sitemap.xml', 'llms.txt', '404.html']) {
      expect(hay(nombre), nombre).toBe(true);
    }
  });

  it('robots.txt permite la raiz, cierra lo privado y apunta al sitemap con direccion completa', () => {
    correr(produccion);

    const robots = leer('robots.txt');

    expect(robots).toContain('User-agent: *');
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toContain(`Sitemap: ${DOMINIO}/sitemap.xml`);

    for (const ruta of [
      '/panel',
      '/perfil',
      '/diario',
      '/modulo/',
      '/actividad/',
      '/contrasena-nueva',
    ]) {
      expect(robots, ruta).toContain(`Disallow: ${ruta}`);
    }
  });

  it('el sitemap lleva solo las paginas publicas, con direccion completa', () => {
    correr(produccion);

    const sitemap = leer('sitemap.xml');
    const direcciones = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((una) => una[1]);

    expect(direcciones).toEqual([
      `${DOMINIO}/`,
      `${DOMINIO}/privacidad`,
      `${DOMINIO}/terminos`,
      `${DOMINIO}/cookies`,
    ]);
    expect(sitemap).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
  });

  it('el sitemap y el robots no se contradicen: nada de lo que se indexa esta cerrado', () => {
    correr(produccion);

    const cerradas = [...leer('robots.txt').matchAll(/^Disallow: (\S+)$/gm)].map(
      (una) => una[1] ?? '',
    );
    const indexables = [...leer('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (una) => new URL(una[1] ?? '').pathname,
    );

    for (const ruta of indexables) {
      expect(
        cerradas.some((cerrada) => ruta.startsWith(cerrada)),
        `${ruta} esta en el sitemap pero robots.txt la cierra`,
      ).toBe(false);
    }
  });

  it('cada ruta de la aplicacion tiene decidido que es, y el robots y el sitemap lo cumplen', () => {
    correr(produccion);

    const robots = leer('robots.txt');
    const sitemap = leer('sitemap.xml');
    const todas = Object.values(RUTAS) as string[];

    // Una ruta nueva sin clasificar hace fallar esto: hay que decidir.
    expect(Object.keys(CLASIFICACION).sort()).toEqual([...todas].sort());

    for (const ruta of todas) {
      const clase = CLASIFICACION[ruta];

      if (clase === 'publica') {
        expect(sitemap, ruta).toContain(`<loc>${DOMINIO}${ruta}</loc>`);
      } else if (clase === 'privada') {
        expect(robots, ruta).toContain(`Disallow: ${prefijo(ruta)}`);
        expect(sitemap, ruta).not.toContain(prefijo(ruta));
      } else {
        expect(sitemap, ruta).not.toContain(`<loc>${DOMINIO}${ruta}</loc>`);
      }
    }
  });

  it('llms.txt cuenta que es, que es para mayores de 18, que no diagnostica y las lineas', () => {
    correr(produccion);

    const llms = leer('llms.txt');

    expect(llms.startsWith('# VSD Health')).toBe(true);
    expect(llms).toContain('solo para mayores de 18 años');
    expect(llms).toMatch(/No diagnostica/);
    expect(llms).toContain('Línea 192, opción 4');
    expect(llms).toContain('Línea 123');
    expect(llms).toContain(`[Política de privacidad](${DOMINIO}/privacidad)`);
    expect(llms).toContain(`(${DOMINIO}/terminos)`);
    expect(llms).toContain(`(${DOMINIO}/cookies)`);
  });

  it('no promete lo que la aplicacion no hace', () => {
    correr(produccion);

    const llms = leer('llms.txt');

    // La portada se compromete a no mostrar un nivel clinico ni comparar: el
    // archivo que leen los asistentes de IA no puede decir otra cosa.
    expect(llms).not.toMatch(/diagnostica con|detecta|tratamiento|terapia|cura/i);
    expect(llms).not.toMatch(/tus datos (est[aá]n|quedan) (a salvo|seguros|protegidos)/i);
  });

  it('la pagina 404 es estatica, con noindex y una salida', () => {
    correr(produccion);

    const pagina = leer('404.html');

    expect(pagina).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(pagina).toContain('href="/"');
    // Sin JavaScript: es un 404, no la aplicacion cargando para redirigir.
    expect(pagina).not.toMatch(/<script/i);
  });

  it('quita la barra final del dominio', () => {
    correr({ ...produccion, VITE_URL_PUBLICA: `${DOMINIO}/` });

    expect(leer('robots.txt')).toContain(`Sitemap: ${DOMINIO}/sitemap.xml`);
    expect(leer('sitemap.xml')).not.toContain('//privacidad');
  });

  it('falla, y lo dice, si falta el dominio', () => {
    const { aprobo, salida } = correr({ VITE_APP_ENV: 'production' });

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/Falta VITE_URL_PUBLICA/);
    expect(hay('sitemap.xml')).toBe(false);
  });

  it.each([
    ['sin https', 'http://vsdhealth.example'],
    ['con una ruta', `${DOMINIO}/inicio`],
    ['con consulta', `${DOMINIO}/?a=1`],
    ['que no es una direccion', 'vsdhealth.example'],
  ])('falla con un dominio %s', (_caso, dominio) => {
    const { aprobo, salida } = correr({ ...produccion, VITE_URL_PUBLICA: dominio });

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/VITE_URL_PUBLICA/);
  });
});

describe.each(['preproduction', 'development'])('en %s', (ambiente) => {
  // PRE tiene cuentas y datos de prueba: que un buscador lo indexe no le sirve a nadie.
  it('cierra todo a los buscadores y no publica sitemap', () => {
    const { aprobo } = correr({ VITE_APP_ENV: ambiente });

    expect(aprobo).toBe(true);
    expect(leer('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
    expect(hay('sitemap.xml')).toBe(false);
  });

  it('el llms.txt dice que no es publico y no enlaza nada', () => {
    correr({ VITE_APP_ENV: ambiente });

    const llms = leer('llms.txt');

    expect(llms).toContain('ambiente de pruebas');
    expect(llms).not.toMatch(/https?:/);
  });

  it('no necesita el dominio', () => {
    expect(correr({ VITE_APP_ENV: ambiente }).aprobo).toBe(true);
  });

  it('tambien tiene su pagina 404', () => {
    correr({ VITE_APP_ENV: ambiente });

    expect(leer('404.html')).toContain('noindex');
  });
});

describe('el ambiente', () => {
  it('sin VITE_APP_ENV se trata como desarrollo: cerrado, nunca abierto', () => {
    const { aprobo } = correr({});

    expect(aprobo).toBe(true);
    expect(leer('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('un valor que no existe falla en vez de abrir el sitio por descuido', () => {
    const { aprobo, salida } = correr({ VITE_APP_ENV: 'produccion' });

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/no es ninguno de/);
    expect(hay('robots.txt')).toBe(false);
  });
});
