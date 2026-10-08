import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * El modulo lee la configuracion al importarse, asi que cada caso necesita
 * una importacion nueva. `resetModules` descarta la copia anterior; sin eso
 * todas las pruebas verian el valor de la primera.
 */
async function cargarEntorno() {
  vi.resetModules();
  return import('./entorno.ts');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('entorno', () => {
  it('toma development cuando no se indica ambiente', async () => {
    vi.stubEnv('VITE_APP_ENV', '');

    const { entorno } = await cargarEntorno();

    expect(entorno.nombre).toBe('development');
    expect(entorno.esDesarrollo).toBe(true);
    expect(entorno.esProduccion).toBe(false);
  });

  it('reconoce preproduccion y produccion', async () => {
    vi.stubEnv('VITE_APP_ENV', 'production');

    const { entorno } = await cargarEntorno();

    expect(entorno.nombre).toBe('production');
    expect(entorno.esProduccion).toBe(true);
  });

  it('se niega a cargar con un ambiente que no existe', async () => {
    // Un "produccion" mal escrito no puede pasar por desarrollo en silencio:
    // el ambiente decide, entre otras cosas, contra que base se habla.
    vi.stubEnv('VITE_APP_ENV', 'produccion');

    await expect(cargarEntorno()).rejects.toThrow(/no es ninguno de/);
  });

  it('quita la barra final de la URL de la API', async () => {
    vi.stubEnv('VITE_APP_ENV', 'development');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.ejemplo.test///');

    const { entorno } = await cargarEntorno();

    // Sin esto, concatenar da https://api.ejemplo.test///api/resultados.
    expect(entorno.urlDeLaApi).toBe('https://api.ejemplo.test');
  });
});

describe('credencialesDeSupabase', () => {
  it('devuelve las credenciales cuando estan completas', async () => {
    vi.stubEnv('VITE_APP_ENV', 'development');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proyecto.ejemplo.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave-de-prueba');

    const { credencialesDeSupabase } = await cargarEntorno();

    expect(credencialesDeSupabase()).toEqual({
      url: 'https://proyecto.ejemplo.test',
      claveAnonima: 'clave-de-prueba',
    });
  });

  it('dice cual falta en vez de devolver algo vacio', async () => {
    vi.stubEnv('VITE_APP_ENV', 'development');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proyecto.ejemplo.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { credencialesDeSupabase } = await cargarEntorno();

    // Un cliente de Supabase construido con una clave vacia falla mucho mas
    // tarde y con un mensaje que no lleva a ninguna parte.
    expect(() => credencialesDeSupabase()).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('no acepta espacios en blanco como valor', async () => {
    vi.stubEnv('VITE_APP_ENV', 'development');
    vi.stubEnv('VITE_SUPABASE_URL', '   ');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave-de-prueba');

    const { credencialesDeSupabase } = await cargarEntorno();

    expect(() => credencialesDeSupabase()).toThrow(/VITE_SUPABASE_URL/);
  });
});

describe('la clave de Turnstile (SCRUM-165)', () => {
  it('sin la variable no hay CAPTCHA', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');

    const { entorno } = await cargarEntorno();

    expect(entorno.captcha.claveDelSitio).toBeNull();
  });

  it.each([
    ['una clave de verdad', '0x4AAAAAAABkMYinukE8nzYxQ'],
    ['la de prueba que siempre pasa', '1x00000000000000000000AA'],
    ['la de prueba que siempre bloquea', '2x00000000000000000000AB'],
    ['la de prueba que pide interaccion', '3x00000000000000000000FF'],
  ])('acepta %s', async (_cual, clave) => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', clave);

    const { entorno } = await cargarEntorno();

    expect(entorno.captcha.claveDelSitio).toBe(clave);
  });

  it('quita los espacios de alrededor', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '  1x00000000000000000000AA \n');

    const { entorno } = await cargarEntorno();

    expect(entorno.captcha.claveDelSitio).toBe('1x00000000000000000000AA');
  });

  it.each([
    ['con espacios dentro', '1x0000000000 0000000000AA'],
    ['demasiado corta', '0x4AAAA'],
    ['sin la x', '04AAAAAAABkMYinukE8nzYxQ'],
    [
      'la clave secreta de prueba, que no es de sitio',
      'secreto-que-no-tiene-la-forma-de-una-clave',
    ],
    ['con caracteres raros', '0x4AAAAAAABkMYinukE8nz<script>'],
  ])('trata como ausente una clave %s, y avisa', async (_cual, clave) => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', clave);

    const { entorno } = await cargarEntorno();

    expect(entorno.captcha.claveDelSitio).toBeNull();
    expect(aviso).toHaveBeenCalledOnce();
    // El aviso dice cual variable es, no repite lo que se puso: podria ser un secreto
    // pegado donde no va.
    expect(String(aviso.mock.calls[0]?.[0])).toContain('VITE_TURNSTILE_SITE_KEY');
    expect(String(aviso.mock.calls[0]?.[0])).not.toContain(clave);

    aviso.mockRestore();
  });

  it('una variable vacia no avisa: es no querer CAPTCHA', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '   ');
    await cargarEntorno();

    expect(aviso).not.toHaveBeenCalled();

    aviso.mockRestore();
  });
});
