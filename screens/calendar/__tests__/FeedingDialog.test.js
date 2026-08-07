jest.mock('../../../lib/supabase');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fake } from '../../../test/fakeSupabase';
import {
  fireEvent,
  pressWhenReady,
  renderWithProviders,
  screen,
  settle,
  waitFor,
} from '../../../test/render';
import { toDateString } from '../../../lib/dates';
import FeedingDialog from '../FeedingDialog';

/**
 * A feed is two tables and sometimes a third, written without a transaction, in
 * whatever units the grower reads. That is where the risk is: the doses on
 * screen are per gallon for half the world and every one of them is stored per
 * litre, and a mix that saved its feeding but not its products would read in the
 * calendar as plain water.
 *
 * The other half of the dialog is the question it asks about where. A growspace
 * can be fed plant by plant; a station holds cells of a tray and can only be fed
 * whole. Which question appears follows the place that was picked, so both are
 * driven here rather than assumed.
 */

const GROWSPACE = {
  id: 'space-1',
  user_id: 'user-1',
  name: 'Tent A',
  created_at: '2026-08-01T00:00:00.000Z',
};

const STATION = {
  id: 'station-1',
  user_id: 'user-1',
  name: 'Propagator',
  created_at: '2026-08-02T00:00:00.000Z',
};

/** Two bottles, one carrying a label rate and one not. */
const FERTILIZERS = [
  {
    id: 'fert-1',
    user_id: 'user-1',
    name: 'Grow A',
    form: 'liquid',
    fertigation_dose_min: 2,
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'fert-2',
    user_id: 'user-1',
    name: 'Bloom B',
    form: 'solid',
    fertigation_dose_min: null,
    foliar_dose_min: null,
    created_at: '2026-08-02T00:00:00.000Z',
  },
];

const PLANTS = [
  {
    id: 'plant-1',
    user_id: 'user-1',
    growspace_id: 'space-1',
    name: 'Basil 1',
    created_at: '2026-08-03T00:00:00.000Z',
  },
  {
    id: 'plant-2',
    user_id: 'user-1',
    growspace_id: 'space-1',
    name: 'Basil 2',
    created_at: '2026-08-04T00:00:00.000Z',
  },
];

/**
 * Press, then give the frame back.
 *
 * Every control in this dialog animates when it is touched — the chips, the
 * segmented buttons, the checkboxes — and a test that asserts and ends in the
 * same tick leaves that animation running past its own boundary. The `settle`
 * lets it finish where it started.
 */
const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

/** Typing animates the floating label, so it settles for the same reason. */
const type = async (label, value) => {
  await fireEvent.changeText(screen.getByLabelText(label), value);
  await settle();
};

/**
 * A plant is ticked by its accessibility label rather than its text.
 *
 * Paper's `Checkbox.Item` names the whole row and hides what is inside it from
 * the accessibility tree — one announcement of "Basil 2, checkbox, not ticked"
 * rather than three fragments. Queries skip hidden elements, so the label is
 * on screen and `getByText` cannot see it.
 */
const tick = async (name) => {
  await fireEvent.press(screen.getByLabelText(name));
  await settle();
};

/**
 * Pick a place through the menu. Waited for rather than expected: the list is a
 * query, and opening a Paper menu takes a frame.
 */
async function pickPlace(name) {
  await press('Pick a growspace or station');
  await pressWhenReady(name);
  await settle();
}

async function openDialog(props = {}) {
  const onDone = jest.fn();
  const view = await renderWithProviders(
    <FeedingDialog visible onDismiss={() => {}} onDone={onDone} {...props} />
  );
  // The chips come from the inventory query, so nothing can be mixed until it
  // has arrived.
  await screen.findByText('Grow A');
  return { ...view, onDone };
}

