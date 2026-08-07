import { useQueryClient } from '@tanstack/react-query';
import { recordMove } from '../lib/activity';
import { placePlant, positionOf, resolveDrop, swapPlants } from '../lib/growspaces';
import { invalidateFor, keys } from '../lib/queryKeys';

/**
 * Rearranging a growspace: what a drop means, what it writes, and what it says
 * in the calendar afterwards.
 *
 * This is the orchestration around `resolveDrop`, which decides on its own
 * whether a drop is a move, a swap or nothing at all. Everything after that
 * decision lived in `GrowspaceTabScreen` and could only be reached through a
 * `PanResponder` — so the part with three failure paths in it was the part no
 * test could get at. Out here it takes plants and grids and hands back two
 * functions, which is the whole of what the grid needs from it.
 *
 * Both functions swallow a failed write on purpose. The invalidation that
 * follows is unconditional and is the rollback: it refetches the plants, so a
 * write that didn't land puts the tile back where it came from without anyone
 * having to remember the old position.
 *
 * @param {{ growspaceId: string, grids?: Array<any>, plants?: Array<any> }} params
 */
export default function usePlantMove({ growspaceId, grids = [], plants = [] }) {
  const queryClient = useQueryClient();

  /**
   * Moves a plant on screen before the write lands.
   *
   * Dragging has to feel immediate — waiting a round trip to see the pot land
   * would make the grid feel broken — so the cached list is edited directly and
   * the invalidation that follows the write confirms or corrects it.
   *
   * @param {(plant: any) => any} update
   */
  const placeOptimistically = (update) =>
    queryClient.setQueryData(
      keys.growspaces.plants(growspaceId),
      (/** @type {any[] | undefined} */ current) => (current ?? []).map(update)
    );

  /** "Shelf, spot 2,3" — where a plant ended up, for the calendar entry. */
  const spotLabel = (cell) => {
    if (!cell) return 'Back in the holding tray';
    const grid = grids.find((entry) => entry.id === cell.gridId);
    return `${grid?.name ?? 'Grid'}, spot ${cell.row + 1},${cell.col + 1}`;
  };

  /** The three position columns a cell writes, or three nulls for the tray. */
  const at = (target) => ({
    grid_id: target?.gridId ?? null,
    grid_row: target?.row ?? null,
    grid_col: target?.col ?? null,
  });

  /**
   * Applies a drop. The plants are updated in place before the reload so the
   * tile doesn't flick back to where it came from while the write is in flight.
   */
  const move = async (plant, cell) => {
    const drop = resolveDrop(plants, plant, cell);
    if (drop.type === 'none') return;

    if (drop.type === 'move') {
      placeOptimistically((entry) => (entry.id === plant.id ? { ...entry, ...at(cell) } : entry));
      try {
        await placePlant(plant.id, cell);
        await recordMove({ plant, detail: spotLabel(cell), growspaceId });
      } catch {
        // The invalidation below puts the optimistic move back.
      }
    } else {
      const from = positionOf(plant);
      placeOptimistically((entry) => {
        if (entry.id === plant.id) return { ...entry, ...at(cell) };
        if (entry.id === drop.occupant.id) return { ...entry, ...at(from) };
        return entry;
      });
      try {
        await swapPlants(plant, drop.occupant);
        // A swap moves two plants, and both have a day of their own to record.
        await recordMove({ plant, detail: spotLabel(cell), growspaceId });
        await recordMove({
          plant: drop.occupant,
          detail: `${spotLabel(from)} · swapped with ${plant.name}`,
          growspaceId,
        });
      } catch {
        // Same — the invalidation below is the source of truth.
      }
    }

    await invalidateFor(queryClient, 'plantMoved');
  };

  /** Sends a plant back to the holding tray, which is a move to nowhere. */
  const unplace = async (plant) => {
    placeOptimistically((entry) => (entry.id === plant.id ? { ...entry, ...at(null) } : entry));
    try {
      await placePlant(plant.id, null);
      await recordMove({ plant, detail: spotLabel(null), growspaceId });
    } catch {
      // The invalidation below puts it back if the write failed.
    }

    await invalidateFor(queryClient, 'plantMoved');
  };

  return { move, unplace };
}
