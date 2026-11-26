-- Tema de cada pessoa
create table planner.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'azul' check (theme in ('flores','azul')),
  updated_at timestamptz not null default now()
);
alter table planner.profiles enable row level security;
grant select, insert, update on planner.profiles to authenticated;
grant all on planner.profiles to service_role;
create policy own_profile on planner.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A dona atual do planner fica com o tema de flores
insert into planner.profiles (user_id, theme)
select user_id, 'flores' from planner.google_tokens on conflict do nothing;

-- Compartilhamento: a dona libera leitura para um e-mail
create table planner.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_email text not null default (auth.jwt() ->> 'email'),
  owner_name text check (length(owner_name) <= 100),
  viewer_email text not null check (viewer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(viewer_email) <= 254),
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_email)
);
create index on planner.shares (lower(viewer_email));
alter table planner.shares enable row level security;
grant select, insert, delete on planner.shares to authenticated;
grant all on planner.shares to service_role;
create policy owner_manages on planner.shares for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and owner_email = (select auth.jwt() ->> 'email'));
create policy viewer_sees on planner.shares for select to authenticated
  using (lower(viewer_email) = lower((select auth.jwt() ->> 'email')));

-- Quem pode ver o planner de "owner"? (security invoker: respeita o RLS de shares)
create function planner.can_view(owner uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from planner.shares s
    where s.owner_id = owner and lower(s.viewer_email) = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function planner.can_view(uuid) from public;
grant execute on function planner.can_view(uuid) to authenticated;

-- Leitura compartilhada (somente SELECT; escrita continua só da dona)
do $$
declare t text;
begin
  foreach t in array array['tasks','habits','habit_logs','goals','reviews'] loop
    execute format('create policy shared_read on planner.%I for select to authenticated using (planner.can_view(user_id))', t);
  end loop;
end $$;
