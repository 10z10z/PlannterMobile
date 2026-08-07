jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { act, fireEvent, renderWithProviders, screen } from '../../../test/render';
import LoginScreen from '../LoginScreen';

const navigation = { navigate: jest.fn() };

const type = (label, value) => fireEvent.changeText(screen.getByLabelText(label), value);
const press = (label) => fireEvent.press(screen.getByText(label));

describe('LoginScreen', () => {
  beforeEach(() => {
    fake.reset();
    navigation.navigate.mockClear();
  });

  it('leads with the app’s own mark rather than a stand-in', async () => {
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    // This was a 🌱 emoji and the word "Plannter" until the app's actual logo
    // was put on it — on the one screen every reviewer and every new grower
    // sees before anything else.
    expect(screen.getByText('plannter')).toBeOnTheScreen();
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
  });

  it('signs in with what was typed', async () => {
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await type('Email', 'grower@example.com');
    await type('Password', 'correct horse');
    await press('Log in');

    expect(fake.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'grower@example.com',
      password: 'correct horse',
    });
  });

  it('does not ask the server about an address that isn’t one', async () => {
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await type('Email', 'grower@');
    await type('Password', 'correct horse');
    await press('Log in');

    expect(screen.getByText('That doesn’t look like an email address')).toBeOnTheScreen();
    expect(fake.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('asks for both fields before it asks the server for anything', async () => {
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await press('Log in');

    expect(screen.getByText('Email is required')).toBeOnTheScreen();
    expect(screen.getByText('Password is required')).toBeOnTheScreen();
    expect(fake.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('says what a rejected sign-in means, in the app’s words', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await type('Email', 'grower@example.com');
    await type('Password', 'wrong');
    await press('Log in');

    expect(await screen.findByText('That email and password don’t match.')).toBeOnTheScreen();
    expect(screen.queryByText('Invalid login credentials')).not.toBeOnTheScreen();
  });

  it('says a dropped connection is a connection problem', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Network request failed' },
    });
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await type('Email', 'grower@example.com');
    await type('Password', 'correct horse');
    await press('Log in');

    expect(
      await screen.findByText('No connection. Check your network and try again.')
    ).toBeOnTheScreen();
  });

  it('says why you are back here, when you didn’t ask to be', async () => {
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    // The session ending under the app: `AuthProvider` recognises a SIGNED_OUT
    // nobody asked for, and this screen is where that gets explained. Without
    // it the grower is dropped at a login form that looks like they were never
    // signed in — which reads as the app having lost their work.
    await act(async () => {
      fake.setSession(null);
    });

    expect(
      screen.getByText('You were signed out because your session expired. Sign in to carry on.')
    ).toBeOnTheScreen();
  });

  it('drops the expiry notice once there is a real reason the attempt failed', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await act(async () => {
      fake.setSession(null);
    });

    await type('Email', 'grower@example.com');
    await type('Password', 'wrong');
    await press('Log in');

    // By now "your session expired" is old news, and why this try didn't work
    // is the more useful of the two.
    expect(await screen.findByText('That email and password don’t match.')).toBeOnTheScreen();
    expect(screen.queryByText(/your session expired/)).not.toBeOnTheScreen();
  });

  it('offers the way to signing up', async () => {
    await renderWithProviders(<LoginScreen navigation={navigation} />);

    await press('Don’t have an account? Sign up');

    expect(navigation.navigate).toHaveBeenCalledWith('Signup');
  });
});
