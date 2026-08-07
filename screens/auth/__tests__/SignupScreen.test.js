jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen } from '../../../test/render';
import SignupScreen from '../SignupScreen';

const navigation = { navigate: jest.fn() };

const type = (label, value) => fireEvent.changeText(screen.getByLabelText(label), value);
const press = (label) => fireEvent.press(screen.getByText(label));

describe('SignupScreen', () => {
  beforeEach(() => {
    fake.reset();
    navigation.navigate.mockClear();
  });

  it('carries the same mark as the login screen', async () => {
    await renderWithProviders(<SignupScreen navigation={navigation} />);

    expect(screen.getByText('plannter')).toBeOnTheScreen();
    expect(screen.getByText('Create an account')).toBeOnTheScreen();
  });

  it('refuses a short password before the server has to', async () => {
    await renderWithProviders(<SignupScreen navigation={navigation} />);

    await type('Email', 'grower@example.com');
    await type('Password', 'short');
    await press('Sign up');

    expect(screen.getByText('Password must be at least 8 characters')).toBeOnTheScreen();
    expect(fake.client.auth.signUp).not.toHaveBeenCalled();
  });

  it('says what to do next when the account needs confirming', async () => {
    fake.client.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: { id: 'user-2' } },
      error: null,
    });
    await renderWithProviders(<SignupScreen navigation={navigation} />);

    await type('Email', 'grower@example.com');
    await type('Password', 'a good password');
    await press('Sign up');

    expect(
      await screen.findByText('Check your email to confirm your account, then log in.')
    ).toBeOnTheScreen();
  });

  it('says an address is taken in the app’s words', async () => {
    fake.client.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    });
    await renderWithProviders(<SignupScreen navigation={navigation} />);

    await type('Email', 'grower@example.com');
    await type('Password', 'a good password');
    await press('Sign up');

    expect(
      await screen.findByText('There’s already an account with that email.')
    ).toBeOnTheScreen();
    expect(screen.queryByText('User already registered')).not.toBeOnTheScreen();
  });
});
