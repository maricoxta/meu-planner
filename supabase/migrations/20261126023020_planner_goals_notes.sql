alter table planner.goals add column notes text check (length(notes) <= 2000);
