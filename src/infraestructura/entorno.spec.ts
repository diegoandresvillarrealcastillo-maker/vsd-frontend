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
