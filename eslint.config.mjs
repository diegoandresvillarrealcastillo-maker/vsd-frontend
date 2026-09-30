import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Un `any` apaga la comprobacion de tipos justo donde mas hace falta.
      '@typescript-eslint/no-explicit-any': 'error',

      // Las promesas sin esperar son la fuente habitual de errores que no
      // aparecen en ningun sitio: el fallo ocurre y nadie se entera.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Una variable sin usar suele ser un resto de algo a medio terminar.
      // El prefijo _ sirve para decir "ya se, es a proposito".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Ninguna clave de Supabase ni URL de la API se escribe a mano en el
      // codigo: salen de las variables de entorno, que cambian por ambiente.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^https:\\/\\/[a-z0-9]+\\.supabase\\.co/]',
          message:
            'La URL de Supabase no se escribe en el codigo: usa import.meta.env.VITE_SUPABASE_URL.',
        },
        {
          selector: 'Literal[value=/service_role/]',
          message:
            'La clave de servicio de Supabase no existe en el frontend: da acceso total y salta el aislamiento por RLS.',
        },
      ],
    },
  },

  {
    files: ['src/**/*.spec.{ts,tsx}', 'src/pruebas/**/*.ts'],
    rules: {
      // En una prueba, forzar un tipo para construir un caso imposible es
      // legitimo: justamente se quiere comprobar que el codigo lo aguanta.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  {
    files: ['vite.config.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    // Los archivos de configuracion en JavaScript no pertenecen a ningun
    // proyecto de TypeScript, asi que las reglas que necesitan tipos no pueden
    // aplicarse sobre ellos. Se revisan igual, solo que sin esa parte.
    files: ['*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
