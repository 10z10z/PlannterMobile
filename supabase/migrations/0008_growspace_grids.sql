-- A growspace holds several grids rather than one.
--
-- A tent is rarely one flat block of spots: there's a shelf under the light, a
-- row along the back, a propagator on the floor. Each is its own arrangement,
-- so the dimensions move off the growspace and onto grids belonging to it.
create table growspace_grids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growspace_id uuid not null references growspaces(id) on delete cascade,
  name text not null,
  grid_rows integer not null check (grid_rows > 0),
  grid_cols integer not null check (grid_cols > 0),
  -- The order they're drawn in, so a grower can put the shelf they use most at
  -- the top rather than living with creation order.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index growspace_grids_growspace_id_idx on growspace_grids(growspace_id);

alter table growspace_grids enable row level security;

create policy "Users manage their own growspace grids"
  on growspace_grids for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Every growspace keeps the layout it already had, as its first grid.
insert into growspace_grids (user_id, growspace_id, name, grid_rows, grid_cols)
select user_id, id, 'Main', grid_rows, grid_cols
from growspaces;

-- Which grid a plant stands in. Null for one in the holding tray, and set null
-- rather than cascading when a grid is removed — losing a shelf shouldn't take
-- the plants that were on it.
alter table plants
  add column grid_id uuid references growspace_grids(id) on delete set null;

update plants
set grid_id = (
  select growspace_grids.id
  from growspace_grids
  where growspace_grids.growspace_id = plants.growspace_id
  limit 1
)
where grid_row is not null;

-- A plant standing somewhere has to be standing on a grid.
alter table plants
  add constraint plant_position_needs_grid
    check (grid_row is null or grid_id is not null);

-- One plant per cell, now scoped to the grid rather than the growspace.
drop index if exists plants_growspace_cell_idx;
create unique index plants_grid_cell_idx
  on plants(grid_id, grid_row, grid_col)
  where grid_row is not null;

-- The dimensions belong to the grids now.
alter table growspaces
  drop column grid_rows,
  drop column grid_cols;
