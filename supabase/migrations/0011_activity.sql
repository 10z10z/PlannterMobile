-- Plannter schema, migration 0011: the activity log, feedings and scheduling.
-- Run this in the Supabase SQL editor after 0010_light_photoperiod.sql.
--
-- The calendar answers "what did I do that day", so the log is written as
-- plainly as it is read: one row per thing the grower did, carrying enough text
-- to describe itself. The rows it points at are all soft links — deleting a
-- sowing or a plant leaves the entry in the calendar, because the day it was
-- sown still happened.

-- One recorded action.
--
-- `subject` and `detail` are snapshots rather than joins for exactly that
-- reason: a plant that has since been pulled, or a pack that was thrown away,
-- would otherwise turn its own history into blanks.
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'sown', 'germinated', 'thinned', 'transplanted',
    'planted', 'moved', 'watered', 'fed', 'removed'
  )),
  -- The calendar day it belongs on, which is not always today: a sowing can be
  -- recorded a couple of days after it went in.
  occurred_on date not null default current_date,
  -- Where it happened. A transplant is two events, one leaving its station and
  -- one arriving in its growspace, so each side shows up on its own calendar.
  growspace_id uuid references growspaces(id) on delete set null,
  station_id uuid references germination_stations(id) on delete set null,
  subject text not null,
  detail text,
  -- What it happened to, for tapping through while the row is still there.
  sowing_id uuid references sowings(id) on delete set null,
  plant_id uuid references plants(id) on delete set null,
  feeding_id uuid,
  created_at timestamptz not null default now()
);

-- What went into the water, once. The mix is its own row because a feed is
-- rarely one bottle, and because the NPK calculator can hand a whole mixture
-- over to be recorded as it was poured.
create table feedings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fed_on date not null default current_date,
  growspace_id uuid references growspaces(id) on delete set null,
  station_id uuid references germination_stations(id) on delete set null,
  -- The batch that was mixed, in litres like every other volume in the schema.
  volume_liters numeric check (volume_liters > 0),
  note text,
  created_at timestamptz not null default now()
);

-- One product in a feed, at the rate it was mixed at.
--
-- Doses are per litre, matching the calculator's own maths, and the name is
-- copied in so a feed still reads correctly after the product is edited or
-- deleted in Inventory.
create table feeding_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feeding_id uuid not null references feedings(id) on delete cascade,
  fertilizer_id uuid references fertilizers(id) on delete set null,
  fertilizer_name text not null,
  form text not null default 'liquid' check (form in ('liquid', 'solid')),
  dose_per_liter numeric not null check (dose_per_liter >= 0)
);

-- Which plants got it, when the feed went to some of them rather than to
-- everything in the space. No rows means the whole growspace or station.
create table feeding_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feeding_id uuid not null references feedings(id) on delete cascade,
  plant_id uuid references plants(id) on delete set null,
  plant_name text not null
);

alter table activity_events
  add constraint activity_events_feeding_fkey
  foreign key (feeding_id) references feedings(id) on delete cascade;

-- Something to do, on a day, optionally at a time.
--
-- Scheduling never performs the work: the notification is a nudge, and the
-- calendar entry opens the same form the action is normally done through. What
-- is stored is therefore an intention — a crop and a place — rather than a
-- half-filled sowing.
create table scheduled_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('sow', 'transplant', 'thin', 'feed', 'water', 'other')),
  due_on date not null,
  -- Minutes past local midnight for the reminder, or null for a day with no
  -- notification. Stored as a plain offset rather than a timestamp because it
  -- is a wall-clock time: 8am stays 8am wherever the phone happens to be.
  due_minutes integer check (due_minutes >= 0 and due_minutes < 1440),
  growspace_id uuid references growspaces(id) on delete cascade,
  station_id uuid references germination_stations(id) on delete cascade,
  -- What is to be planted or fed, in the grower's own words. A seed pack can be
  -- named alongside it, and is what prefills the form on the day.
  subject text not null,
  note text,
  seed_pack_id uuid references seed_packs(id) on delete set null,
  -- Stamped when it is marked done, so a past-due entry can still be seen and
  -- ticked off rather than quietly disappearing.
  done_on date,
  created_at timestamptz not null default now()
);

create index activity_events_occurred_on_idx on activity_events(user_id, occurred_on);
create index activity_events_growspace_id_idx on activity_events(growspace_id);
create index activity_events_station_id_idx on activity_events(station_id);
create index feeding_products_feeding_id_idx on feeding_products(feeding_id);
create index feeding_plants_feeding_id_idx on feeding_plants(feeding_id);
create index scheduled_actions_due_on_idx on scheduled_actions(user_id, due_on);

alter table activity_events enable row level security;
alter table feedings enable row level security;
alter table feeding_products enable row level security;
alter table feeding_plants enable row level security;
alter table scheduled_actions enable row level security;

create policy "Users manage their own activity events"
  on activity_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own feedings"
  on feedings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own feeding products"
  on feeding_products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own feeding plants"
  on feeding_plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own scheduled actions"
  on scheduled_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
