module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-maps|firebase|@firebase)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // lucide-react-native's package.json "react-native"/"import" export condition
    // points at an ESM-only .mjs build that jest-expo's transform pipeline never
    // matches (it only transforms .js/.jsx/.ts/.tsx) — redirect to the package's
    // own CJS build instead of trying to teach Jest to transform .mjs globally.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // Jest's 5s default is too tight for a React Native screen mount here — a
  // MapView, a quote round-trip and a full form comfortably exceed it once the
  // runner is saturated. Six suites had already reached for jest.setTimeout
  // individually, and the ones that had not failed intermittently depending on
  // which lost the scheduling race: CheckoutScreen one run, AccountScreen the
  // next, neither for any reason in the code under test.
  //
  // A test that fails on scheduling is a test lying about the code, and chasing
  // it file by file only moves it to whichever suite is heaviest next.
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  // React 19's passive-effects flush (flushPassiveEffects) schedules microtasks
  // via getSocket().then() that are still in-flight when all tests complete,
  // preventing Jest from draining the Node event loop naturally. forceExit
  // ensures the process terminates once all test assertions have resolved,
  // matching the behaviour of `--forceExit` on the CLI.
  forceExit: true,
};
