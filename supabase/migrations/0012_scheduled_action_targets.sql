-- What a planned action is actually aimed at.
--
-- Until now a scheduled action named a place and said the rest in words: "feed
-- the tent", "transplant the chillies". That is enough to remind someone, but
-- not enough to carry into the form on the day, and not enough for the entry to
-- still mean something a fortnight later. So the plants and the sowings a plan
-- is about are recorded alongside it.
--
-- One row is one thing aimed at. No rows at all means the whole place, which is
-- the same rule `feeding_plants` already follows — a feed with no plants listed
-- went to the entire growspace.
--
-- Cells are deliberately not targetable. A tray is planned for; which of its
-- cells are ready is decided on the day, because by then more will have come up.
create table scheduled_action_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null references scheduled_actions(id) on delete cascade,
  -- Set null rather than cascade, with the name kept alongside: deleting the
  -- target row instead would leave the plan with no targets, and a plan with no
  -- targets means the whole place — so removing one plant would silently widen
  -- "these three" into "everything in the tent".
  plant_id uuid references plants(id) on delete set null,
  sowing_id uuid references sowings(id) on delete set null,
  -- What it was called when it was planned, so the entry still reads after the
  -- plant is potted on or the sowing is thinned away.
  label text not null,
  created_at timestamptz not null default now(),
  -- Exactly one thing per row: a target is a plant or a sowing, never both and
  -- never neither.
  constraint scheduled_action_targets_one_subject check (
    (plant_id is not null and sowing_id is null)
    or (plant_id is null and sowing_id is not null)
    -- Both null is allowed only once the row it pointed at has been deleted,
    -- which the label is there to survive.
    or (plant_id is null and sowing_id is null)
  )
);

create index scheduled_action_targets_action_id_idx
  on scheduled_action_targets(action_id);

alter table scheduled_action_targets enable row level security;

create policy "Users manage their own scheduled action targets"
  on scheduled_action_targets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
