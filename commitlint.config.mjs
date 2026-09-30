/**
 * Configuracion de commitlint para VSD Health.
 *
 * Aplica Conventional Commits y, ademas, exige que cada commit referencie
 * su ticket de Jira. Esa referencia es la que hace posible la trazabilidad
 * Jira -> rama -> commit -> Pull Request descrita en CONTRIBUTING.md.
 *
 * Ejemplo valido:
 *   feat(auth): registrar el consentimiento al crear la cuenta
 *
 *   Refs: SCRUM-31
 */
export default {
  extends: ['@commitlint/config-conventional'],

  parserPreset: {
    parserOpts: {
      // Permite que commitlint reconozca "SCRUM-31" como una referencia.
      issuePrefixes: ['SCRUM-'],
    },
  },

  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // nueva funcionalidad
        'fix', // correccion de un defecto
        'docs', // solo documentacion
        'style', // formato, sin cambio de comportamiento
        'refactor', // reestructuracion sin cambio de comportamiento
        'perf', // mejora de rendimiento
        'test', // pruebas
        'build', // dependencias o sistema de construccion
        'ci', // integracion continua
        'chore', // tareas de mantenimiento
        'revert', // reversion de un commit anterior
      ],
    ],

    // Todo commit debe citar al menos un ticket SCRUM-N.
    'references-empty': [2, 'never'],

    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],

    // El asunto se redacta en espanol, en minuscula y sin punto final.
    'subject-case': [0],
    'subject-full-stop': [2, 'never', '.'],
  },
};
