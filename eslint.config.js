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

      /**
       * A control drawn as an icon has to say what it is.
       *
       * This was a sweep once — 27 of them across the app, every FAB and nearly
       * every `Appbar.Action`, announced by TalkBack as an unnamed button. A
       * sweep fixes the ones that exist and does nothing about the next one, and
       * the next one is written by someone who has no reason to think about it,
       * so the rule matters more than the sweep did.
       *
       * `FAB` is allowed a visible `label` instead: a button with words on it is
       * already named, and repeating them in `accessibilityLabel` only risks the
       * two drifting apart.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXOpeningElement[name.name="IconButton"]:not(:has(JSXAttribute[name.name="accessibilityLabel"]))',
          message:
            'An IconButton needs an accessibilityLabel — it has no text, so nothing else names it.',
        },
        {
          selector:
            'JSXOpeningElement[name.object.name="Appbar"][name.property.name="Action"]:not(:has(JSXAttribute[name.name="accessibilityLabel"]))',
          message:
            'An Appbar.Action needs an accessibilityLabel — it has no text, so nothing else names it.',
        },
        {
          selector:
            'JSXOpeningElement[name.name="FAB"]:not(:has(JSXAttribute[name.name=/^(accessibilityLabel|label)$/]))',
          message: 'A FAB needs an accessibilityLabel, or a visible label to be named by.',
        },
      ],
    },
  },
  {
    // The tests themselves, the mocks jest swaps in for them, and the harness
    // in `test/` that renders and fakes — all of it runs under jest and none of
    // it ships.
    files: ['**/__tests__/**/*.js', '**/__mocks__/**/*.js', 'test/**/*.js'],
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
