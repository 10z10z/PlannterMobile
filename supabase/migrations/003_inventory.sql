-- Inventory: fertilizers, seed packs, containers and growing mediums.
--
-- Nutrient values are stored as a percentage of product weight/volume, exactly as
-- printed on the label. Doses and volumes are always stored metric (per litre /
-- litres); the imperial/metric toggle is display-only.

create table fertilizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  -- 'liquid' doses in ml/L, 'solid' (crystal/powder) doses in g/L
  form text not null default 'liquid' check (form in ('liquid', 'solid')),
  origin text not null default 'synthetic' check (origin in ('organic', 'synthetic')),
  n numeric, p numeric, k numeric,
  ca numeric, mg numeric, s numeric,
  fe numeric, mn numeric, zn numeric,
  b numeric, cu numeric, mo numeric,
  foliar_dose_min numeric,
  foliar_dose_max numeric,
  fertigation_dose_min numeric,
  fertigation_dose_max numeric,
  created_at timestamptz not null default now()
);

create table seed_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  plant_type text,
  germination_days_min integer,
  germination_days_max integer,
  packaged_on date,
  seed_count integer,
  created_at timestamptz not null default now()
);

-- One row is a *group* of identical containers, so "6 x 11L" is a single entry.
create table containers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  volume_liters numeric not null,
  quantity integer not null default 1 check (quantity > 0),
  image_url text,
  created_at timestamptz not null default now()
);

create table growing_mediums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  quantity integer not null default 1 check (quantity > 0),
  volume_liters numeric,
  -- Instead of tracking consumption, an entry is flagged by hand when running out.
  low_stock boolean not null default false,
  -- Optional nutrient profile, for pre-charged/pre-bagged soils.
  n numeric, p numeric, k numeric,
  ca numeric, mg numeric, s numeric,
  fe numeric, mn numeric, zn numeric,
  b numeric, cu numeric, mo numeric,
  ec numeric,
  ph_min numeric,
  ph_max numeric,
  created_at timestamptz not null default now()
);

-- Container occupancy is derived from how many plants point at a container group.
alter table plants add column container_id uuid references containers(id) on delete set null;
create index plants_container_id_idx on plants(container_id);

alter table fertilizers enable row level security;
alter table seed_packs enable row level security;
alter table containers enable row level security;
alter table growing_mediums enable row level security;

create policy "Users manage their own fertilizers"
  on fertilizers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own seed packs"
  on seed_packs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own containers"
  on containers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own growing mediums"
  on growing_mediums for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
