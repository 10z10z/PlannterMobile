jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { act, fireEvent, renderWithProviders, screen, settle, waitFor } from '../../../test/render';
import { shiftDate } from '../../../lib/dashboard';
import { toDateString } from '../../../lib/dates';
import DashboardScreen from '../DashboardScreen';

/**
 * The landing page, and the one thing on it that writes.
 *
 * Ticking a job off is the only work this screen does itself — everything else
 * is a way into the screen that does it properly — so that is what is worth
 * driving: the tick has to reach the row, and the row has to leave the list
 * afterwards. The second half is the real test. A write that saves and leaves
 * the job sitting there is the failure this app's whole invalidation scheme
 * exists to prevent, and it can only be caught by pressing the button and
 * looking at the screen after.
 *
 * The dates are built relative to today rather than written down, since "two
 * days late" has to stay two days late tomorrow.
 */

const today = toDateString(new Date());

/** An open job, with the embeds the fake won't resolve already on it. */
const action = (overrides) => ({
  user_id: 'user-1',
  kind: 'water',
  due_minutes: null,
  done_on: null,
  station_id: null,
  growspace_id: 'space-1',
  growspace: { name: 'Tent A' },
  station: null,
  targets: [],
  ...overrides,
});

const OVERDUE = action({
  id: 'action-1',
  subject: 'Water the tomatoes',
  due_on: shiftDate(today, -2),
});

const DUE_TODAY = action({
  id: 'action-2',
  subject: 'Feed the basil',
  kind: 'feed',
  due_on: today,
});

const SOON = action({
  id: 'action-3',
  subject: 'Sow the chard',
  kind: 'sow',
  due_on: shiftDate(today, 3),
});

const navigation = { navigate: jest.fn() };

async function openDashboard() {
  const view = await renderWithProviders(<DashboardScreen navigation={navigation} />);
  return view;
}

/** The tick beside a job, which is named after the job it finishes. */
const tickOff = async (subject) => {
  await fireEvent.press(screen.getByLabelText(`Mark ${subject} done`));
  await settle();
};

describe('DashboardScreen', () => {
  beforeEach(() => {
    fake.reset();
    navigation.navigate.mockClear();
    fake.seed('scheduled_actions', [OVERDUE, DUE_TODAY, SOON]);
  });

  it('ticks a job off and stops showing it', async () => {
    await openDashboard();
    await screen.findByText('Water the tomatoes');

    await tickOff('Water the tomatoes');

    await waitFor(() => {
      expect(fake.rows('scheduled_actions')[0]).toMatchObject({
        id: 'action-1',
        done_on: today,
      });
    });

    // The point of the test: the list is read again, so the job that was just
    // finished is gone rather than sitting there until the screen is reopened.
    await waitFor(() => expect(screen.queryByText('Water the tomatoes')).toBeNull());
    // And the rest of the round is untouched.
    expect(screen.getByText('Feed the basil')).toBeOnTheScreen();
  });

  it('takes the job off the list before the write has landed', async () => {
    await openDashboard();
    await screen.findByText('Water the tomatoes');

    // Held open only now, so the read that filled the screen went through.
    const release = fake.holdNext('scheduled_actions');
    await tickOff('Water the tomatoes');

    // The write is genuinely still out — `release` has not been called, and the
    // row it would change is untouched. What moved is the screen.
    expect(fake.rows('scheduled_actions')[0].done_on).toBeNull();
    expect(screen.queryByText('Water the tomatoes')).toBeNull();
    // And only that one. An optimistic edit that took the group with it would
    // be a worse bug than the wait it replaces.
    expect(screen.getByText('Feed the basil')).toBeOnTheScreen();

    await act(async () => {
      release();
    });
    await settle();
  });

  it('offers to undo the tick, and takes it back', async () => {
    await openDashboard();
    await screen.findByText('Water the tomatoes');

    await tickOff('Water the tomatoes');

    // No confirmation before the tick — the row leaves at once and the way back
    // is offered after, because reopening is a real operation rather than a
    // special case invented for the snackbar.
    expect(screen.getByText('Water the tomatoes — done')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Undo'));
    await settle();

    await waitFor(() => expect(fake.rows('scheduled_actions')[0].done_on).toBeNull());
    await waitFor(() => expect(screen.getByText('Water the tomatoes')).toBeOnTheScreen());
  });

  it('puts the job back when the write fails', async () => {
    await openDashboard();
    await screen.findByText('Water the tomatoes');

    fake.failNext('scheduled_actions');
    await tickOff('Water the tomatoes');

    // Having hidden it on the strength of a guess, the app owes the grower the
    // correction — a job that silently stops being listed is one that doesn't
    // get done.
    await waitFor(() => expect(screen.getByText('Water the tomatoes')).toBeOnTheScreen());
    expect(fake.rows('scheduled_actions')[0].done_on).toBeNull();
  });

  it('keeps what already slipped apart from what is due now', async () => {
    await openDashboard();

    // Overdue is its own heading rather than mixed into today's — a job that
    // slipped once is the one most likely to slip again.
    expect(await screen.findByText('Overdue · 1')).toBeOnTheScreen();
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Next 7 days')).toBeOnTheScreen();

    // Kind, then where, then how long it has been waiting.
    expect(screen.getByText('Water · Tent A · 2d late')).toBeOnTheScreen();
  });

  it('offers no tick on a job that is not due yet', async () => {
    await openDashboard();
    await screen.findByText('Sow the chard');

    expect(screen.getByLabelText('Mark Feed the basil done')).toBeOnTheScreen();
    // Nothing to finish ahead of time: the row is a way into the calendar, not
    // a checkbox.
    expect(screen.queryByLabelText('Mark Sow the chard done')).toBeNull();
  });

  it('opens the calendar on the day a job is due', async () => {
    await openDashboard();
    await fireEvent.press(await screen.findByText('Water the tomatoes'));

    expect(navigation.navigate).toHaveBeenCalledWith('Calendar', { date: shiftDate(today, -2) });
  });

  it('says the round is clear, and offers the way to filling it', async () => {
    fake.reset();
    await openDashboard();

    expect(await screen.findByText('Nothing due.')).toBeOnTheScreen();

    // It used to say "plan something from the calendar", which is a screen
    // describing where its own buttons are rather than offering one.
    await fireEvent.press(screen.getByText('Plan something'));
    expect(navigation.navigate).toHaveBeenCalledWith('Calendar', { date: today });
  });

  it('still shows the rest of the page when the schedule cannot be read', async () => {
    fake.failNext('scheduled_actions');
    fake.seed('growspaces', {
      id: 'space-1',
      user_id: 'user-1',
      name: 'Tent A',
      created_at: '2026-08-01T00:00:00.000Z',
    });

    await openDashboard();

    // The three sections share a screen, not a query. One of them failing is no
    // reason to show a grower a blank page with their growspaces still in the
    // database.
    expect(await screen.findByText('Growspaces')).toBeOnTheScreen();
    expect(screen.queryByText('Water the tomatoes')).toBeNull();
  });
});
