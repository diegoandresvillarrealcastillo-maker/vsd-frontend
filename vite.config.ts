import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Se importa desde 'vitest/config' y no desde 'vite' porque es la variante que
// conoce el bloque `test`. Con la de 'vite' el archivo compila igual, pero
// TypeScript deja de revisar esa parte y un nombre mal escrito pasa sin aviso.
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),

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
    // Los guiones de `scripts/` que deciden algo (SCRUM-155) tienen su prueba al lado.
    include: ['src/**/*.spec.{ts,tsx}', 'scripts/**/*.spec.mjs'],
    css: true,

    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/pruebas/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      // Todavia sin umbral minimo. Ponerlo ahora, sobre un andamiaje de cuatro
      // archivos, daria un numero que no significa nada. El umbral entra con
      // SCRUM-73, cuando exista logica que merezca cubrirse.
    },
  },
}));
