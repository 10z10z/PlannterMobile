-- Plannter schema, migration 0003: seed trays and the germination station.
-- Run this in the Supabase SQL editor after 0002_grow_lights.sql.
--
-- Column names avoid the SQL keywords `rows` and `row`, which would otherwise
-- have to be double-quoted at every call site.

-- Transplanting can put more than one seedling in a pot, and a pot is still one
-- occupied container. Keeping the seedling count on the plant leaves container
-- usage — one plant row per container in use — meaning what it always meant.
--
-- This runs first because it needs an exclusive lock on an existing table:
-- taking it before the new tables exist keeps it from deadlocking against
-- anything that reads them, such as the dashboard or a PostgREST schema reload.
alter table plants add column seedling_count integer not null default 1
  check (seedling_count > 0);

-- One row is a *group* of identical trays, following containers and grow
-- lights. A tray's capacity is its grid: a 4 x 6 tray has 24 cells.
create table trays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  grid_rows integer not null check (grid_rows > 0),
  grid_cols integer not null check (grid_cols > 0),
  -- Cells are small enough that millilitres read better than litres here, and
  -- most trays don't print the figure at all, so it stays optional.
  cell_volume_ml numeric,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

-- The germination equivalent of a growspace: a windowsill, a heated propagator,
-- a cold frame outside. Sowings live inside one.
create table germination_stations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  environment text not null default 'indoor'
    check (environment in ('indoor', 'outdoor')),
  created_at timestamptz not null default now()
);

-- One sowing is one physical thing planted on one day from one seed pack:
-- either a tray (a grid of cells) or a single container.
--
-- The tray's dimensions are copied in rather than read through tray_id, so
-- editing or deleting the inventory entry can't reshape a grid that already has
-- germination recorded against its cells.
create table sowings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id uuid not null references germination_stations(id) on delete cascade,
  -- Deleting a seed pack shouldn't erase the record of what was sown from it.
  seed_pack_id uuid references seed_packs(id) on delete set null,
  seed_pack_name text not null,
  tray_id uuid references trays(id) on delete set null,
  container_id uuid references containers(id) on delete set null,
  grid_rows integer not null check (grid_rows > 0),
  grid_cols integer not null check (grid_cols > 0),
  sown_on date not null default current_date,
  created_at timestamptz not null default now(),
  -- A sowing is a tray or a container, never both and never neither. A
  -- container sowing is stored as a 1 x 1 grid so one code path draws both.
  constraint sowing_target_is_tray_or_container
    check ((tray_id is not null) <> (container_id is not null))
);

-- One cell of a sowing's grid; a container sowing has exactly one.
--
-- `seeds_planted` is per cell, so a 4 x 6 tray at 3 seeds per cell is 24 rows of
-- 3. Both counts drop when seedlings are transplanted out, so a cell that has
-- been emptied reads 0/0 rather than pretending its seeds are still in the tray.
create table sowing_cells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sowing_id uuid not null references sowings(id) on delete cascade,
  cell_row integer not null check (cell_row >= 0),
  cell_col integer not null check (cell_col >= 0),
  seeds_planted integer not null check (seeds_planted >= 0),
  germinated integer not null default 0 check (germinated >= 0),
  -- Stamped when the cell first shows growth, and cleared if the count is
  -- corrected back down to zero.
  germinated_on date,
  constraint germinated_within_planted check (germinated <= seeds_planted),
  unique (sowing_id, cell_row, cell_col)
);

create index sowings_station_id_idx on sowings(station_id);
create index sowing_cells_sowing_id_idx on sowing_cells(sowing_id);

alter table trays enable row level security;
alter table germination_stations enable row level security;
alter table sowings enable row level security;
alter table sowing_cells enable row level security;

create policy "Users manage their own trays"
  on trays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own germination stations"
  on germination_stations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own sowings"
  on sowings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own sowing cells"
  on sowing_cells for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
