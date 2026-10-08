import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const MENSAJE_HTML_EN_BRUTO =
  'Nada de HTML en bruto: dangerouslySetInnerHTML, innerHTML, outerHTML, insertAdjacentHTML y document.write pintan texto sin escapar, y con un dato de la persona es una XSS. Pinta el texto como hijo de un elemento de React, o usa DocumentoLeido para el diario.';

export default tseslint.config(
  {
    // `public/` se sirve tal cual, sin compilar y sin codigo propio: el service
    // worker vive en `src/sw.ts` desde SCRUM-135.
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Accesibilidad en el codigo (C-03 de la auditoria 360): lo que se puede ver sin
  // ejecutar nada, como una imagen sin `alt`, un enlace sin destino o un `div` con
  // `onClick` y sin teclado. Lo que solo se ve con la pagina pintada —nombres,
  // contraste, orden de los encabezados— lo comprueban las pruebas con axe
  // (`src/pruebas/axe.ts`) y Lighthouse en el CI.
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['src/**/*.tsx'],
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    // El service worker tiene su propio proyecto de TypeScript: ver abajo.
    ignores: ['src/sw.ts'],
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

        // Lo que hoy no esta y nadie deberia agregar (SCRUM-155). Lo que escribe
        // una persona —el diario, el nombre, el texto del asistente— se pinta
        // como texto de React, que lo escapa. Con HTML en bruto, un `<img
        // onerror>` guardado es una XSS que se ejecuta en la sesion de quien lo
        // lea. Si de verdad hace falta pintar HTML, se hace en un componente
        // propio, con su saneador y su prueba, y se justifica en el Pull Request.
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: MENSAJE_HTML_EN_BRUTO,
        },
        {
          selector: "Property[key.name='dangerouslySetInnerHTML']",
          message: MENSAJE_HTML_EN_BRUTO,
        },
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: MENSAJE_HTML_EN_BRUTO,
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: MENSAJE_HTML_EN_BRUTO,
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
          message: MENSAJE_HTML_EN_BRUTO,
        },
        {
          selector: "CallExpression[callee.property.name='createContextualFragment']",
          message: MENSAJE_HTML_EN_BRUTO,
        },
      ],

      // Ejecutar texto como codigo: lo mismo, con otro nombre.
      'no-eval': 'error',
      'no-new-func': 'error',
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
    // El script que comprueba el service worker compilado (SCRUM-135) corre en
    // Node y no pertenece a ningun proyecto de TypeScript: se revisa sin las
    // reglas que necesitan tipos, igual que los demas `.mjs`.
    files: ['scripts/comprobar-el-service-worker.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    // El service worker (SCRUM-135): otro mundo, sin `window`, con `self` y sus
    // propios tipos.
    files: ['src/sw.ts'],
    languageOptions: {
      globals: globals.serviceworker,
      parserOptions: {
        project: ['./tsconfig.sw.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  {
    // La configuracion de Vite y las pruebas de los scripts de compilacion: las dos
    // corren en Node, no en el navegador, y comparten proyecto de TypeScript.
    files: ['vite.config.ts', 'scripts/**/*.spec.ts'],
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
    // aplicarse sobre ellos. Se revisan igual, solo que sin esa parte. Los
    // scripts de `scripts/` (SCRUM-122) corren en Node y son del mismo tipo.
    files: ['*.mjs', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
