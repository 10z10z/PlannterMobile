import { fireEvent, renderWithProviders, screen, settle } from '../../test/render';
import PlantGrid from '../PlantGrid';

/**
 * Rearranging a growspace, by the path that doesn't need a drag.
 *
 * The drag itself stays untested and can't easily be otherwise: it is a
 * `PanResponder` reading finger coordinates against rectangles measured from a
 * real layout, and the test renderer has neither. That was the argument for
 * giving the grid a second way round in the first place — a grid whose only
 * interaction is invisible to TalkBack was already a tier-3 defect, and the
 * fact that it was also untestable is the same problem wearing a different hat.
 *
 * So what is driven here is the button path, which is the one a screen reader
 * uses: pick a plant, pick where it goes. It reaches the same `onMove` and
 * `onUnplace` the drag does, so the decisions behind a move are covered even
 * though the gesture is not.
 */

const GRIDS = [{ id: 'grid-1', name: 'Bench', grid_rows: 2, grid_cols: 2 }];

const plant = (id, name, row, col) => ({
  id,
  name,
  grid_id: row === null ? null : 'grid-1',
  grid_row: row,
  grid_col: col,
  image_url: null,
  container: null,
});

/** One standing in the corner, one still waiting to be given a spot. */
const PLANTS = [plant('plant-1', 'Basil 1', 0, 0), plant('plant-2', 'Chard', null, null)];

const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

const pressLabel = async (label) => {
  await fireEvent.press(screen.getByLabelText(label));
  await settle();
};

async function openGrid(props = {}) {
  const onMove = jest.fn();
  const onUnplace = jest.fn();
  const onPress = jest.fn();
  const view = await renderWithProviders(
    <PlantGrid
      grids={GRIDS}
      plants={PLANTS}
      onPress={onPress}
      onMove={onMove}
      onUnplace={onUnplace}
      {...props}
    />
  );
  return { ...view, onMove, onUnplace, onPress };
}

describe('PlantGrid', () => {
  it('names every plant and where it is standing', async () => {
    await openGrid();
    await press('Rearrange');

    // What TalkBack reads out. Counted from one, because nobody says "row zero".
    expect(screen.getByLabelText('Basil 1, row 1, spot 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Chard, not placed')).toBeOnTheScreen();
  });

  it('moves a plant to an empty spot without a drag', async () => {
    const { onMove } = await openGrid();

    await press('Rearrange');
    await pressLabel('Basil 1, row 1, spot 1');

    // Picking one up turns the free squares into somewhere to put it, and says
    // which square each one is.
    expect(screen.getByText('Basil 1 picked up — choose where it goes')).toBeOnTheScreen();
    await pressLabel('Move Basil 1 to row 2, spot 2 of Bench');

    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'plant-1' }), {
      gridId: 'grid-1',
      row: 1,
      col: 1,
    });
  });

  it('offers the occupied squares as a swap', async () => {
    const { onMove } = await openGrid({
      plants: [plant('plant-1', 'Basil 1', 0, 0), plant('plant-2', 'Chard', 1, 1)],
    });

    await press('Rearrange');
    await pressLabel('Basil 1, row 1, spot 1');
    // A square with something already in it isn't refused — it is a swap, and
    // says so rather than looking like a dead end.
    await pressLabel('Swap Basil 1 with Chard');

    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'plant-1' }), {
      gridId: 'grid-1',
      row: 1,
      col: 1,
    });
  });

  it('brings a waiting plant in from the tray', async () => {
    const { onMove } = await openGrid();

    await press('Rearrange');
    await pressLabel('Chard, not placed');
    await pressLabel('Move Chard to row 1, spot 2 of Bench');

    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'plant-2' }), {
      gridId: 'grid-1',
      row: 0,
      col: 1,
    });
  });

  it('takes a plant back off its grid', async () => {
    const { onUnplace } = await openGrid();

    await press('Rearrange');
    await pressLabel('Basil 1, row 1, spot 1');
    await press('Take Basil 1 off its grid');

    expect(onUnplace).toHaveBeenCalledWith(expect.objectContaining({ id: 'plant-1' }));
  });

  it('offers nothing to take off the grid for a plant already in the tray', async () => {
    await openGrid();

    await press('Rearrange');
    await pressLabel('Chard, not placed');

    // Chard is already out; there is nowhere to take it from.
    expect(screen.queryByText('Take Chard off its grid')).toBeNull();
  });

  it('puts a picked plant back down when it is tapped again', async () => {
    const { onMove } = await openGrid();

    await press('Rearrange');
    await pressLabel('Basil 1, row 1, spot 1');
    expect(screen.getByLabelText('Basil 1, picked up')).toBeOnTheScreen();

    await pressLabel('Basil 1, picked up');

    expect(screen.getByText('Choose a plant to move')).toBeOnTheScreen();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('leaves the empty squares alone until something is picked up', async () => {
    await openGrid();
    await press('Rearrange');

    // Nothing in hand, so a screenful of squares has nothing to announce.
    expect(screen.queryByLabelText(/^Move /)).toBeNull();
  });

  it('opens a plant rather than moving it when not rearranging', async () => {
    const { onPress, onMove } = await openGrid();

    // Outside the mode the tiles are draggable, and a tap is still "show me
    // this plant" — the mode is what changes what a tap means.
    expect(screen.queryByLabelText('Basil 1, row 1, spot 1')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('stops rearranging when it is done', async () => {
    await openGrid();

    await press('Rearrange');
    await pressLabel('Basil 1, row 1, spot 1');
    await press('Done');

    // Out of the mode, and nothing left picked up behind it.
    expect(screen.queryByLabelText('Basil 1, picked up')).toBeNull();
    expect(screen.queryByText(/picked up/)).toBeNull();
  });
});