describe('FeedingDialog', () => {
  beforeEach(async () => {
    fake.reset();
    // The mock keeps its store between tests in a file, and one test picks
    // imperial — left behind it would silently change the next one's units.
    await AsyncStorage.clear();
    fake.seed('growspaces', GROWSPACE);
    fake.seed('germination_stations', STATION);
    fake.seed('fertilizers', FERTILIZERS);
    fake.seed('plants', PLANTS);
  });

  it('records the feed, its mix and its calendar entry', async () => {
    const { onDone } = await openDialog();

    await pickPlace('Tent A');
    await press('Grow A');
    await type('Batch mixed (L, optional)', '10');
    await press('Log feeding');

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(fake.rows('feedings')).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        growspace_id: 'space-1',
        station_id: null,
        volume_liters: 10,
        note: null,
        fed_on: toDateString(new Date()),
      }),
    ]);

    expect(fake.rows('feeding_products')).toEqual([
      expect.objectContaining({
        fertilizer_id: 'fert-1',
        // Copied in beside the dose, so the feed still reads correctly after the
        // bottle behind it is renamed or thrown away.
        fertilizer_name: 'Grow A',
        form: 'liquid',
        // The label's own rate, offered as the starting point and left alone.
        dose_per_liter: 2,
      }),
    ]);

    // Nobody was picked out, so nothing claims particular plants got it.
    expect(fake.rows('feeding_plants')).toEqual([]);

    expect(fake.rows('activity_events')).toEqual([
      expect.objectContaining({
        kind: 'fed',
        subject: 'All of Tent A',
        detail: 'Grow A 2 ml/L · in 10 L',
        growspace_id: 'space-1',
        station_id: null,
        plant_id: null,
      }),
    ]);
  });

  it('names the plants when only some of them were fed', async () => {
    const { onDone } = await openDialog();

    await pickPlace('Tent A');
    await press('Some plants');
    await tick('Basil 2');
    await press('Grow A');
    await press('Log feeding');

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(fake.rows('feeding_plants')).toEqual([
      expect.objectContaining({ plant_id: 'plant-2', plant_name: 'Basil 2' }),
    ]);
    // One plant, so the entry points at it and shows up in that plant's own
    // history rather than only the growspace's.
    expect(fake.rows('activity_events')[0]).toMatchObject({
      subject: 'Basil 2',
      plant_id: 'plant-2',
    });
  });

  it('will not record "some plants" without naming one', async () => {
    await openDialog();

    await pickPlace('Tent A');
    await press('Some plants');
    await press('Grow A');
    await press('Log feeding');

    expect(screen.getByText('Pick the plants that were fed')).toBeOnTheScreen();
    expect(fake.rows('feedings')).toEqual([]);
  });

  it('never asks which plants when the place is a station', async () => {
    const { onDone } = await openDialog();

    await pickPlace('Propagator');

    // A station holds cells of a tray, not plants that could be picked out.
    expect(screen.queryByText('Some plants')).toBeNull();
    expect(screen.queryByText('Whole space')).toBeNull();

    await press('Grow A');
    await press('Log feeding');

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fake.rows('feedings')[0]).toMatchObject({
      station_id: 'station-1',
      growspace_id: null,
    });
    expect(fake.rows('activity_events')[0]).toMatchObject({
      subject: 'All of Propagator',
      station_id: 'station-1',
    });
  });

  it('refuses a feed with nothing in it', async () => {
    await openDialog();

    await pickPlace('Tent A');
    await press('Log feeding');

    expect(screen.getByText('Pick at least one fertilizer')).toBeOnTheScreen();
    expect(fake.rows('feedings')).toEqual([]);
  });

  it('refuses a product left at no dose at all', async () => {
    await openDialog();

    await pickPlace('Tent A');
    // Bloom B carries no label rate, so its field opens empty and stays that way.
    await press('Bloom B');
    await press('Log feeding');

    expect(screen.getByText('Bloom B is required')).toBeOnTheScreen();
    expect(fake.rows('feedings')).toEqual([]);
  });

  it('takes the feeding back when its mix cannot be saved', async () => {
    const { onDone } = await openDialog();

    fake.failNext('feeding_products', { code: '23514', message: 'violates check constraint' });

    await pickPlace('Tent A');
    await press('Grow A');
    await press('Log feeding');

    expect(await screen.findByText('That value isn’t allowed.')).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
    // A feeding with no products recorded reads as if plain water was poured,
    // which says less than nothing — so the half that landed is taken back.
    expect(fake.rows('feedings')).toEqual([]);
    expect(fake.rows('activity_events')).toEqual([]);
  });

  it('stores per litre what an imperial grower typed per gallon', async () => {
    await AsyncStorage.setItem('unitSystem', 'imperial');
    const { onDone } = await openDialog();

    await pickPlace('Tent A');
    await press('Grow A');
    // The label rate is offered in the unit on the field, so 2 ml/L reads as
    // 7.57 ml/gal — and both fields are typed over here in the units shown.
    await type('Grow A (ml/gal)', '4');
    await type('Batch mixed (gal, optional)', '2');
    await press('Log feeding');

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(fake.rows('feedings')[0].volume_liters).toBeCloseTo(7.5708, 4);
    expect(fake.rows('feeding_products')[0].dose_per_liter).toBeCloseTo(1.0567, 4);
  });

  it('opens filled in from a mix worked out in the calculator', async () => {
    await openDialog({
      preset: {
        placeId: 'space-1',
        volumeLiters: 5,
        products: [{ fertilizer_id: 'fert-1', dose_per_liter: 1.5 }],
      },
    });

    // The place is chosen, the product is on, and the rate came over with it —
    // nothing to do but check it and press the button.
    expect(screen.getByText('Tent A')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grow A (ml/L)').props.value).toBe('1.5');
    expect(screen.getByLabelText('Batch mixed (L, optional)').props.value).toBe('5');
  });
});
