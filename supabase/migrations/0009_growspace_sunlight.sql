-- How much direct sun an outdoor growspace gets.
--
-- Sunlight sits on the growspace rather than among its lights: the light rows
-- point at fixtures in the inventory, and the sun is not something a grower owns
-- a quantity of. A space can still hold both — a greenhouse supplementing short
-- winter days is exactly that — so this is added alongside the fixtures rather
-- than in place of them.
alter table growspaces
  add column sun_hours numeric check (sun_hours >= 0 and sun_hours <= 24);
