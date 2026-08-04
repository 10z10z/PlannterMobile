-- Plannter schema, migration 0002: grow lights.
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- Lengths are stored in centimetres, following the same rule as volumes in
-- 0001: metric in the database, converted only for display.

-- One row is a *group* of identical fixtures, like containers — "4 x 100W
-- floodlight" is a single entry rather than four.
create table grow_lights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  type text not null default 'led'
    check (type in ('led', 'cfl', 't5', 'hps', 'mh', 'cmh', 'floodlight', 'other')),
  quantity integer not null default 1 check (quantity > 0),

  -- Basics, printed on every box.
  watts numeric,
  -- Only meaningful for white-emitting fixtures; an HPS lamp's colour is fixed
  -- by its chemistry, so the form hides this for those types.
  color_temp_k numeric,

  -- Spec-sheet figures. Cheap fixtures publish none of these, so all optional.
  spectrum text check (spectrum in ('full', 'veg', 'bloom', 'white_red', 'other')),
  dimmable boolean not null default false,
  ppf_umol_s numeric,
  efficacy_umol_j numeric,
  -- PPFD only means something at a stated distance, so the two travel together.
  ppfd_umol_m2_s numeric,
  ppfd_distance_cm numeric,
  coverage_width_cm numeric,
  coverage_depth_cm numeric,
  beam_angle_deg numeric,
  ip_rating text,

  created_at timestamptz not null default now()
);

-- How many of a light group hang in a given growspace.
--
-- A group can be split across several spaces — two of four floodlights in one
-- tent, two in another — which a single growspace_id on grow_lights could not
-- express. "In use" is the sum of these rows rather than a stored count, so it
-- cannot drift out of sync, exactly as container usage is derived from plants.
create table growspace_lights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growspace_id uuid not null references growspaces(id) on delete cascade,
  grow_light_id uuid not null references grow_lights(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  -- One row per light group per growspace; adjust the quantity instead.
  unique (growspace_id, grow_light_id)
);

create index growspace_lights_growspace_id_idx on growspace_lights(growspace_id);
create index growspace_lights_grow_light_id_idx on growspace_lights(grow_light_id);

alter table grow_lights enable row level security;
alter table growspace_lights enable row level security;

create policy "Users manage their own grow lights"
  on grow_lights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own growspace light assignments"
  on growspace_lights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
