'use strict';

const js = require('@eslint/js');
const globals = require('globals');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'backups/**', 'logs/**', 'coverage/**', 'database-backup-utility-spec.zip'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-undef': 'error',
    },
  },
];