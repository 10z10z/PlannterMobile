-- Plannter schema, migration 0013: length caps and sanity ranges.
-- Run this in the Supabase SQL editor after 0012_scheduled_action_targets.sql.
--
-- The app validates all of this before it writes (lib/validation.js and
-- lib/schemas.js), so nothing here should ever fire for someone using the
-- app. That is exactly why it belongs in the database too: a check that only
-- exists in the client is a check that stops existing the moment anything else
-- writes — a script, the Supabase table editor, a future version of the app
-- that forgets. The limits are the same numbers on both sides; if one moves,
-- move the other.
--
-- What is already constrained by earlier migrations is not repeated here:
-- humidity, sun hours, photoperiod, quantities being positive, grid sides being
-- positive, germinated <= seeds_planted, and the enum columns.
--
-- This runs as one transaction, so if any existing row falls outside a limit
-- the whole thing rolls back and nothing is half-applied. If that happens, the
-- error names the constraint; find the row it objects to, fix or delete it, and
-- run this again.

begin;

-- ---------------------------------------------------------------------------
-- Text lengths
--
-- 80 for a name is long enough for "Cherokee Purple (saved seed, 2024)" and
-- short enough to render in a chip. Anything past these is a paste accident
-- rather than a name.
-- ---------------------------------------------------------------------------

alter table growspaces
  add constraint growspaces_name_length check (length(name) <= 80),
  add constraint growspaces_description_length check (length(description) <= 500);

alter table growspace_grids
  add constraint growspace_grids_name_length check (length(name) <= 80);

alter table plants
  add constraint plants_name_length check (length(name) <= 80),
  add constraint plants_species_length check (length(species) <= 80),
  add constraint plants_plant_type_length check (length(plant_type) <= 80);

alter table containers
  add constraint containers_image_url_length check (length(image_url) <= 2048);

alter table fertilizers
  add constraint fertilizers_name_length check (length(name) <= 80);

alter table seed_packs
  add constraint seed_packs_name_length check (length(name) <= 80),
  add constraint seed_packs_plant_type_length check (length(plant_type) <= 80);

alter table growing_mediums
  add constraint growing_mediums_name_length check (length(name) <= 80);

alter table grow_lights
  add constraint grow_lights_name_length check (length(name) <= 80),
  add constraint grow_lights_ip_rating_length check (length(ip_rating) <= 10);

alter table trays
  add constraint trays_name_length check (length(name) <= 80);

alter table germination_stations
  add constraint germination_stations_name_length check (length(name) <= 80);

alter table sowings
  add constraint sowings_seed_pack_name_length check (length(seed_pack_name) <= 80);

alter table feedings
  add constraint feedings_note_length check (length(note) <= 2000);

alter table feeding_products
  add constraint feeding_products_name_length check (length(fertilizer_name) <= 80);

alter table feeding_plants
  add constraint feeding_plants_name_length check (length(plant_name) <= 80);

alter table scheduled_actions
  add constraint scheduled_actions_subject_length check (length(subject) <= 80),
  add constraint scheduled_actions_note_length check (length(note) <= 2000);

alter table scheduled_action_targets
  add constraint scheduled_action_targets_label_length check (length(label) <= 80);

-- ---------------------------------------------------------------------------
-- Grid sizes
--
-- A grid is drawn cell by cell, so its size is a rendering budget: the 999 x 999
-- a bare parseInt would once have accepted is a million views. The cap on cells
-- is what actually protects the app; the cap per side only keeps a single row
-- from being absurd. 500 cells clears the largest plug tray sold — a 288-cell
-- 1020 is 24 x 12 — with room over.
-- ---------------------------------------------------------------------------

alter table growspace_grids
  add constraint growspace_grids_side_limit
    check (grid_rows <= 50 and grid_cols <= 50),
  add constraint growspace_grids_cell_limit
    check (grid_rows * grid_cols <= 500);

alter table trays
  add constraint trays_side_limit check (grid_rows <= 50 and grid_cols <= 50),
  add constraint trays_cell_limit check (grid_rows * grid_cols <= 500);

-- A sowing's grid is copied from the tray it was sown into, so it inherits the
-- same ceiling.
alter table sowings
  add constraint sowings_side_limit check (grid_rows <= 50 and grid_cols <= 50),
  add constraint sowings_cell_limit check (grid_rows * grid_cols <= 500);

-- ---------------------------------------------------------------------------
-- Counts
-- ---------------------------------------------------------------------------

alter table containers
  add constraint containers_quantity_limit check (quantity <= 9999),
  add constraint containers_volume_positive check (volume_liters > 0),
  add constraint containers_volume_limit check (volume_liters <= 1000);

alter table trays
  add constraint trays_quantity_limit check (quantity <= 9999),
  add constraint trays_cell_volume_range
    check (cell_volume_ml is null or (cell_volume_ml >= 0 and cell_volume_ml <= 10000));

alter table growing_mediums
  add constraint growing_mediums_quantity_limit check (quantity <= 9999),
  add constraint growing_mediums_volume_range
    check (volume_liters is null or (volume_liters >= 0 and volume_liters <= 1000));

alter table grow_lights
  add constraint grow_lights_quantity_limit check (quantity <= 9999);

-- Seeds are the exception to the four-figure rule: bulk lettuce and carrot come
-- by the thousand.
alter table seed_packs
  add constraint seed_packs_seed_count_range
    check (seed_count is null or (seed_count >= 0 and seed_count <= 100000)),
  add constraint seed_packs_germination_days_range
    check (
      (germination_days_min is null or germination_days_min between 0 and 365)
      and (germination_days_max is null or germination_days_max between 0 and 365)
    ),
  -- A window has to be a window.
  add constraint seed_packs_germination_window
    check (
      germination_days_min is null
      or germination_days_max is null
      or germination_days_min <= germination_days_max
    );

