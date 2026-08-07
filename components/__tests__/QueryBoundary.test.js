import { Text } from 'react-native-paper';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../test/render';
import QueryBoundary from '../QueryBoundary';

/**
 * The distinction worth testing is the one the component was written for: a
 * request that failed must not look like a growspace with nothing in it. So each
 * test drives a real query — a pending one, a rejected one, one that resolves to
 * nothing — rather than handing the component a made-up query object, because
 * the states it branches on (`isPending`, `isError`, `isFetching`) are the
 * library's and only the library gets their combinations right.
 */
function Subject({ queryFn, isEmpty = false, ...rest }) {
  const query = useQuery({ queryKey: ['subject'], queryFn });
  return (
    <QueryBoundary query={query} isEmpty={isEmpty} {...rest}>
      <Text>Four trays</Text>
    </QueryBoundary>
  );
}

describe('QueryBoundary', () => {
  it('spins while the first load is in flight', async () => {
    await renderWithProviders(<Subject queryFn={() => new Promise(() => {})} />);

    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });

  it('draws the children once there is something to draw', async () => {
    await renderWithProviders(<Subject queryFn={async () => ['tray']} />);

    expect(await screen.findByText('Four trays')).toBeOnTheScreen();
  });

  it('turns a failure into a sentence rather than a database message', async () => {
    await renderWithProviders(
      <Subject
        queryFn={async () => {
          throw { code: '42501', message: 'new row violates row-level security policy' };
        }}
      />
    );

    expect(await screen.findByText('You don’t have access to that.')).toBeOnTheScreen();
    expect(screen.queryByText(/row-level security policy/)).not.toBeOnTheScreen();
  });

  it('offers a way out of a failure, and takes it', async () => {
    let attempts = 0;
    const queryFn = jest.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return ['tray'];
    });

    await renderWithProviders(<Subject queryFn={queryFn} />);

    await fireEvent.press(await screen.findByText('Try again'));

    await waitFor(() => expect(screen.getByText('Four trays')).toBeOnTheScreen());
  });

  it('says empty in the screen’s own words, and offers the way out of it', async () => {
    await renderWithProviders(
      <Subject
        queryFn={async () => []}
        isEmpty
        emptyText="No trays yet."
        emptyAction={<Text>Add one</Text>}
      />
    );

    expect(await screen.findByText('No trays yet.')).toBeOnTheScreen();
    expect(screen.getByText('Add one')).toBeOnTheScreen();
    expect(screen.queryByText('Four trays')).not.toBeOnTheScreen();
  });

  it('says why nothing is loading when there is no connection', async () => {
    onlineManager.setOnline(false);
    const queryFn = jest.fn();

    try {
      await renderWithProviders(<Subject queryFn={queryFn} />);

      // The defect this replaces: `onlineManager` holds the query rather than
      // failing it, which leaves it pending — so the screen showed the same
      // spinner a slow reply shows, for ever, with no way to tell them apart.
      expect(screen.getByText(/No connection/)).toBeOnTheScreen();
      expect(screen.queryByLabelText('Loading')).not.toBeOnTheScreen();
      expect(queryFn).not.toHaveBeenCalled();

      // And no button, because pressing it would pause identically. The query
      // resumes on its own when the connection returns.
      expect(screen.queryByText('Try again')).not.toBeOnTheScreen();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('does not call an empty list a failure', async () => {
    await renderWithProviders(
      <Subject queryFn={async () => []} isEmpty emptyText="No trays yet." />
    );

    expect(await screen.findByText('No trays yet.')).toBeOnTheScreen();
    expect(screen.queryByText('Try again')).not.toBeOnTheScreen();
  });
});
