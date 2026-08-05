-- Growspaces gain a layout and the conditions they're kept at, so a tent can be
-- arranged the way it actually stands rather than read as a list.
--
-- The grid is the growspace's own, not an inventory item's: a tent is whatever
-- shape its owner says it is, so the dimensions live here rather than being
-- copied from a tray the way a sowing's are.
alter table growspaces
  add column environment text not null default 'indoor'
    check (environment in ('indoor', 'outdoor')),
  add column temp_c numeric,
  add column humidity_pct numeric check (humidity_pct between 0 and 100),
  add column grid_rows integer not null default 4 check (grid_rows > 0),
  add column grid_cols integer not null default 4 check (grid_cols > 0);

-- Where a plant stands in its growspace, or null for one that hasn't been placed
-- yet — a transplant that has just arrived, or a plant left outside the grid
-- after it was made smaller. Unplaced plants wait in a holding tray under the
-- grid rather than being put somewhere the grower didn't choose.
--
-- Both coordinates are set or neither is; half a position would be a plant that
-- is in a row but nowhere along it.
alter table plants
  add column grid_row integer check (grid_row >= 0),
  add column grid_col integer check (grid_col >= 0),
  add constraint plant_position_is_whole
    check ((grid_row is null) = (grid_col is null));

-- One plant per cell. Unplaced plants hold nulls, which Postgres treats as
-- distinct from each other, so any number of them can wait to be placed.
create unique index plants_growspace_cell_idx
  on plants(growspace_id, grid_row, grid_col)
  where grid_row is not null;
