import { Text } from 'react-native-paper';
import { fireEvent, renderHook, renderWithProviders, screen, settle } from '../../test/render';
import { useSnackbar } from '../SnackbarContext';

/**
 * The app had nowhere to say what just happened, which is why every destructive
 * action in it asks first: a confirmation is what you build when you have
 * nowhere to put an apology.
 *
 * The two rules worth holding it to are the ones a queue would break. One
 * message at a time, so the undo a grower is reaching for doesn't slide away
 * while three others take their turn — and pressing the action dismisses,
 * because an undo still on screen after it has been taken invites a second
 * press at something already reversed.
 */

/** @param {{ label?: string, message?: string, action?: any }} props */
function Raiser({ label = 'Say it', message = 'Basil — done', action = undefined }) {
  const { notify } = useSnackbar();
  return (
    <Text testID={label} onPress={() => notify(message, action)}>
      {label}
    </Text>
  );
}

const raise = async (testID = 'Say it') => {
  await fireEvent.press(screen.getByTestId(testID));
  await settle();
};

describe('SnackbarProvider', () => {
  it('says nothing until something is said', async () => {
    await renderWithProviders(<Raiser />);

    expect(screen.queryByText('Basil — done')).not.toBeOnTheScreen();
  });

  it('shows the message it was given', async () => {
    await renderWithProviders(<Raiser />);

    await raise();

    expect(screen.getByText('Basil — done')).toBeOnTheScreen();
  });

  it('runs the action and puts itself away', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Raiser action={{ label: 'Undo', onPress }} />);

    await raise();
    await fireEvent.press(screen.getByText('Undo'));
    await settle();

    expect(onPress).toHaveBeenCalledTimes(1);
    // An undo left on screen after it has been taken invites a second press at
    // something that is already back.
    expect(screen.queryByText('Undo')).not.toBeOnTheScreen();
  });

  it('replaces the message rather than queueing behind it', async () => {
    await renderWithProviders(
      <>
        <Raiser label="first" message="Basil — done" />
        <Raiser label="second" message="Chard — done" />
      </>
    );

    await raise('first');
    await raise('second');

    // The offer on screen is always for the thing that just happened.
    expect(screen.getByText('Chard — done')).toBeOnTheScreen();
    expect(screen.queryByText('Basil — done')).not.toBeOnTheScreen();
  });

  it('shows a message with no way back at all', async () => {
    await renderWithProviders(<Raiser message="Saved" />);

    await raise();

    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(screen.queryByText('Undo')).not.toBeOnTheScreen();
  });

  it('does nothing rather than throwing outside a provider', async () => {
    // Bare `renderHook`, with no wrapper: `renderWithProviders` would supply
    // the very provider this is checking the absence of.
    //
    // A snackbar is the least important thing on any screen, so a component
    // rendered on its own — in a test, or in a dialog mounted somewhere odd —
    // shouldn't fail for want of one.
    const { result } = await renderHook(() => useSnackbar());

    expect(() => result.current.notify('nobody is listening')).not.toThrow();
    expect(() => result.current.dismiss()).not.toThrow();
  });
});
