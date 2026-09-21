import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
// Se importa desde 'vitest/config' y no desde 'vite' porque es la variante que
// conoce el bloque `test`. Con la de 'vite' el archivo compila igual, pero
// TypeScript deja de revisar esa parte y un nombre mal escrito pasa sin aviso.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],

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
    sourcemap: true,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/preparacion.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
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
});
