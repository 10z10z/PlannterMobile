-- Plannter schema, migration 0005: the conditions a germination station is kept at.
-- Run this in the Supabase SQL editor after 0004_station_lights.sql.
--
-- Temperature is stored in Celsius, following the same rule as volumes and
-- lengths: metric in the database, converted only for display. Humidity is a
-- percentage, which needs no conversion.
--
-- Both are optional — a windowsill has whatever conditions the room has, and
-- only a propagator with a thermostat has figures worth recording.
alter table germination_stations
  add column temp_c numeric,
  add column humidity_pct numeric check (humidity_pct >= 0 and humidity_pct <= 100);
