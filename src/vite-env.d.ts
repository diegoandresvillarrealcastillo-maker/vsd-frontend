/// <reference types="vite/client" />

/**
 * Las variables de entorno que el frontend conoce.
 *
 * Declararlas aqui hace que `import.meta.env.VITE_ALGO_MAL_ESCRITO` sea un
 * error de compilacion en vez de un `undefined` que aparece en tiempo de
 * ejecucion, normalmente en el peor momento.
 *
 * Solo pueden existir variables publicas: Vite incrusta en el paquete final
 * TODA variable que empiece por VITE_, y cualquiera puede leerlas abriendo el
 * navegador. Ver la advertencia de .env.example.
 */
interface ImportMetaEnv {
  /** URL base de la API de vsd-backend. */
  readonly VITE_API_BASE_URL: string;

  /** URL publica del proyecto de Supabase. */
  readonly VITE_SUPABASE_URL: string;

  /** Clave anonima de Supabase. Publica por diseno. */
  readonly VITE_SUPABASE_ANON_KEY: string;

  /** development | preproduction | production */
  readonly VITE_APP_ENV: string;

  /** `si` para ofrecer entrar con Google. Cualquier otro valor lo oculta. */
  readonly VITE_PROVEEDOR_GOOGLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
