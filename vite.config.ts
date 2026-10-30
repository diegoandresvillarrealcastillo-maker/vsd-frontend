import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// Se importa desde 'vitest/config' y no desde 'vite' porque es la variante que
// conoce el bloque `test`. Con la de 'vite' el archivo compila igual, pero
// TypeScript deja de revisar esa parte y un nombre mal escrito pasa sin aviso.
import { defineConfig } from 'vitest/config';

/**
 * Fuera de produccion, la pagina le dice a los buscadores que no la indexen
 * (SEO-02). Es una de tres capas: tambien lo dicen `robots.txt` (que genera
 * `scripts/generar-los-archivos-de-busqueda.mjs`) y la cabecera `X-Robots-Tag` que
 * Vercel manda en PRE y en las vistas previas de las ramas.
 *
 * Se decide con `VITE_APP_ENV` y no con `mode`: PRE se compila con `mode`
 * `production`, igual que PROD, y lo unico que los distingue es esa variable.
 * Sin ella, es desarrollo: cerrado, nunca abierto por descuido.
 */
function noIndexarFueraDeProduccion(mode: string): Plugin {
  const ambiente = loadEnv(mode, process.cwd(), 'VITE_').VITE_APP_ENV?.trim() || 'development';

  return {
    name: 'no-indexar-fuera-de-produccion',
    transformIndexHtml: () =>
      ambiente === 'production'
        ? []
        : [
            {
              tag: 'meta',
              attrs: { name: 'robots', content: 'noindex, nofollow' },
              injectTo: 'head-prepend',
            },
          ],
  };
}

/**
 * Cuando se compilo y que commit era (SCRUM-234): lo que la aplicacion dice de si misma en su pie, para poder
 * contestar «¿esta es la version nueva?». Sin datos de nadie.
 *
 * El commit sale de Vercel (`VERCEL_GIT_COMMIT_SHA`) y, fuera de el, de `git`. Si no hay ninguno de los dos, se
 * queda sin commit en lugar de inventarlo.
 */
function laVersionDeLaApp(): { compiladaEl: string; commit: string | null } {
  const deVercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  let commit: string | null = deVercel ? deVercel.slice(0, 7) : null;

  if (commit === null) {
    try {
      commit =
        execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim() || null;
    } catch {
      commit = null;
    }
  }

  return { compiladaEl: new Date().toISOString(), commit };
}

export default defineConfig(({ mode }) => ({
  define: { __VSD_VERSION__: JSON.stringify(laVersionDeLaApp()) },
  plugins: [
    react(),
    noIndexarFueraDeProduccion(mode),

    // El service worker (SCRUM-135). Dos decisiones que no son las de siempre:
    //
    // - `injectManifest`: el service worker es nuestro (`src/sw.ts`: avisos push
    //   y la logica de que se guarda). El plugin solo le inyecta la lista de
    //   archivos de la compilacion, con su hash.
    // - `prompt`: una version nueva NO toma el control sola. La pagina avisa y
    //   la persona decide. Ver el comentario de `src/sw.ts`.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // El registro lo hace `main.tsx`, para poder probarlo.
      injectRegister: false,
      // El manifiesto es `public/manifest.webmanifest`, escrito a mano; el
      // plugin no genera otro.
      manifest: false,
      injectManifest: {
        // Lo que se guarda para abrir sin red. El PDF de la guia no: pesa y no
        // hace falta para trabajar. Los mapas de fuente tampoco.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2,webmanifest}'],
        // El editor de diagramas pesa varios megas y es parte de la aplicacion:
        // tiene que estar en la lista, o abriria con un error sin conexion. El
        // limite de fabrica es de 2 MiB, y pasarse hace fallar la compilacion
        // (con un mensaje que nombra esta opcion). Si falla por un archivo nuevo,
        // la respuesta no es subir el numero a ciegas: es preguntarse si ese
        // archivo tiene que pesar tanto.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      // En desarrollo no hay service worker: guardar archivos mientras se
      // cambian a cada rato es la forma de ver una version vieja sin saber por
      // que. Para probarlo: `npm run build && npm run preview`.
      devOptions: { enabled: false },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // Que falle en vez de saltar a otro puerto: si 5173 esta ocupado suele ser
    // porque ya hay un servidor corriendo, y tener dos confunde mas de lo que
    // ayuda. Ademas las URL de redireccion de OAuth se configuran por puerto.
    strictPort: true,
  },

  build: {
    outDir: 'dist',

    // Lo que casi no cambia entre versiones va en archivos aparte (SCRUM-283). Cada version nueva
    // cambia el codigo de la aplicacion, y si react, supabase y las animaciones viajaran dentro de
    // el, quien ya tenia la aplicacion bajaria todo de nuevo cada vez. Asi solo baja lo que cambio:
    // el service worker y el navegador guardan cada archivo por su huella.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Las rutas llegan con `/` tambien en Windows: rolldown las normaliza.
            { name: 'vendor-react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'vendor-router', test: /node_modules\/(react-router|react-router-dom)\// },
            { name: 'vendor-supabase', test: /node_modules\/@supabase\// },
            {
              name: 'vendor-animacion',
              test: /node_modules\/(framer-motion|motion-dom|motion-utils)\//,
            },
          ],
        },
      },
    },

    // En produccion no se publican los mapas. No es que revelen un secreto
    // —las claves publicas ya estan en el paquete— pero son dos megas y medio
    // de codigo fuente servido a cada visita, y no hacen falta para nada. En
    // desarrollo y en preproduccion si, que es donde se depura.
    sourcemap: mode !== 'production',
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/preparacion.ts'],
    // Mayor que la espera de las busquedas asincronas (`preparacion.ts`, 5 s): si una busqueda no encuentra
    // lo que espera, el error que sale es el suyo («Unable to find...») y no «Test timed out».
    testTimeout: 15_000,
    // Las de `scripts/` prueban los guardias que corren al compilar (cabeceras de
    // seguridad, SCRUM-152; los guiones que deciden algo, SCRUM-155). Usan las
    // APIs de Node (procesos, archivos), que tambien existen bajo jsdom.
    include: ['src/**/*.spec.{ts,tsx}', 'scripts/**/*.spec.{ts,mjs}'],
    css: true,

    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      // Los guardias de `scripts/` (cabeceras, service worker, buscadores, dependencias)
      // tambien son codigo nuestro con decisiones dentro: se miden como el resto, y por eso
      // sus pruebas los llaman en el mismo proceso en vez de lanzarlos aparte.
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.mjs'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'scripts/**/*.spec.{ts,mjs}',
        'src/pruebas/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      // Todavia sin umbral minimo. Ponerlo ahora, sobre un andamiaje de cuatro
      // archivos, daria un numero que no significa nada. El umbral entra con
      // SCRUM-73, cuando exista logica que merezca cubrirse.
    },
  },
}));
