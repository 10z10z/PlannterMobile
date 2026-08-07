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
    // Added once `AuthContext` grew a decision worth testing — telling a
    // sign-out the grower asked for apart from one that happened to them. The
    // other three contexts are counted with it, and are mostly uncovered; the
    // floor below says so rather than the directory being left out to keep the
    // other numbers looking tidy.
    'contexts/**/*.js',
    '!contexts/__tests__/**',
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
      statements: 79,
      branches: 74,
      functions: 82,
      lines: 82,
    },
    /**
     * Still the thinnest tier, and honestly so: much of what is counted here is
     * reached on the way through a dialog rather than driven directly.
     *
     * What is *not* counted, in either `components/grid/Draggable` or
     * `DoseSlider`, is the gesture — a `PanResponder` reading finger
     * coordinates, which the test renderer doesn't produce. Both are covered
     * through the keyboard-and-screen-reader path added alongside, which
     * reaches the same handlers the drag does. That the untestable half is
     * exactly the half TalkBack couldn't reach either is not a coincidence.
     *
     * The floor sits still here rather than rising, and that is the split
     * working: `PlantGrid` gave its geometry to `lib/` and its drop resolution
     * to `hooks/`, both of which are now tested, so what is left under
     * `components/` is a higher proportion of untested view code than before.
     * The overall figure went up.
     */
    './components/': {
      statements: 38,
      branches: 31,
      functions: 26,
      lines: 39,
    },
    /**
     * Higher than it looks, because the hooks are thin: most of a hook is a
     * query key and a function to call, and the tests that drive the dialogs go
     * through them on the way. The exceptions carry real logic and are what
     * move this floor — the calculator's three (the mix, the tap and the
     * meter), and now the grid's two, `usePlantMove` and `usePlantDrag`, which
     * are driven directly rather than through a screen. The gap left is the
     * ones no test has opened a screen for yet: germination stations, the plant
     * detail screen.
     */
    './hooks/': {
      statements: 84,
      branches: 67,
      functions: 74,
      lines: 85,
    },
    /**
     * Higher than expected for a directory only one test opens directly, and
     * that is the shape of a context: almost all of it is reached on the way
     * through the screens that read it, so `AuthProvider`, `UnitsProvider` and
     * `ThemeProvider` are exercised by every rendered test in the suite. The
     * branches are where the gap is — the paths taken when a stored preference
     * is missing or a weather fetch fails, which nothing has arranged for yet.
     */
    './contexts/': {
      statements: 73,
      branches: 52,
      functions: 80,
      lines: 75,
    },
  },
};
