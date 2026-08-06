// Flat config. `eslint-config-expo` brings the React, React Hooks and
// React Native rules that matter for an Expo app; `eslint-config-prettier`
// goes last and switches off everything that formatting owns, so the linter
// only ever complains about things Prettier can't fix.
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expo,
  prettier,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
    ],
  },
  {
    rules: {
      // Unused arguments are usually a signature being honoured (navigation
      // props, callback shapes), so only flag the ones after the last used one.
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
      // console is how a mistake reaches a device log; warn is fine, log isn't.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    files: ['**/__tests__/**/*.js'],
    rules: {
      // A test reads best as "here is what is faked, here is what is under
      // test", and babel-jest hoists `jest.mock` above the imports regardless
      // of where it is written — so the order the rule wants is the order that
      // hides what the file is doing.
      'import/first': 'off',
    },
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
