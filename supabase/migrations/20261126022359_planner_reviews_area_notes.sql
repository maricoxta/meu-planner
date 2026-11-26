alter table planner.reviews
  add column area_notes jsonb not null default '{}'::jsonb
  check (jsonb_typeof(area_notes) = 'object' and length(area_notes::text) <= 20000);
