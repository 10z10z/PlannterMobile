import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, waitFor } from '@testing-library/react-native';
import { renderHookWithProviders } from '../../test/render';
import { DEFAULT_FILTERS } from '../../lib/calendarFilters';
import useCalendarFilters from '../useCalendarFilters';

/**
 * The chips are how the calendar was left, not how it starts.
 *
 * What is worth driving here is the reading side, because what comes back off
 * disk was written by an older version of this app as often as by this one.
 * Both of those branches — a stored value that is out of date, and one that
 * can't be parsed at all — only ever fire on a real device with real history on
 * it, which is exactly the kind of thing that goes unnoticed until it strands
 * someone on an empty calendar.
 */

const KEY = 'calendarFilters';

const mount = () => renderHookWithProviders(() => useCalendarFilters());

describe('useCalendarFilters', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts with everything showing', async () => {
    const { result } = await mount();

    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('opens on the chips it was left with', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_FILTERS, places: ['growspace'] }));

    const { result } = await mount();

    await waitFor(() => expect(result.current.filters.places).toEqual(['growspace']));
  });

  it('remembers a chip being turned off', async () => {
    const { result } = await mount();

    await act(async () => {
      result.current.toggle('places', 'station');
    });

    await waitFor(async () =>
      expect(JSON.parse(await AsyncStorage.getItem(KEY)).places).not.toContain('station')
    );
  });

  it('puts everything back, and remembers that too', async () => {
    const { result } = await mount();

    await act(async () => {
      result.current.toggle('places', 'station');
    });
    await act(async () => {
      result.current.clear();
    });

    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    await waitFor(async () =>
      expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual(DEFAULT_FILTERS)
    );
  });

  it('opens on the defaults rather than throwing at unreadable settings', async () => {
    await AsyncStorage.setItem(KEY, '{ not json');

    const { result } = await mount();

    // It is parsed inside an effect on mount, so an exception here doesn't
    // produce a bad filter — it produces a blank screen.
    await waitFor(() => expect(result.current.filters).toEqual(DEFAULT_FILTERS));
  });

  it('brings a half-written setting up to date rather than trusting it', async () => {
    // What an older version of the app left behind: a shape this one no longer
    // uses. `normalizeFilters` fills the gaps rather than the screen reading
    // `undefined` and filtering everything out.
    await AsyncStorage.setItem(KEY, JSON.stringify({ places: ['growspace'] }));

    const { result } = await mount();

    await waitFor(() => expect(result.current.filters.places).toEqual(['growspace']));
    expect(Object.keys(result.current.filters).sort()).toEqual(Object.keys(DEFAULT_FILTERS).sort());
  });
});
