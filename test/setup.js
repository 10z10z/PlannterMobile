// `toBeOnTheScreen`, `toHaveTextContent` and the rest, on `expect` everywhere.
import '@testing-library/react-native/matchers';

/**
 * The native modules a rendered screen reaches for, and what they do instead.
 *
 * jest-expo already stands in for the `expo-*` packages. What it doesn't cover
 * is the three community modules this app depends on, each of which is a real
 * native call: storage that has no disk here, a network probe with no network
 * behind it, and a notification scheduler with no notification service. Left
 * alone they either throw or resolve never, and a component test would fail for
 * a reason that has nothing to do with the component.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock')
);

/**
 * Measurement, which React Native's own mock stubs out as a function that takes
 * a callback and never calls it.
 *
 * Anything that positions itself against the thing it came from measures first —
 * Paper's `Menu` asks for both its own box and its anchor's, and waits for both
 * before it will finish opening. Against the stock mock that wait never ends: the
 * menu opens but leaves a promise and a pending frame behind it, which is what
 * makes jest complain about a worker that wouldn't exit. A plausible rectangle
 * lets it finish.
 */
const nativeMethods = require('react-native/jest/MockNativeMethods').default;
nativeMethods.measureInWindow.mockImplementation((callback) => callback(0, 0, 320, 48));
nativeMethods.measure.mockImplementation((callback) => callback(0, 0, 320, 48, 0, 0));

/**
 * Online, always. `lib/queryClient.js` reads the connection through NetInfo and
 * pauses queries when it says there is none; the stock mock reports a connected
 * wifi, which is the state every test that isn't about being offline wants.
 * A test that *is* about it overrides this itself.
 */

/**
 * The date picker is a native dialog, and asking for it here throws before
 * anything renders. A test drives the field's value rather than the platform's
 * calendar, so the component stands in as nothing at all — what it would open
 * is Android's picker, which is not this app's code to test.
 */
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
