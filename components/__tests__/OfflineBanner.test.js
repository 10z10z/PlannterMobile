import { onlineManager } from '@tanstack/react-query';
import { act, renderWithProviders, screen } from '../../test/render';
import OfflineBanner from '../OfflineBanner';

/**
 * `onlineManager` is a module-level singleton, and in a test nothing is feeding
 * it: `lib/queryClient.js` wires NetInfo into it, and the test tree builds its
 * own client instead. So a test says what the connection is doing directly,
 * which is also the seam the app uses — NetInfo's only job in the app is to call
 * `setOnline`.
 *
 * It has to be put back afterwards, or a test that went offline leaves every
 * later query in the run paused.
 */
const goOffline = async () => {
  await act(async () => {
    onlineManager.setOnline(false);
  });
};

describe('OfflineBanner', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('says nothing while there is a connection', async () => {
    await renderWithProviders(<OfflineBanner />);

    expect(screen.queryByText(/No connection/)).not.toBeOnTheScreen();
  });

  it('explains itself when the connection goes', async () => {
    await renderWithProviders(<OfflineBanner />);

    await goOffline();

    expect(screen.getByText(/No connection/)).toBeOnTheScreen();
  });

  it('goes away again when the connection comes back', async () => {
    await renderWithProviders(<OfflineBanner />);

    await goOffline();
    await act(async () => {
      onlineManager.setOnline(true);
    });

    expect(screen.queryByText(/No connection/)).not.toBeOnTheScreen();
  });

  it('announces itself rather than waiting to be focused', async () => {
    await renderWithProviders(<OfflineBanner />);
    await goOffline();

    // The screen it is explaining has stopped moving, so a bar nobody is told
    // about is a bar TalkBack users never hear.
    const bar = screen.getByRole('alert');
    expect(bar.props.accessibilityLiveRegion).toBe('polite');
  });
});
