-- Plannter schema, migration 0004: lights over a germination station.
-- Run this in the Supabase SQL editor after 0003_germination.sql.

-- The same shape as growspace_lights: a light group can be split between a tent
-- and a propagator, so the quantity lives on the assignment rather than a single
-- station_id on grow_lights. A light group's "in use" total is now summed from
-- both tables.
create table station_lights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id uuid not null references germination_stations(id) on delete cascade,
  grow_light_id uuid not null references grow_lights(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  -- One row per light group per station; adjust the quantity instead.
  unique (station_id, grow_light_id)
);

create index station_lights_station_id_idx on station_lights(station_id);
create index station_lights_grow_light_id_idx on station_lights(grow_light_id);

alter table station_lights enable row level security;

create policy "Users manage their own station light assignments"
  on station_lights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