-- Two or three seeds per cell is normal and gets thinned; a hundred is someone
-- typing a whole packet into the wrong field.
alter table sowing_cells
  add constraint sowing_cells_seeds_limit check (seeds_planted <= 100);

-- The interval a watering reminder is booked from, so a nonsense figure here is
-- a notification at a nonsense time.
alter table plants
  add constraint plants_watering_interval_range
    check (watering_interval_days between 1 and 365),
  add constraint plants_seedling_count_limit check (seedling_count <= 9999);

-- ---------------------------------------------------------------------------
-- Measurements
-- ---------------------------------------------------------------------------

-- Frost to a closed greenhouse in August. Stored in Celsius whatever the device
-- is set to display.
alter table growspaces
  add constraint growspaces_temp_range
    check (temp_c is null or temp_c between -20 and 60);

alter table germination_stations
  add constraint germination_stations_temp_range
    check (temp_c is null or temp_c between -20 and 60);

alter table grow_lights
  add constraint grow_lights_watts_range
    check (watts is null or (watts >= 0 and watts <= 10000)),
  -- Below 1000 K nothing emits usefully; above 12000 is aquarium territory.
  add constraint grow_lights_color_temp_range
    check (color_temp_k is null or color_temp_k between 1000 and 12000),
  add constraint grow_lights_ppf_range
    check (ppf_umol_s is null or (ppf_umol_s >= 0 and ppf_umol_s <= 10000)),
  -- Physics caps efficacy near 5; the best fixtures sold are about 3.5.
  add constraint grow_lights_efficacy_range
    check (efficacy_umol_j is null or (efficacy_umol_j >= 0 and efficacy_umol_j <= 5)),
  -- Full midday sun is about 2000, so 3000 is generous.
  add constraint grow_lights_ppfd_range
    check (ppfd_umol_m2_s is null or (ppfd_umol_m2_s >= 0 and ppfd_umol_m2_s <= 3000)),
  add constraint grow_lights_distance_range
    check (ppfd_distance_cm is null or (ppfd_distance_cm >= 0 and ppfd_distance_cm <= 500)),
  add constraint grow_lights_coverage_range
    check (
      (coverage_width_cm is null or (coverage_width_cm >= 0 and coverage_width_cm <= 500))
      and (coverage_depth_cm is null or (coverage_depth_cm >= 0 and coverage_depth_cm <= 500))
    ),
  add constraint grow_lights_beam_angle_range
    check (beam_angle_deg is null or beam_angle_deg between 0 and 360);

-- ---------------------------------------------------------------------------
-- Nutrient figures
--
-- Percentages by weight, as printed on the label; pH on its own scale. Applied
-- to both tables that carry a nutrient profile.
-- ---------------------------------------------------------------------------

alter table fertilizers
  add constraint fertilizers_nutrients_range
    check (
      coalesce(n, 0) between 0 and 100 and coalesce(p, 0) between 0 and 100
      and coalesce(k, 0) between 0 and 100 and coalesce(ca, 0) between 0 and 100
      and coalesce(mg, 0) between 0 and 100 and coalesce(s, 0) between 0 and 100
      and coalesce(fe, 0) between 0 and 100 and coalesce(mn, 0) between 0 and 100
      and coalesce(zn, 0) between 0 and 100 and coalesce(b, 0) between 0 and 100
      and coalesce(cu, 0) between 0 and 100 and coalesce(mo, 0) between 0 and 100
    ),
  add constraint fertilizers_doses_range
    check (
      coalesce(foliar_dose_min, 0) between 0 and 1000
      and coalesce(foliar_dose_max, 0) between 0 and 1000
      and coalesce(fertigation_dose_min, 0) between 0 and 1000
      and coalesce(fertigation_dose_max, 0) between 0 and 1000
    ),
  -- A dose range printed on a bottle runs low to high.
  add constraint fertilizers_dose_ranges_ordered
    check (
      (foliar_dose_min is null or foliar_dose_max is null
        or foliar_dose_min <= foliar_dose_max)
      and (fertigation_dose_min is null or fertigation_dose_max is null
        or fertigation_dose_min <= fertigation_dose_max)
    );

alter table growing_mediums
  add constraint growing_mediums_nutrients_range
    check (
      coalesce(n, 0) between 0 and 100 and coalesce(p, 0) between 0 and 100
      and coalesce(k, 0) between 0 and 100 and coalesce(ca, 0) between 0 and 100
      and coalesce(mg, 0) between 0 and 100 and coalesce(s, 0) between 0 and 100
      and coalesce(fe, 0) between 0 and 100 and coalesce(mn, 0) between 0 and 100
      and coalesce(zn, 0) between 0 and 100 and coalesce(b, 0) between 0 and 100
      and coalesce(cu, 0) between 0 and 100 and coalesce(mo, 0) between 0 and 100
    ),
  add constraint growing_mediums_ph_range
    check (
      (ph_min is null or ph_min between 0 and 14)
      and (ph_max is null or ph_max between 0 and 14)
    ),
  add constraint growing_mediums_ph_ordered
    check (ph_min is null or ph_max is null or ph_min <= ph_max),
  add constraint growing_mediums_ec_range
    check (ec is null or (ec >= 0 and ec <= 10));

-- A recorded feed's own figures.
alter table feedings
  add constraint feedings_volume_limit check (volume_liters is null or volume_liters <= 10000);

alter table feeding_products
  add constraint feeding_products_dose_limit check (dose_per_liter <= 1000);

commit;
