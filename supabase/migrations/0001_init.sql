-- Plannter schema. Run this once in the Supabase SQL editor (Project > SQL
-- Editor > New query) against a fresh project.
--
-- Conventions used throughout:
--   * Every table carries user_id and is protected by row-level security, so a
--     user can only ever reach rows that are their own.
--   * Volumes are stored in litres and doses per litre. The app's
--     metric/imperial preference is display-only, so the data stays consistent
--     regardless of how any given device is configured.
--   * Nutrient values are percentages of product weight/volume, as printed on
--     the label.

create table growspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- One row is a *group* of identical containers, so "6 x 11L fabric" is a single
-- entry rather than six. How many are in use is derived from the plants
-- pointing at the group, never stored, so it can't drift out of sync.
create table containers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material text not null default 'plastic'
    check (material in ('plastic', 'fabric', 'terracotta')),
  volume_liters numeric not null,
  quantity integer not null default 1 check (quantity > 0),
  image_url text,
  created_at timestamptz not null default now()
);

create table plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growspace_id uuid not null references growspaces(id) on delete cascade,
  -- Deleting a set of containers shouldn't take the plants with it.
  container_id uuid references containers(id) on delete set null,
  name text not null,
  species text,
  image_url text,
  watering_interval_days integer not null default 7,
  last_watered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table fertilizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  -- 'liquid' doses are ml/L, 'solid' (crystal/powder) doses are g/L
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

create table growing_mediums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_url text,
  quantity integer not null default 1 check (quantity > 0),
  volume_liters numeric,
  -- Rather than tracking consumption, an entry is flagged by hand when running out.
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

create index plants_growspace_id_idx on plants(growspace_id);
create index plants_container_id_idx on plants(container_id);

alter table growspaces enable row level security;
alter table containers enable row level security;
alter table plants enable row level security;
alter table fertilizers enable row level security;
alter table seed_packs enable row level security;
alter table growing_mediums enable row level security;

create policy "Users manage their own growspaces"
  on growspaces for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own containers"
  on containers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own plants"
  on plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own fertilizers"
  on fertilizers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own seed packs"
  on seed_packs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own growing mediums"
  on growing_mediums for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Photo storage. Paths are namespaced as "<user_id>/<entity>/<filename>", e.g.
-- "3fa8.../plants/photo-1699999999.jpg". Reads are public; writes are confined
-- to the caller's own folder by matching the first path segment.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "Users upload to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update their own files"
  on storage.objects for update
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own files"
  on storage.objects for delete
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
