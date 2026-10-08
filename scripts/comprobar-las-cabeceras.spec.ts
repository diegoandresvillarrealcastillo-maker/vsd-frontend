import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * El guardia de las cabeceras de seguridad (S-05 de la auditoria 360), probado.
 *
 * `scripts/comprobar-las-cabeceras.mjs` corre al final de cada compilacion y falla
 * si Vercel y nginx dejan de mandar lo mismo, si el script en linea de `index.html`
 * deja de estar autorizado o si la politica se afloja. Un guardia que nunca se
 * prueba falla en silencio el dia que mas hace falta, asi que aqui se le ensenan
 * cada uno de esos casos.
 *
 * Se ejecuta sobre una copia en una carpeta temporal: nunca toca `dist/` ni los
 * archivos de verdad.
 */
const SCRIPT = resolve('scripts/comprobar-las-cabeceras.mjs');
const VERCEL = readFileSync(resolve('vercel.json'), 'utf8');
const NGINX = readFileSync(resolve('nginx/cabeceras-de-seguridad.conf'), 'utf8');

/** El hash que traen los archivos de verdad, y el script de mentira que se le hace corresponder. */
const HASH_REAL = /sha256-[A-Za-z0-9+/=]+/.exec(VERCEL)?.[0] ?? '';
const SCRIPT_EN_LINEA = 'document.documentElement.dataset.tema = "claro";';
const HASH_DEL_SCRIPT = `sha256-${createHash('sha256').update(SCRIPT_EN_LINEA, 'utf8').digest('base64')}`;

let carpeta = '';

interface Archivos {
  vercel: string;
  nginx: string;
  html: string;
}

/** Los archivos buenos: los de verdad, con el hash puesto al del script de mentira. */
function buenos(): Archivos {
  return {
    vercel: VERCEL.replaceAll(HASH_REAL, HASH_DEL_SCRIPT),
    nginx: NGINX.replaceAll(HASH_REAL, HASH_DEL_SCRIPT),
    html: `<!doctype html><html><head><script>${SCRIPT_EN_LINEA}</script></head><body><script type="module" src="/assets/app.js"></script></body></html>`,
  };
}

function escribir(archivos: Archivos): void {
  mkdirSync(join(carpeta, 'nginx'), { recursive: true });
  mkdirSync(join(carpeta, 'dist'), { recursive: true });
  writeFileSync(join(carpeta, 'vercel.json'), archivos.vercel);
  writeFileSync(join(carpeta, 'nginx', 'cabeceras-de-seguridad.conf'), archivos.nginx);
  writeFileSync(join(carpeta, 'dist', 'index.html'), archivos.html);
}

