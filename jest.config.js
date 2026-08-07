/**
 * Two projects, because the tests need two different worlds.
 *
 * Everything under `lib/` is pure logic and runs fastest in plain node, which is
 * what it has always done. Rendering a component needs the React Native preset
 * instead: the transform that understands the untranspiled ESM half of
 * `node_modules`, the mocks for the native modules Expo ships, and a platform to
 * resolve `.android.js` against. Running the whole suite under the heavier
 * preset would slow down the 500-odd tests that never render anything, so each
 * kind gets the environment it needs and `jest` runs both.
 *
 * Android is picked over the multi-platform default for the same reason: this
 * app ships an APK, and running every component test twice to prove it also
 * works on a platform nobody builds for is a doubled test run for nothing.
 */
module.exports = {
  projects: [
    {
      displayName: 'lib',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/lib/__tests__/**/*.test.js'],
    },
    {
      displayName: 'app',
      preset: 'jest-expo/android',
      // One pattern per directory rather than a brace group: on Windows the
      // expanded `<rootDir>` puts a backslash in front of the group and it
      // stops matching.
      testMatch: [
        '<rootDir>/components/**/__tests__/**/*.test.js',
        '<rootDir>/contexts/**/__tests__/**/*.test.js',
        '<rootDir>/hooks/**/__tests__/**/*.test.js',
        '<rootDir>/screens/**/__tests__/**/*.test.js',
      ],
      setupFiles: ['<rootDir>/test/env.js'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
      /**
       * Metro looks inside the `expo` package's own `node_modules` as well as
       * the root one, and npm has put `expo-asset` there rather than hoisting
       * it. Without the same courtesy here, importing an icon fails to resolve
       * a module the running app has no trouble with — the two resolvers
       * disagreeing, not the code being wrong.
       *
       * The preset's own mappings are kept: they point `react-native-vector-icons`
       * at `@expo/vector-icons`, which this app relies on.
       */
      moduleDirectories: ['node_modules', 'node_modules/expo/node_modules'],
    },
  ],
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/__tests__/**',
    '!lib/__mocks__/**',
    // Generated MD3 palette data — 3,000 lines of numbers with nothing to test.
    '!lib/themes.js',
    'components/**/*.js',
    '!components/__tests__/**',
    'hooks/**/*.js',
    '!hooks/__tests__/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  /**
   * Per-directory rather than global, so that adding component tests can't be
   * paid for out of the pure-logic coverage that is already there. Each floor is
   * ratcheted to just under what the suite currently reaches, so a change that
   * drops coverage fails rather than quietly spending the margin.
   */
  coverageThreshold: {
    './lib/': {
      statements: 57,
      branches: 60,
      functions: 65,
      lines: 57,
    },
    /**
     * Low, and honestly so: eight components of thirty have a test. The floor is
     * here to stop the number sliding while the rest are written, not to claim
     * the tier is covered.
     */
    './components/': {
      statements: 12,
      branches: 9,
      functions: 8,
      lines: 12,
    },
    /**
     * Higher than it looks, because the hooks are thin: most of a hook is a
     * query key and a function to call, and the tests that drive the dialogs go
     * through them on the way. The gap is in the ones no test has opened a
     * screen for yet — germination stations, the dashboard.
     */
    './hooks/': {
      statements: 55,
      branches: 50,
      functions: 30,
      lines: 55,
    },
  },
};
