-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) for a fresh project.

create table growspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growspace_id uuid not null references growspaces(id) on delete cascade,
  name text not null,
  species text,
  watering_interval_days integer not null default 7,
  last_watered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table growspaces enable row level security;
alter table plants enable row level security;

create policy "Users manage their own growspaces"
  on growspaces for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own plants"
  on plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index plants_growspace_id_idx on plants(growspace_id);
