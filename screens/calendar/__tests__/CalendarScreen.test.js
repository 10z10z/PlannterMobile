jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, settle, waitFor } from '../../../test/render';
import { toDateString } from '../../../lib/dates';
import CalendarScreen from '../CalendarScreen';

/**
 * The month, characterised before it is taken apart.
 *
 * This screen is 358 lines and had no tests at all, so the tests come before the
 * split rather than after it. Unlike the plant grid there is no gesture in the
 * way here — every path through this screen is a press on something with words
 * on it — so extracting first and testing later would have been a choice rather
 * than a constraint.
 *
 * They are written against what is on screen, so the extraction underneath can
 * happen without touching them. That is the point of writing them first.
 */

const today = toDateString(new Date());

/** A plan, with the embeds the fake won't resolve already on it. */
const plan = (overrides) => ({
  user_id: 'user-1',
  kind: 'water',
  due_on: today,
  due_minutes: null,
  done_on: null,
  note: null,
  station_id: null,
  growspace_id: 'space-1',
  growspace: { name: 'Tent A' },
  station: null,
  targets: [],
  ...overrides,
});

const OPEN_PLAN = plan({ id: 'plan-1', subject: 'Water the tomatoes' });
const DONE_PLAN = plan({ id: 'plan-2', subject: 'Feed the basil', kind: 'feed', done_on: today });

const RECORDED = {
  id: 'event-1',
  user_id: 'user-1',
  kind: 'watered',
  subject: 'Basil 1',
  detail: 'Every 7 days',
  occurred_on: today,
  growspace_id: 'space-1',
  station_id: null,
  plant_id: 'plant-1',
  sowing_id: null,
  feeding_id: null,
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

async function openCalendar() {
  return renderWithProviders(
    <CalendarScreen navigation={navigation} route={{ params: { date: today } }} />
  );
}

describe('CalendarScreen', () => {
  beforeEach(() => {
    fake.reset();
    navigation.goBack.mockClear();
    fake.seed('scheduled_actions', [OPEN_PLAN, DONE_PLAN]);
    fake.seed('activity_events', [RECORDED]);
  });

  it('opens on the day it was sent to, and shows both halves of it', async () => {
    await openCalendar();

    // Asserted on the rows rather than on the "Planned" and "Done" headings,
    // because the filter bar's chips carry those same two words — which is
    // itself the reason the headings are not a safe thing to look for.
    //
    // A plan is listed by its subject; a record is prefixed with what kind of
    // thing it was. Two questions about one day, from two queries, so that one
    // of them failing doesn't empty the month of the other.
    expect(await screen.findByText('Water the tomatoes')).toBeOnTheScreen();
    expect(screen.getByText('Watered · Basil 1')).toBeOnTheScreen();
  });

  it('offers a finished plan the way back, and an open one the two ways on', async () => {
    await openCalendar();
    await screen.findByText('Water the tomatoes');

    // An open plan can be carried out or ticked off; a finished one can only be
    // undone. Both can be removed.
    expect(screen.getByText('Do it now')).toBeOnTheScreen();
    expect(screen.getByText('Mark done')).toBeOnTheScreen();
    expect(screen.getByText('Undo')).toBeOnTheScreen();
  });

  it('marks a plan done and says so, with a way to take it back', async () => {
    await openCalendar();
    await screen.findByText('Water the tomatoes');

    await press('Mark done');

    await waitFor(() =>
      expect(fake.rows('scheduled_actions').find((row) => row.id === 'plan-1').done_on).toBe(today)
    );
    expect(screen.getByText('Water the tomatoes — done')).toBeOnTheScreen();
  });

  it('removes a plan outright', async () => {
    // One plan only: every plan carries its own Remove, so with two on the day
    // there is no such thing as "the" Remove button.
    fake.reset();
    fake.seed('scheduled_actions', [OPEN_PLAN]);
    await openCalendar();
    await screen.findByText('Water the tomatoes');

    await press('Remove');

    await waitFor(() => expect(fake.rows('scheduled_actions')).toEqual([]));
  });

  it('says which entries it worked out rather than was told', async () => {
    await openCalendar();
    await screen.findByText('Watered · Basil 1');

    // A recorded event was written down at the time; a derived one is the app
    // reading a date off a row. Saying so is more honest than a diary that
    // pretends someone kept it.
    expect(screen.queryByText('from records')).not.toBeOnTheScreen();
  });

  it('offers a way to fill a day with nothing on it', async () => {
    fake.reset();
    await openCalendar();

    expect(await screen.findByText('Nothing recorded on this day.')).toBeOnTheScreen();
    expect(screen.getByText('Plan something')).toBeOnTheScreen();
  });

  it('can be left the way it was arrived at', async () => {
    await openCalendar();

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('offers to add to the calendar, in the two ways there are', async () => {
    await openCalendar();

    await fireEvent.press(screen.getByLabelText('Add to the calendar'));
    await settle();

    expect(screen.getByText('Schedule an action')).toBeOnTheScreen();
    expect(screen.getByText('Log a feeding')).toBeOnTheScreen();
  });
});