/** Corre el guardia y devuelve si aprobo y lo que dijo. */
function correr(): { aprobo: boolean; salida: string } {
  try {
    const salida = execFileSync(process.execPath, [SCRIPT], { cwd: carpeta, encoding: 'utf8' });

    return { aprobo: true, salida };
  } catch (error) {
    const fallo = error as { status?: number; stderr?: string; stdout?: string };

    return { aprobo: false, salida: `${fallo.stderr ?? ''}${fallo.stdout ?? ''}` };
  }
}

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'cabeceras-'));
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe('el guardia de las cabeceras de seguridad', () => {
  it('aprueba los archivos buenos', () => {
    escribir(buenos());

    const { aprobo, salida } = correr();

    expect(salida).toContain('comprobaciones');
    expect(aprobo).toBe(true);
  });

  it('los archivos de verdad traen un hash y las cinco cabeceras', () => {
    // Si esto falla, la prueba de arriba no esta probando lo que cree.
    expect(HASH_REAL).toMatch(/^sha256-/);

    for (const nombre of [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Content-Security-Policy-Report-Only',
    ]) {
      expect(VERCEL).toContain(nombre);
      expect(NGINX).toContain(nombre);
    }
  });

  it('falla si nginx y Vercel dejan de decir lo mismo', () => {
    const archivos = buenos();

    escribir({ ...archivos, nginx: archivos.nginx.replace('"DENY"', '"SAMEORIGIN"') });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/X-Frame-Options vale lo mismo en Vercel y en nginx/);
  });

  it('falla si falta una cabecera en nginx', () => {
    const archivos = buenos();

    escribir({
      ...archivos,
      nginx: archivos.nginx
        .split('\n')
        .filter((linea) => !linea.startsWith('add_header Referrer-Policy'))
        .join('\n'),
    });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/nginx manda Referrer-Policy/);
  });

  it('falla si el script en linea cambia y su hash ya no vale, y dice cual es el bueno', () => {
    const archivos = buenos();

    escribir({
      ...archivos,
      html: archivos.html.replace(
        SCRIPT_EN_LINEA,
        'document.documentElement.dataset.tema = "oscuro";',
      ),
    });

    const { aprobo, salida } = correr();
    const nuevo = `sha256-${createHash('sha256')
      .update('document.documentElement.dataset.tema = "oscuro";', 'utf8')
      .digest('base64')}`;

    expect(aprobo).toBe(false);
    expect(salida).toContain(`falta '${nuevo}'`);
  });

  it('falla si queda un hash que autoriza un script que ya no existe', () => {
    const archivos = buenos();

    escribir({
      ...archivos,
      html: '<!doctype html><html><body><script type="module" src="/a.js"></script></body></html>',
    });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/autoriza un script que ya no existe/);
  });

  it.each([
    ["'unsafe-eval'", "script-src 'self'", "script-src 'self' 'unsafe-eval'"],
    ["'unsafe-inline'", "script-src 'self'", "script-src 'self' 'unsafe-inline'"],
    ['un comodin', "script-src 'self'", "script-src 'self' *"],
    ['https: entero', "script-src 'self'", "script-src 'self' https:"],
  ])('falla si script-src admite %s', (_nombre, antes, despues) => {
    const archivos = buenos();

    // Se cambia en las dos copias: lo que se prueba es la politica, no la
    // diferencia entre ellas.
    escribir({
      ...archivos,
      vercel: archivos.vercel.replace(antes, despues),
      nginx: archivos.nginx.replace(antes, despues),
    });

    const { aprobo } = correr();

    expect(aprobo).toBe(false);
  });

  it('falla si la politica vuelve a abrirle la puerta a Google Fonts', () => {
    const archivos = buenos();
    const cambiar = (texto: string) =>
      texto.replace("font-src 'self'", "font-src 'self' https://fonts.gstatic.com");

    escribir({ ...archivos, vercel: cambiar(archivos.vercel), nginx: cambiar(archivos.nginx) });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/Google Fonts/);
  });

  it.each([
    ['frame-ancestors', "frame-ancestors 'none'", "frame-ancestors 'self'"],
    ['object-src', "object-src 'none'", "object-src 'self'"],
    ['base-uri', "base-uri 'self'", 'base-uri *'],
  ])('falla si %s se afloja', (nombre, antes, despues) => {
    const archivos = buenos();

    escribir({
      ...archivos,
      vercel: archivos.vercel.replace(antes, despues),
      nginx: archivos.nginx.replace(antes, despues),
    });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toContain(`la politica dice ${nombre}`);
  });

  describe('el CAPTCHA de Cloudflare Turnstile (SCRUM-165)', () => {
    const TURNSTILE = 'https://challenges.cloudflare.com';

    function sin(texto: string, directiva: RegExp): string {
      return texto.replace(directiva, '');
    }

    it('los archivos de verdad lo autorizan en script-src, frame-src y connect-src', () => {
      for (const archivo of [VERCEL, NGINX]) {
        expect(archivo).toMatch(new RegExp(`script-src [^;]*${TURNSTILE}`));
        expect(archivo).toMatch(new RegExp(`connect-src [^;]*${TURNSTILE}`));
        expect(archivo).toContain(`frame-src ${TURNSTILE};`);
      }
    });

    it.each([
      ['script-src', new RegExp(` ${TURNSTILE}(?=; style-src)`), /script-src autoriza/],
      ['connect-src', new RegExp(` ${TURNSTILE}(?=; frame-src)`), /connect-src autoriza/],
      ['frame-src', new RegExp(` frame-src ${TURNSTILE};`), /frame-src es exactamente/],
    ])('falla si deja de autorizarlo en %s', (_directiva, quitar, mensaje) => {
      const archivos = buenos();

      escribir({
        ...archivos,
        vercel: sin(archivos.vercel, quitar),
        nginx: sin(archivos.nginx, quitar),
      });

      const { aprobo, salida } = correr();

      expect(aprobo).toBe(false);
      expect(salida).toMatch(mensaje);
    });

    it('falla si se cuela otro dominio de fuera en script-src', () => {
      const archivos = buenos();
      const cambiar = (texto: string) =>
        texto.replace(`'self' 'sha256-`, `'self' https://cdn.ejemplo.co 'sha256-`);

      escribir({ ...archivos, vercel: cambiar(archivos.vercel), nginx: cambiar(archivos.nginx) });

      const { aprobo, salida } = correr();

      expect(aprobo).toBe(false);
      expect(salida).toMatch(/ningun otro dominio de fuera/);
    });

    it('falla si frame-src admite algo mas que Turnstile', () => {
      const archivos = buenos();
      const cambiar = (texto: string) =>
        texto.replace(`frame-src ${TURNSTILE};`, `frame-src ${TURNSTILE} https://www.youtube.com;`);

      escribir({ ...archivos, vercel: cambiar(archivos.vercel), nginx: cambiar(archivos.nginx) });

      const { aprobo, salida } = correr();

      expect(aprobo).toBe(false);
      expect(salida).toMatch(/frame-src es exactamente/);
    });
  });

  it('falla si index.html empieza a cargar algo de otro dominio', () => {
    const archivos = buenos();

    escribir({
      ...archivos,
      html: archivos.html.replace(
        '</head>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2"></head>',
      ),
    });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/no carga nada de otro dominio/);
  });

  it('falla si no se ha compilado todavia', () => {
    const archivos = buenos();

    escribir(archivos);
    rmSync(join(carpeta, 'dist'), { recursive: true, force: true });

    const { aprobo, salida } = correr();

    expect(aprobo).toBe(false);
    expect(salida).toMatch(/hay que compilar antes/);
  });
});
