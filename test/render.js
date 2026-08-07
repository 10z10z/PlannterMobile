import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { UnitsProvider } from '../contexts/UnitsContext';

/**
 * The providers a screen needs, in the order `App.js` puts them.
 *
 * Not the app's own `queryClient`: that one retries, keeps data for ten minutes
 * and is a module-level singleton, so one test's cache would answer the next
 * one's query. A test gets a fresh client with retries off, so a deliberate
 * failure fails once and immediately rather than three times over eight
 * seconds.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Safe-area insets have to be supplied by hand: the real ones come from the
 * native module, which returns nothing here, and a screen that reads them would
 * lay out at zero height and render nothing to query for.
 */
const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Paper's own theme with the animations taken out.
 *
 * `animation.scale` multiplies every duration, and Paper honours it because
 * Android's own "remove animations" setting does. At zero, a dialog or a menu
 * finishes opening within the frame it started in.
 *
 * That matters more than tidiness. An animation left running when a test ends
 * carries on across the boundary — RNTL unmounts the tree, but the timer is the
 * platform's — and lands in the *next* test, where the callback that was meant
 * to finish closing one menu instead closes the one that test just opened. The
 * symptom is a suite where every other test can't find a menu item, which reads
 * like a race in the app and isn't.
 */
const TEST_THEME = { ...MD3LightTheme, animation: { ...MD3LightTheme.animation, scale: 0 } };

/**
 * Awaited, like everything else here. React 19 made `act` asynchronous, so
 * Testing Library's `render`, `fireEvent` and `userEvent` all return promises —
 * a test that forgets an `await` gets an empty screen rather than a warning.
 *
 * Units default to metric, as they do on a fresh install; a test that wants
 * imperial sets it through `AsyncStorage` before rendering, which is where
 * `UnitsProvider` reads it from.
 *
 * @param {import('react').ReactElement} ui
 * @param {{ queryClient?: QueryClient } & Parameters<typeof render>[1]} [options]
 */
export async function renderWithProviders(
  ui,
  { queryClient = createTestQueryClient(), ...rest } = {}
) {
  function Providers({ children }) {
    return (
      <SafeAreaProvider initialMetrics={INSETS}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <UnitsProvider>
              <PaperProvider theme={TEST_THEME}>{children}</PaperProvider>
            </UnitsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  const view = await render(ui, { wrapper: Providers, ...rest });
  await settle();
  return { queryClient, ...view };
}

/**
 * One frame, before the test touches anything.
 *
 * Paper starts animations on mount, and one of them bites. A `Menu` that mounts
 * closed runs its hide animation immediately, and that animation's callback sets
 * the menu back to unrendered when it finishes. On a phone it finishes in a
 * tenth of a second, long before anyone taps. In a test nothing advances until
 * the renderer is asked to, so without this the stale callback lands *after* the
 * press that opened the menu and closes it again — the menu opens and shuts
 * within one `act`, and the items never appear.
 *
 * Long enough for a frame rather than a microtask: the animation is driven by
 * `requestAnimationFrame`, so draining the microtask queue alone leaves it
 * exactly where it was.
 */
export async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

/**
 * Press something that needs a moment to exist first.
 *
 * `findByText` waits, but it waits on the clock rather than on the renderer, and
 * the two things a menu item is waiting for — a frame for the menu to open, a
 * query for the list to arrive — only move when the renderer is stepped. So this
 * steps it, and looks again.
 *
 * @param {string | RegExp} text
 */
export async function pressWhenReady(text, { attempts = 20 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const found = screen.queryByText(text);
    if (found) {
      await fireEvent.press(found);
      return;
    }
    await settle();
  }
  const visible = screen.queryAllByText(/./).map((node) => node.props.children);
  throw new Error(`Nothing reading "${text}" ever appeared. On screen: ${JSON.stringify(visible)}`);
}

export * from '@testing-library/react-native';
