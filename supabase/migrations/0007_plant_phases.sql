-- What a plant is and how far along it is.
--
-- The crop is copied onto the plant rather than read back through the seed pack
-- it came from, for the same reason a sowing keeps its own grid dimensions: the
-- pack can be edited or thrown away, and a plant that has been growing for two
-- months shouldn't change species because its pack was corrected.
alter table plants
  add column plant_type text,
  -- Carried over from the cell the seedling came up in, so the phase is counted
  -- from when it actually germinated rather than from when it was potted on.
  add column germinated_on date,
  -- When it was moved into the growspace. Null on plants that predate this
  -- column, which fall back to when their row was created.
  add column transplanted_on date;
