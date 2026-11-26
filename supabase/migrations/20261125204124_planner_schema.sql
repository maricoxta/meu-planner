create schema if not exists planner;
grant usage on schema planner to authenticated, service_role;

-- Refresh token do Google: nunca acessível pelo navegador, só pela edge function (service_role)
create table planner.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table planner.google_tokens enable row level security;
grant all on planner.google_tokens to service_role;

create table planner.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references planner.tasks(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  notes text,
  category text not null default 'pessoal' check (category in ('estudos','trabalho','ingles','pessoal','saude')),
  priority smallint not null default 2 check (priority between 1 and 3),
  due_date date,
  start_at timestamptz,
  duration_min int check (duration_min between 5 and 1440),
  reminder_min int default 30 check (reminder_min between 0 and 40320),
  is_top3 boolean not null default false,
  status text not null default 'todo' check (status in ('todo','done')),
  done_at timestamptz,
  gcal_event_id text,
  created_at timestamptz not null default now()
);
create index on planner.tasks (user_id, due_date);
create index on planner.tasks (user_id, start_at);
create index on planner.tasks (parent_id);

create table planner.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  category text not null default 'pessoal' check (category in ('estudos','trabalho','ingles','pessoal','saude')),
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table planner.habit_logs (
  habit_id uuid not null references planner.habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  primary key (habit_id, day)
);
create index on planner.habit_logs (user_id, day);

create table planner.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  title text not null check (length(title) between 1 and 200),
  category text not null default 'pessoal' check (category in ('estudos','trabalho','ingles','pessoal','saude')),
  target numeric not null default 1 check (target > 0),
  progress numeric not null default 0 check (progress >= 0),
  unit text,
  created_at timestamptz not null default now()
);
create index on planner.goals (user_id, month);

create table planner.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  wins text, blockers text, next_focus text,
  mood smallint check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

do $$
declare t text;
begin
  foreach t in array array['tasks','habits','habit_logs','goals','reviews'] loop
    execute format('alter table planner.%I enable row level security', t);
    execute format('grant select, insert, update, delete on planner.%I to authenticated', t);
    execute format('grant all on planner.%I to service_role', t);
    execute format($p$create policy own_rows on planner.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;
