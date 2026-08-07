jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../test/render';
import TrayFormDialog from '../TrayFormDialog';

/**
 * A form all the way down to the client.
 *
 * Only `lib/supabase` is faked, so the schema, `useForm`, `FormField`, the
 * mutation, `shelfFor('trays').save` and the invalidation that follows it are
 * all the real ones. What this can catch that a unit test can't is the wiring
 * between them: a schema whose message never reaches a field, a save that sends
 * the typed string where the column wants a number, an error that arrives at the
 * user in the database's words.
 */

const type = (label, value) => fireEvent.changeText(screen.getByLabelText(label), value);
const press = (label) => fireEvent.press(screen.getByText(label));

async function fillIn({ name = '10-cell tray', rows = '2', cols = '5', quantity = '3' } = {}) {
  await type('Name', name);
  await type('Rows', rows);
  await type('Columns', cols);
  await type('Quantity', quantity);
}

describe('TrayFormDialog', () => {
  beforeEach(() => {
    fake.reset();
  });

  it('writes the tray, converted, stamped with its owner', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(<TrayFormDialog visible onDismiss={() => {}} onSaved={onSaved} />);

    await fillIn({ name: '  10-cell tray  ' });
    await press('Save');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.rows('trays')).toEqual([
      expect.objectContaining({
        name: '10-cell tray',
        grid_rows: 2,
        grid_cols: 5,
        quantity: 3,
        cell_volume_ml: null,
        user_id: 'user-1',
      }),
    ]);
  });

  it('refuses to write anything when a required field is empty', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(<TrayFormDialog visible onDismiss={() => {}} onSaved={onSaved} />);

    await press('Save');

    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(screen.getByText('Rows is required')).toBeOnTheScreen();
    expect(fake.rows('trays')).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses a grid too big to draw, and says how big it was', async () => {
    await renderWithProviders(<TrayFormDialog visible onDismiss={() => {}} onSaved={() => {}} />);

    await fillIn({ rows: '40', cols: '40' });
    await press('Save');

    expect(
      screen.getByText('That is 1600 cells — 500 is the most that can be drawn')
    ).toBeOnTheScreen();
    expect(fake.rows('trays')).toEqual([]);
  });

  it('counts the cells as the two sides are typed', async () => {
    await renderWithProviders(<TrayFormDialog visible onDismiss={() => {}} onSaved={() => {}} />);

    expect(screen.getByText('Rows x columns gives the number of cells.')).toBeOnTheScreen();

    await type('Rows', '4');
    await type('Columns', '6');

    expect(screen.getByText('24 cells per tray.')).toBeOnTheScreen();
  });

  it('updates the row it was opened on rather than adding a second', async () => {
    fake.seed('trays', {
      id: 'tray-1',
      user_id: 'user-1',
      name: 'Old name',
      grid_rows: 2,
      grid_cols: 5,
      cell_volume_ml: null,
      quantity: 1,
      image_url: null,
    });
    const onSaved = jest.fn();
    await renderWithProviders(
      <TrayFormDialog
        visible
        onDismiss={() => {}}
        onSaved={onSaved}
        tray={{
          id: 'tray-1',
          name: 'Old name',
          grid_rows: 2,
          grid_cols: 5,
          cell_volume_ml: null,
          quantity: 1,
          image_url: null,
        }}
      />
    );

    // The dialog fills itself in from the row it was given.
    expect(screen.getByDisplayValue('Old name')).toBeOnTheScreen();

    await type('Name', 'New name');
    await press('Save');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.rows('trays')).toHaveLength(1);
    expect(fake.rows('trays')[0]).toMatchObject({ id: 'tray-1', name: 'New name' });
  });

  it('reports a failed save in words, and keeps what was typed', async () => {
    fake.failNext('trays', {
      code: '23505',
      message: 'duplicate key value violates unique constraint "trays_name_key"',
    });
    await renderWithProviders(<TrayFormDialog visible onDismiss={() => {}} onSaved={() => {}} />);

    await fillIn({ name: '10-cell tray' });
    await press('Save');

    expect(await screen.findByText('That has already been added.')).toBeOnTheScreen();
    expect(screen.queryByText(/unique constraint/)).not.toBeOnTheScreen();
    expect(screen.getByDisplayValue('10-cell tray')).toBeOnTheScreen();
  });
});
