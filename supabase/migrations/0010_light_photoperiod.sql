-- How long the lights are run where they hang.
--
-- The cycle sits on the assignment rather than on the fixture: the same lamp
-- runs 18/6 over a veg tent and 12/12 over a flowering one, and a grower who
-- owns three of a model may well be running them to two different clocks. Off
-- hours are not stored — they are whatever is left of the day.
alter table growspace_lights
  add column hours_on numeric check (hours_on >= 0 and hours_on <= 24);

alter table station_lights
  add column hours_on numeric check (hours_on >= 0 and hours_on <= 24);
