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

/**
 * Una clave de sitio de Cloudflare Turnstile tiene un `0`, `1`, `2` o `3`, una `x`
 * y entre 16 y 40 caracteres: las de verdad empiezan por `0x4` y las de prueba
 * de Cloudflare por `1x`, `2x` y `3x`.
 */
const FORMA_DE_LA_CLAVE_DE_TURNSTILE = /^[0-3]x[A-Za-z0-9_-]{16,40}$/;

/**
 * La clave **del sitio** de Turnstile (SCRUM-165), o `null` si no hay CAPTCHA.
 *
 * Es publica por diseno: viaja al navegador en cada pagina con CAPTCHA. La clave
 * **secreta** es otra, vive solo en el panel de Supabase y nunca llega aqui.
 *
 * Una clave con mala forma se trata como si no hubiera y avisa en la consola. Es
 * preferible no mostrar el CAPTCHA a mostrar un widget que Cloudflare va a
 * rechazar, dejando a nadie pasar. Pero hay que saberlo: por eso avisa.
 */
export function leerLaClaveDeTurnstile(valor: string | undefined): string | null {
  const limpia = valor?.trim() ?? '';

  if (limpia === '') {
    return null;
  }

  if (!FORMA_DE_LA_CLAVE_DE_TURNSTILE.test(limpia)) {
    console.warn(
      'VITE_TURNSTILE_SITE_KEY no tiene la forma de una clave de sitio de Cloudflare Turnstile: el CAPTCHA queda apagado.',
    );

    return null;
  }

  return limpia;
}

export const entorno = {
  nombre: nombreDeAmbiente,
  esDesarrollo: nombreDeAmbiente === 'development',
  esProduccion: nombreDeAmbiente === 'production',

  /**
   * Si se ofrece entrar con Google.
   *
   * Activarlo no cuesta dinero —ni Google ni Supabase cobran por el inicio de
   * sesion— pero **si depende de un tramite**: alguien con permisos de
   * administrador tiene que crear el proyecto en Google Cloud, generar las
   * credenciales de OAuth y registrar una URL de redireccion por ambiente.
   *
   * Mientras ese tramite no este hecho, el boton no se muestra. Ensenar un
   * boton que lleva a una pantalla de error de Google es peor que no
   * ensenarlo: quien lo pulse va a pensar que la aplicacion esta rota.
   *
   * Cuando las credenciales existan, se pone esta variable en `si` y el boton
   * aparece sin tocar una linea de codigo.
   */
  conGoogle: import.meta.env.VITE_PROVEEDOR_GOOGLE?.trim() === 'si',

  /**
   * El CAPTCHA de registro, acceso y recuperacion (SCRUM-165).
   *
   * Sin clave del sitio **no hay CAPTCHA**: las tres pantallas funcionan como
   * antes. Es lo que permite desplegar este codigo **antes** de activar el
   * CAPTCHA en Supabase, que es el orden obligatorio: al reves, nadie podria
   * entrar, porque Supabase exigiria un token que el navegador no sabe pedir.
   */
  captcha: {
    claveDelSitio: leerLaClaveDeTurnstile(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  },

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
