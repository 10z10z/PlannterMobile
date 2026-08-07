import { renderHookWithProviders } from '../../test/render';
import useRefresh from '../useRefresh';

/**
 * The rule this exists for is the second one: the spinner stays up until every
 * query has come back.
 *
 * A growspace is four reads, a station three, the calendar two. Refetching all
 * of them and hiding the indicator when the first finishes is how a pull ends
 * with most of the screen still stale and nothing on screen admitting it —
 * which is worse than no pull at all, because it looks like it worked.
 */

const query = ({ isRefetching = false } = {}) => ({
  isRefetching,
  refetch: jest.fn(),
});

const mount = (queries) => renderHookWithProviders(() => useRefresh(queries));

describe('useRefresh', () => {
  it('refetches every query it was given', async () => {
    const queries = [query(), query(), query()];
    const { result } = await mount(queries);

    result.current.onRefresh();

    for (const one of queries) expect(one.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the spinner up while any one of them is still out', async () => {
    const { result } = await mount([
      query({ isRefetching: false }),
      query({ isRefetching: true }),
      query({ isRefetching: false }),
    ]);

    expect(result.current.refreshing).toBe(true);
  });

  it('puts the spinner away only when they have all come back', async () => {
    const { result } = await mount([query(), query()]);

    expect(result.current.refreshing).toBe(false);
  });

  it('skips the queries a screen doesn’t have', async () => {
    // A screen reads some of its queries conditionally — `enabled: !!id` — and
    // passes the slot along regardless rather than building the array twice.
    const real = query();
    const { result } = await mount([null, real, undefined]);

    expect(() => result.current.onRefresh()).not.toThrow();
    expect(real.refetch).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it('copes with being given nothing at all', async () => {
    const { result } = await mount(undefined);

    expect(result.current.refreshing).toBe(false);
    expect(() => result.current.onRefresh()).not.toThrow();
  });
});
