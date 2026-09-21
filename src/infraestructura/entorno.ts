/**
 * La configuracion del frontend, leida y comprobada en un solo sitio.
 *
 * El backend se niega a arrancar si le falta una variable, y aqui se sigue el
 * mismo criterio por la misma razon: es preferible un error que dice cual
 * falta, a una aplicacion que arranca a medias y falla mas tarde con un
 * mensaje que no lleva a ninguna parte.
 *
 * La diferencia es cuando se comprueba cada cosa. Lo que la aplicacion
 * necesita para pintar la primera pantalla se comprueba al cargar; lo de
 * Supabase se comprueba cuando se va a usar, porque quien acaba de clonar el
 * repositorio merece poder ver algo antes de haber configurado nada.
 */

export const AMBIENTES = ['development', 'preproduction', 'production'] as const;
export type Ambiente = (typeof AMBIENTES)[number];

function esAmbiente(valor: string): valor is Ambiente {
  return (AMBIENTES as readonly string[]).includes(valor);
}

// El valor se pasa como argumento en lugar de leerlo aqui con
// `import.meta.env[nombre]`. Vite declara un indice abierto sobre ese objeto,
// asi que el acceso por variable devuelve `any` y se pierde la comprobacion
// justo en la funcion que existe para comprobar.
function exigir(nombre: keyof ImportMetaEnv, valor: string | undefined): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example como .env.local y completala.`,
    );
  }

  return valor.trim();
}

const nombreDeAmbiente = import.meta.env.VITE_APP_ENV?.trim() || 'development';

if (!esAmbiente(nombreDeAmbiente)) {
  throw new Error(
    `VITE_APP_ENV tiene el valor "${nombreDeAmbiente}", que no es ninguno de: ${AMBIENTES.join(', ')}.`,
  );
}

export const entorno = {
  nombre: nombreDeAmbiente,
  esDesarrollo: nombreDeAmbiente === 'development',
  esProduccion: nombreDeAmbiente === 'production',

  /** URL base de la API. Sin barra final, para poder concatenar sin dudar. */
  urlDeLaApi: (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  ),
} as const;

/**
 * Las credenciales publicas de Supabase.
 *
 * Se piden aqui y no en el objeto de arriba porque solo hacen falta cuando
 * alguien va a autenticarse. Si faltan, el error dice exactamente cual y que
 * hacer, en vez de dejar una pantalla en blanco.
 */
export function credencialesDeSupabase(): { url: string; claveAnonima: string } {
  return {
    url: exigir('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
    claveAnonima: exigir('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  };
}
