jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, settle, waitFor } from '../../../test/render';
import GrowspaceFormDialog from '../GrowspaceFormDialog';

/**
 * The other multi-table write with no transaction under it.
 *
 * A growspace is a row, then its grids, then its lights, saved one after
 * another — so the case worth holding it to is the one where the first lands
 * and the second doesn't. What the app promises there is not atomicity, which
 * PostgREST can't give it: it promises that pressing save again finishes the
 * job rather than creating a second tent under the same name. That promise is
 * only worth anything if something checks it.
 */

const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

const type = async (label, value) => {
  await fireEvent.changeText(screen.getByLabelText(label), value);
  await settle();
};

/**
 * The growspace's own name, which shares its label with every grid's.
 * The first is the dialog's; the rest belong to the list further down.
 */
const typeName = async (value) => {
  await fireEvent.changeText(screen.getAllByLabelText('Name')[0], value);
  await settle();
};

async function openDialog(props = {}) {
  const onSaved = jest.fn();
  const view = await renderWithProviders(
    <GrowspaceFormDialog
      visible
      growspace={null}
      onDismiss={() => {}}
      onSaved={onSaved}
      {...props}
    />
  );
  return { ...view, onSaved };
}

describe('GrowspaceFormDialog', () => {
  beforeEach(() => {
    fake.reset();
  });

  it('creates the growspace and the grid it starts with', async () => {
    const { onSaved } = await openDialog();

    await typeName('Tent A');
    await press('Create');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(fake.rows('growspaces')).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        name: 'Tent A',
        environment: 'indoor',
        temp_c: null,
        humidity_pct: null,
        // Indoors there is no sun to record, whatever was typed.
        sun_hours: null,
      }),
    ]);

    // A new space starts with one 4x4 grid, which is what most spaces are.
    expect(fake.rows('growspace_grids')).toEqual([
      expect.objectContaining({
        growspace_id: fake.rows('growspaces')[0].id,
        name: 'Main',
        grid_rows: 4,
        grid_cols: 4,
        sort_order: 0,
      }),
    ]);
  });

  it('keeps the hours of sun only while the space is outdoors', async () => {
    const { onSaved } = await openDialog();

    await typeName('Raised bed');
    await press('Outdoor');
    await type('Hours of direct sun', '6.5');
    await press('Create');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.rows('growspaces')[0]).toMatchObject({
      environment: 'outdoor',
      sun_hours: 6.5,
    });
  });

  it('will not create a growspace with no name', async () => {
    await openDialog();

    await press('Create');

    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(fake.rows('growspaces')).toEqual([]);
  });

  it('refuses a grid too big to draw, and saves nothing', async () => {
    await openDialog();

    await typeName('Tent A');
    // Forty a side is within both fields and 1600 views, which is the whole
    // reason the product is checked as well as the sides.
    await type('Rows', '40');
    await type('Columns', '40');
    await press('Create');

    expect(
      screen.getByText('Main: that is 1600 cells — 500 is the most that can be drawn')
    ).toBeOnTheScreen();
    expect(fake.rows('growspaces')).toEqual([]);
  });

  it('finishes the job on a retry rather than making a second growspace', async () => {
    const { onSaved } = await openDialog();

    fake.failNext('growspace_grids', { code: '23514', message: 'violates check constraint' });

    await typeName('Tent A');
    await press('Create');

    // The growspace landed and its grids didn't, and the dialog says so.
    expect(
      await screen.findByText(/The growspace was saved, but its grids weren’t/)
    ).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    expect(fake.rows('growspaces')).toHaveLength(1);
    expect(fake.rows('growspace_grids')).toEqual([]);

    // The button now offers to save rather than create, because there is
    // already something to save.
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    // One tent, not two, and the grid it was missing.
    expect(fake.rows('growspaces')).toHaveLength(1);
    expect(fake.rows('growspace_grids')).toHaveLength(1);
  });

  it('opens an existing growspace on its own figures', async () => {
    fake.seed('growspace_grids', {
      id: 'grid-1',
      growspace_id: 'space-1',
      name: 'Bench',
      grid_rows: 2,
      grid_cols: 3,
      sort_order: 0,
    });

    await openDialog({
      growspace: {
        id: 'space-1',
        name: 'Tent A',
        description: 'The one by the window',
        environment: 'indoor',
        temp_c: 21,
        humidity_pct: 55,
        sun_hours: null,
      },
    });

    expect(screen.getByText('Edit Growspace')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Name')[0].props.value).toBe('Tent A');
    expect(screen.getByLabelText('Temperature (°C)').props.value).toBe('21');
    expect(screen.getByLabelText('Humidity (%)').props.value).toBe('55');
    // The grid it already has, read back rather than replaced by the 4x4 a new
    // space would start with. Its name is a field of its own, so it is the
    // second thing on the dialog labelled "Name".
    await waitFor(() => expect(screen.getAllByLabelText('Name')[1].props.value).toBe('Bench'));
    expect(screen.getByLabelText('Rows').props.value).toBe('2');
    expect(screen.getByLabelText('Columns').props.value).toBe('3');
  });
});
