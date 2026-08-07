jest.mock('../../../lib/supabase');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, settle, waitFor } from '../../../test/render';
import StationFormDialog from '../StationFormDialog';

/**
 * The third write in the app that touches two tables with no transaction under
 * it — the station, then the lights hanging over it.
 *
 * What the app promises when the second half fails is not atomicity, which
 * PostgREST cannot give it. It promises two narrower things: that the grower is
 * told which half landed, and that pressing save again finishes the job instead
 * of leaving a second propagator behind under the same name. Both are only
 * worth anything if something checks them, and until now nothing did.
 */

const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

const type = async (label, value) => {
  await fireEvent.changeText(screen.getByLabelText(label), value);
  await settle();
};

async function openDialog(props = {}) {
  const onSaved = jest.fn();
  const view = await renderWithProviders(
    <StationFormDialog visible station={null} onDismiss={() => {}} onSaved={onSaved} {...props} />
  );
  return { ...view, onSaved };
}

describe('StationFormDialog', () => {
  beforeEach(async () => {
    fake.reset();
    await AsyncStorage.clear();
  });

  it('creates the station', async () => {
    const { onSaved } = await openDialog();

    await type('Name', 'Propagator');
    await type('Temperature (°C)', '24');
    await type('Humidity (%)', '80');
    await press('Create');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(fake.rows('germination_stations')).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        name: 'Propagator',
        environment: 'indoor',
        temp_c: 24,
        humidity_pct: 80,
      }),
    ]);
  });

  it('will not create a station with no name', async () => {
    await openDialog();

    await press('Create');

    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(fake.rows('germination_stations')).toEqual([]);
  });

  it('says which half of a failed save landed', async () => {
    const { onSaved } = await openDialog();

    fake.failNext('station_lights', { code: '23514', message: 'violates check constraint' });

    await type('Name', 'Propagator');
    await press('Create');

    // The sentence the data layer composed, not the generic shrug. This is the
    // only thing on screen that tells a grower pressing save again will finish
    // the job rather than make a second propagator — and for a while it was
    // being swallowed and shown as "Something went wrong. Try again."
    expect(
      await screen.findByText('The station was saved, but its lights weren’t')
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    // The cause belongs in a log, not on a phone.
    expect(screen.queryByText(/23514|check constraint/)).toBeNull();

    expect(onSaved).not.toHaveBeenCalled();
    expect(fake.rows('germination_stations')).toHaveLength(1);
  });

  it('finishes the job on a retry rather than making a second station', async () => {
    const { onSaved } = await openDialog();

    fake.failNext('station_lights', { code: '23514', message: 'violates check constraint' });

    await type('Name', 'Propagator');
    await press('Create');
    await screen.findByText('The station was saved, but its lights weren’t');

    // The button now offers to save rather than create, because there is
    // already something to save.
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    // One propagator, not two.
    expect(fake.rows('germination_stations')).toHaveLength(1);
    expect(fake.rows('germination_stations')[0].name).toBe('Propagator');
  });

  it('stores in Celsius what an imperial grower typed in Fahrenheit', async () => {
    await AsyncStorage.setItem('unitSystem', 'imperial');
    const { onSaved } = await openDialog();

    await type('Name', 'Propagator');
    await type('Temperature (°F)', '75');
    await press('Create');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.rows('germination_stations')[0].temp_c).toBeCloseTo(23.89, 2);
  });

  it('opens an existing station on its own figures', async () => {
    await openDialog({
      station: {
        id: 'station-1',
        name: 'Propagator',
        environment: 'heated',
        temp_c: 24,
        humidity_pct: 80,
      },
    });

    expect(screen.getByText('Edit Station')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name').props.value).toBe('Propagator');
    expect(screen.getByLabelText('Temperature (°C)').props.value).toBe('24');
    expect(screen.getByLabelText('Humidity (%)').props.value).toBe('80');
  });
});
