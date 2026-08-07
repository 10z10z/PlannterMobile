import { Text } from 'react-native-paper';
import { fireEvent, renderWithProviders, screen } from '../../test/render';
import ErrorBoundary from '../ErrorBoundary';

function Fragile({ broken }) {
  if (broken) throw new Error('growspace vanished');
  return <Text>Growspace</Text>;
}

/**
 * The same thing, reading a flag the test owns rather than a prop.
 *
 * Resetting is for the case where the cause has gone since — a refetch that now
 * succeeds, a row that has since been deleted properly. Modelling that with a
 * prop doesn't work: while the fallback is up the children aren't rendered, so
 * nothing inside the boundary can change one. The flag is set from outside
 * between the throw and the press, which is exactly what "fixed in the
 * meantime" means here.
 */
const world = { broken: true };
function FragileWorld() {
  if (world.broken) throw new Error('growspace vanished');
  return <Text>Growspace</Text>;
}

describe('ErrorBoundary', () => {
  // React logs a caught render error, and so does the boundary itself. Both are
  // the component working; only an unexpected one is worth seeing.
  let consoleError;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('catches a screen that threw instead of taking the tree down', async () => {
    await renderWithProviders(
      <ErrorBoundary>
        <Fragile broken />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });

  it('names the tab that broke, so the other four read as still fine', async () => {
    await renderWithProviders(
      <ErrorBoundary label="Growspaces">
        <Fragile broken />
      </ErrorBoundary>
    );

    expect(screen.getByText('Growspaces stopped working')).toBeOnTheScreen();
  });

  it('leaves an unbroken screen alone', async () => {
    await renderWithProviders(
      <ErrorBoundary>
        <Fragile broken={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Growspace')).toBeOnTheScreen();
    expect(screen.queryByText('Something went wrong')).not.toBeOnTheScreen();
  });

  it('comes back when the cause has gone', async () => {
    world.broken = true;
    await renderWithProviders(
      <ErrorBoundary>
        <FragileWorld />
      </ErrorBoundary>
    );

    world.broken = false;
    await fireEvent.press(screen.getByText('Try again'));

    expect(screen.getByText('Growspace')).toBeOnTheScreen();
    expect(screen.queryByText('Something went wrong')).not.toBeOnTheScreen();
  });

  it('and simply returns when it has not', async () => {
    await renderWithProviders(
      <ErrorBoundary>
        <Fragile broken />
      </ErrorBoundary>
    );

    await fireEvent.press(screen.getByText('Try again'));

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });
});
