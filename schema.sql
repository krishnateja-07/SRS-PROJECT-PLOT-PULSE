-- ==============================================================================
-- Community Garden Planner - complete database setup (Supabase / Postgres)
-- Run this whole file once in Supabase > SQL Editor. Sections run in order:
--   1 schema, 2 sample data (optional), 3 search + monitoring, 4 accounts/multi-tenancy
-- Optional extras are at the very bottom, commented out.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART: 001_garden_schema
-- ------------------------------------------------------------------------------
-- =====================================================================
-- Community Garden Planner schema (all objects prefixed garden_)
-- =====================================================================
create extension if not exists pgcrypto;

create sequence if not exists garden_bed_code_seq start 1;

create table if not exists public.garden_beds (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique default ('BED-' || lpad(nextval('garden_bed_code_seq')::text, 3, '0')),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  length_m    numeric(6,2) not null check (length_m > 0 and length_m <= 100),
  width_m     numeric(6,2) not null check (width_m > 0 and width_m <= 100),
  soil_type   text not null check (soil_type in ('Loamy','Sandy','Clay','Silty','Peaty','Chalky','Potting mix')),
  zone        text check (zone is null or char_length(zone) <= 40),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_at  timestamptz not null default now()
);

create table if not exists public.garden_plants (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (char_length(btrim(name)) between 1 and 60),
  category               text not null check (category in ('Vegetable','Leafy green','Root','Herb','Fruit','Legume','Grain','Flower')),
  bed_id                 uuid references public.garden_beds(id) on delete set null,
  sowing_date            date,
  expected_harvest_date  date,
  status                 text not null default 'planned' check (status in ('planned','sown','germinating','growing','flowering','ready','harvested')),
  quantity               integer not null default 1 check (quantity between 1 and 10000),
  notes                  text check (notes is null or char_length(notes) <= 500),
  created_at             timestamptz not null default now(),
  constraint garden_plants_harvest_after_sowing check (expected_harvest_date is null or sowing_date is null or expected_harvest_date >= sowing_date)
);
create index if not exists garden_plants_bed_idx on public.garden_plants(bed_id);

create table if not exists public.garden_sowing_records (
  id          uuid primary key default gen_random_uuid(),
  plant_id    uuid not null references public.garden_plants(id) on delete cascade,
  bed_id      uuid references public.garden_beds(id) on delete set null,
  sown_on     date not null,
  quantity    integer not null default 1 check (quantity > 0),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists garden_sowing_plant_idx on public.garden_sowing_records(plant_id);
create index if not exists garden_sowing_bed_idx on public.garden_sowing_records(bed_id);

create table if not exists public.garden_harvests (
  id            uuid primary key default gen_random_uuid(),
  plant_id      uuid references public.garden_plants(id) on delete set null,
  plant_name    text not null check (char_length(btrim(plant_name)) between 1 and 60),
  bed_id        uuid references public.garden_beds(id) on delete set null,
  harvested_on  date not null,
  quantity      numeric(10,2) not null check (quantity > 0 and quantity <= 100000),
  unit          text not null check (unit in ('kg','g','lb','pieces','bunches')),
  notes         text check (notes is null or char_length(notes) <= 500),
  created_at    timestamptz not null default now()
);
create index if not exists garden_harvests_date_idx on public.garden_harvests(harvested_on);
create index if not exists garden_harvests_plant_idx on public.garden_harvests(plant_id);
create index if not exists garden_harvests_bed_idx on public.garden_harvests(bed_id);

create table if not exists public.garden_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  type        text not null default 'other' check (type in ('sow','water','fertilize','prune','weed','harvest','other')),
  due_date    date not null,
  bed_id      uuid references public.garden_beds(id) on delete set null,
  plant_id    uuid references public.garden_plants(id) on delete cascade,
  done        boolean not null default false,
  notes       text check (notes is null or char_length(notes) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists garden_tasks_due_idx on public.garden_tasks(due_date);
create index if not exists garden_tasks_bed_idx on public.garden_tasks(bed_id);
create index if not exists garden_tasks_plant_idx on public.garden_tasks(plant_id);

create table if not exists public.garden_ai_history (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('recommendation','health','chat')),
  input       jsonb not null default '{}'::jsonb,
  output      jsonb not null default '{}'::jsonb,
  demo        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Every time a plant gets (or changes) a sowing date, log a sowing record.
create or replace function public.garden_log_sowing() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.sowing_date is not null and (tg_op = 'INSERT' or new.sowing_date is distinct from old.sowing_date) then
    insert into public.garden_sowing_records (plant_id, bed_id, sown_on, quantity)
    values (new.id, new.bed_id, new.sowing_date, new.quantity);
  end if;
  return new;
end $$;

drop trigger if exists garden_plants_sowing on public.garden_plants;
create trigger garden_plants_sowing after insert or update of sowing_date on public.garden_plants
for each row execute function public.garden_log_sowing();

-- Row level security: this is an open community board (no sign-in), so the
-- anon role may read and write garden_ tables only. Nothing else is exposed.
do $$
declare t text;
begin
  foreach t in array array['garden_beds','garden_plants','garden_sowing_records','garden_harvests','garden_tasks','garden_ai_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s community read" on public.%I', t, t);
    execute format('create policy "%s community read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy "%s community insert" on public.%I for insert to anon, authenticated with check (true)', t, t);
    execute format('create policy "%s community update" on public.%I for update to anon, authenticated using (true) with check (true)', t, t);
    execute format('create policy "%s community delete" on public.%I for delete to anon, authenticated using (true)', t, t);
  end loop;
end $$;

grant usage on sequence garden_bed_code_seq to anon, authenticated;


-- ------------------------------------------------------------------------------
-- PART: 002_garden_seed
-- ------------------------------------------------------------------------------
-- Sample data so the planner has something to show on first launch.
-- Dates are relative to today so the calendar and charts always look current.
insert into public.garden_beds (name, length_m, width_m, soil_type, zone, notes) values
  ('Sunny Corner',      2.4, 1.2, 'Loamy',       'Zone A', 'Full sun all afternoon'),
  ('Herb Spiral',       1.5, 1.5, 'Sandy',       'Zone A', 'Near the tap'),
  ('Tomato Row',        3.0, 1.0, 'Loamy',       'Zone B', 'Staked with bamboo'),
  ('Root Bed',          2.4, 1.2, 'Silty',       'Zone B', 'Sifted, stone-free soil'),
  ('Leafy Greens',      2.0, 1.2, 'Loamy',       'Zone C', 'Partial shade after 3 pm'),
  ('Berry Patch',       2.4, 1.0, 'Peaty',       'Zone C', 'Mulched with straw'),
  ('Three Sisters',     3.0, 1.5, 'Clay',        'Zone D', 'Corn, beans and squash'),
  ('Seedling Nursery',  1.2, 0.8, 'Potting mix', 'Greenhouse', 'Trays and plugs'),
  ('East Fence Bed',    2.0, 0.9, 'Sandy',       'Zone D', 'Free for the next crop');

with b as (select id, name from public.garden_beds)
insert into public.garden_plants (name, category, bed_id, sowing_date, expected_harvest_date, status, quantity, notes)
select p.name, p.category, (select id from b where b.name = p.bed), current_date + p.sow, current_date + p.sow + p.days, p.status, p.qty, p.notes
from (values
  ('Tomato',     'Vegetable',   'Tomato Row',     -62, 75, 'flowering', 8,  'Cherry variety'),
  ('Basil',      'Herb',        'Herb Spiral',    -40, 55, 'growing',   6,  'Pinch tips weekly'),
  ('Mint',       'Herb',        'Herb Spiral',    -70, 60, 'ready',     3,  null),
  ('Carrot',     'Root',        'Root Bed',       -50, 75, 'growing',   40, 'Thinned to 5 cm'),
  ('Radish',     'Root',        'Root Bed',       -24, 28, 'ready',     30, null),
  ('Lettuce',    'Leafy green', 'Leafy Greens',   -30, 50, 'growing',   12, 'Butterhead'),
  ('Spinach',    'Leafy green', 'Leafy Greens',   -20, 45, 'germinating', 20, null),
  ('Kale',       'Leafy green', 'Sunny Corner',   -45, 60, 'growing',   6,  null),
  ('Chilli',     'Vegetable',   'Sunny Corner',   -55, 90, 'flowering', 5,  null),
  ('Strawberry', 'Fruit',       'Berry Patch',    -90, 100, 'ready',    10, 'Second flush'),
  ('Sweet corn', 'Grain',       'Three Sisters',  -48, 85, 'growing',   12, null),
  ('Beans',      'Legume',      'Three Sisters',  -35, 60, 'flowering', 16, 'Climbing the corn'),
  ('Cucumber',   'Vegetable',   'Three Sisters',  -30, 60, 'growing',   4,  null),
  ('Marigold',   'Flower',      'Seedling Nursery', -10, 60, 'sown',    24, 'Companion for tomatoes'),
  ('Coriander',  'Herb',        'Seedling Nursery', -5,  45, 'sown',    30, null),
  ('Okra',       'Vegetable',   null,              14,  60, 'planned',  8,  'Waiting for a free bed')
) as p(name, category, bed, sow, days, status, qty, notes);

-- Harvest history across the last six months
insert into public.garden_harvests (plant_name, plant_id, bed_id, harvested_on, quantity, unit, notes)
select h.plant, pl.id, pl.bed_id, current_date - h.ago, h.qty, h.unit, h.notes
from (values
  ('Radish', 170, 2.1, 'kg', null), ('Lettuce', 160, 1.4, 'kg', null), ('Spinach', 150, 900, 'g', null),
  ('Strawberry', 140, 1.8, 'kg', 'First flush'), ('Mint', 130, 6, 'bunches', null), ('Radish', 120, 2.6, 'kg', null),
  ('Tomato', 110, 4.2, 'kg', null), ('Basil', 100, 8, 'bunches', null), ('Kale', 95, 1.6, 'kg', null),
  ('Tomato', 85, 6.8, 'kg', 'Peak week'), ('Cucumber', 80, 14, 'pieces', null), ('Beans', 75, 3.1, 'kg', null),
  ('Chilli', 70, 0.9, 'kg', null), ('Carrot', 62, 4.4, 'kg', null), ('Sweet corn', 55, 18, 'pieces', null),
  ('Tomato', 50, 5.1, 'kg', null), ('Strawberry', 45, 2.4, 'kg', null), ('Lettuce', 38, 1.9, 'kg', null),
  ('Mint', 30, 5, 'bunches', null), ('Radish', 24, 1.7, 'kg', null), ('Beans', 18, 2.2, 'kg', null),
  ('Strawberry', 12, 1.3, 'kg', null), ('Basil', 7, 6, 'bunches', null), ('Tomato', 3, 2.9, 'kg', 'Late season')
) as h(plant, ago, qty, unit, notes)
left join lateral (select id, bed_id from public.garden_plants where name = h.plant limit 1) pl on true;

insert into public.garden_tasks (title, type, due_date, bed_id, done, notes)
select t.title, t.type, current_date + t.d, (select id from public.garden_beds where name = t.bed), t.done, null
from (values
  ('Water the herb spiral',          'water',     0,  'Herb Spiral', false),
  ('Thin carrot seedlings',          'weed',      1,  'Root Bed', false),
  ('Feed tomatoes with compost tea', 'fertilize', 2,  'Tomato Row', false),
  ('Harvest radishes',               'harvest',   3,  'Root Bed', false),
  ('Sow second lettuce batch',       'sow',       5,  'Leafy Greens', false),
  ('Prune strawberry runners',       'prune',     6,  'Berry Patch', false),
  ('Check beans for aphids',         'other',     9,  'Three Sisters', false),
  ('Transplant marigolds',           'sow',       12, 'Seedling Nursery', false),
  ('Turn compost pile',              'other',     -2, null, true),
  ('Weed the root bed',              'weed',      -1, 'Root Bed', false)
) as t(title, type, d, bed, done);


-- ------------------------------------------------------------------------------
-- PART: 003_search_and_monitoring
-- ------------------------------------------------------------------------------
-- =====================================================================
-- 003: Full-text search and AI-function monitoring
-- =====================================================================

-- ---------- Full-text search -------------------------------------------
-- Each searchable table gets a weighted tsvector (A = name/code, B = type,
-- C = notes) kept up to date by Postgres, plus a GIN index.
-- The 'simple' config (no stemming) keeps prefix search predictable for
-- short crop names and bed codes such as "tom" or "bed-00".

alter table public.garden_plants add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '') || ' ' || coalesce(status, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored;

alter table public.garden_beds add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(code, '') || ' ' || coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(soil_type, '') || ' ' || coalesce(zone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored;

alter table public.garden_harvests add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(plant_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unit, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored;

alter table public.garden_tasks add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored;

create index if not exists garden_plants_search_idx   on public.garden_plants   using gin (search);
create index if not exists garden_beds_search_idx     on public.garden_beds     using gin (search);
create index if not exists garden_harvests_search_idx on public.garden_harvests using gin (search);
create index if not exists garden_tasks_search_idx    on public.garden_tasks    using gin (search);

-- Turns free text into a prefix tsquery: "tom bed" -> 'tom':* & 'bed':*
-- Anything that is not a letter, digit or hyphen is dropped, so user input
-- can never produce a tsquery syntax error.
create or replace function public.garden_tsquery(q text)
returns tsquery
language sql immutable parallel safe set search_path = public, pg_catalog as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & ')) end
  from unnest(regexp_split_to_array(
         lower(regexp_replace(coalesce(left(q, 200), ''), '[^[:alnum:][:space:]-]+', ' ', 'g')), '\s+')) as w
  where w <> '' and w !~ '^-+$'
$$;

-- One ranked search across plants, beds, harvests and tasks.
-- security invoker: it sees exactly what the caller's RLS allows.
create or replace function public.garden_search(q text, max_results int default 20)
returns table (kind text, id uuid, title text, detail text, rank real)
language sql stable security invoker set search_path = public, pg_catalog as $$
  with query as (select public.garden_tsquery(q) as tsq)
  select r.kind, r.id, r.title, r.detail, r.rank from (
    select 'plant'::text as kind, p.id, p.name as title, p.category || ' · ' || p.status as detail, ts_rank(p.search, query.tsq) as rank
      from public.garden_plants p, query where query.tsq is not null and p.search @@ query.tsq
    union all
    select 'bed', b.id, b.code || ' · ' || b.name, b.soil_type || coalesce(' · ' || b.zone, ''), ts_rank(b.search, query.tsq)
      from public.garden_beds b, query where query.tsq is not null and b.search @@ query.tsq
    union all
    select 'harvest', h.id, h.plant_name, h.quantity::text || ' ' || h.unit || ' · ' || to_char(h.harvested_on, 'DD Mon YYYY'), ts_rank(h.search, query.tsq)
      from public.garden_harvests h, query where query.tsq is not null and h.search @@ query.tsq
    union all
    select 'task', t.id, t.title, t.type || ' · due ' || to_char(t.due_date, 'DD Mon YYYY'), ts_rank(t.search, query.tsq)
      from public.garden_tasks t, query where query.tsq is not null and t.search @@ query.tsq
  ) r
  order by r.rank desc, r.title
  limit greatest(1, least(coalesce(max_results, 20), 50))
$$;

grant execute on function public.garden_tsquery(text) to anon, authenticated;
grant execute on function public.garden_search(text, int) to anon, authenticated;

-- ---------- AI function monitoring ---------------------------------------
-- One row per call to the garden-ai edge function, written with the
-- service role. No policies are created, so anon/authenticated cannot read
-- or write this table directly; they only see the aggregate RPC below.
create table if not exists public.garden_function_logs (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  request_id   uuid not null,
  action       text not null,
  status       integer not null,
  duration_ms  integer not null check (duration_ms >= 0),
  demo         boolean not null default false,
  model        text,
  error        text check (error is null or char_length(error) <= 500),
  client_hash  text            -- salted SHA-256 of the caller's IP, used only for rate limiting
);
create index if not exists garden_function_logs_at_idx on public.garden_function_logs (at desc);
create index if not exists garden_function_logs_client_idx on public.garden_function_logs (client_hash, at desc);
alter table public.garden_function_logs enable row level security;

-- Aggregate health of the AI function for the last N hours (no raw rows,
-- no IP hashes, errors truncated). security definer so the app can show it.
create or replace function public.garden_ai_stats(hours int default 24)
returns jsonb
language sql stable security definer set search_path = public, pg_catalog as $$
  with w as (
    select * from public.garden_function_logs
    where at >= now() - make_interval(hours => greatest(1, least(coalesce(hours, 24), 720)))
  )
  select jsonb_build_object(
    'window_hours', greatest(1, least(coalesce(hours, 24), 720)),
    'total',        (select count(*) from w),
    'errors',       (select count(*) from w where status >= 500),
    'client_errors',(select count(*) from w where status between 400 and 499 and status <> 429),
    'rate_limited', (select count(*) from w where status = 429),
    'demo',         (select count(*) from w where demo),
    'avg_ms',       (select coalesce(round(avg(duration_ms)), 0) from w),
    'p95_ms',       (select coalesce(round(percentile_cont(0.95) within group (order by duration_ms)), 0) from w),
    'by_action',    (select coalesce(jsonb_object_agg(action, n), '{}'::jsonb) from (select action, count(*) n from w group by action) a),
    'last_error',   (select jsonb_build_object('at', at, 'action', action, 'status', status, 'message', left(error, 160))
                       from w where status >= 500 order by at desc limit 1),
    'last_call_at', (select max(at) from w)
  )
$$;
revoke all on function public.garden_ai_stats(int) from public;
grant execute on function public.garden_ai_stats(int) to anon, authenticated;

-- Retention: keep 30 days of logs (called by the edge function now and then).
create or replace function public.garden_prune_function_logs()
returns void language sql security definer set search_path = public, pg_catalog as $$
  delete from public.garden_function_logs where at < now() - interval '30 days'
$$;
revoke all on function public.garden_prune_function_logs() from public, anon, authenticated;


-- ------------------------------------------------------------------------------
-- PART: 004_auth_multitenant
-- ------------------------------------------------------------------------------
-- =====================================================================
-- 004: Accounts, multi-garden tenancy, role-based RLS and transactional RPCs
--
-- * garden_gardens      one row per garden (tenant)
-- * garden_members      who belongs to which garden, as owner / editor / viewer
-- * every data table gets garden_id; RLS checks the caller's role per garden
-- * visibility: 'private'     only members can see it
--               'public_read' anyone can see it, only members can edit
--               'public_open' anyone (even signed out) can see and edit
--                             (used only by the shared community demo garden)
-- * multi-table writes run inside single plpgsql functions = one transaction
-- =====================================================================

-- ---------- tenants ----------------------------------------------------
create table if not exists public.garden_gardens (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  visibility   text not null default 'private' check (visibility in ('private', 'public_read', 'public_open')),
  invite_code  text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.garden_members (
  garden_id    uuid not null references public.garden_gardens(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  email        text,
  joined_at    timestamptz not null default now(),
  primary key (garden_id, user_id)
);
create index if not exists garden_members_user_idx on public.garden_members (user_id);
create index if not exists garden_gardens_created_by_idx on public.garden_gardens (created_by);

-- The shared demo garden keeps all existing data and stays open to everyone.
insert into public.garden_gardens (id, name, visibility)
values ('0a4de000-0000-4000-8000-000000000001', 'Community Demo Garden', 'public_open')
on conflict (id) do nothing;

-- ---------- garden_id on every data table ----------------------------------
do $$
declare t text;
begin
  foreach t in array array['garden_beds','garden_plants','garden_sowing_records','garden_harvests','garden_tasks','garden_ai_history'] loop
    execute format('alter table public.%I add column if not exists garden_id uuid', t);
    execute format('update public.%I set garden_id = %L where garden_id is null', t, '0a4de000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column garden_id set default %L', t, '0a4de000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column garden_id set not null', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_garden_fk');
    execute format('alter table public.%I add constraint %I foreign key (garden_id) references public.garden_gardens(id) on delete cascade', t, t || '_garden_fk');
    execute format('create index if not exists %I on public.%I (garden_id)', t || '_garden_idx', t);
  end loop;
end $$;

-- Sowing records inherit the plant's garden.
create or replace function public.garden_log_sowing() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.sowing_date is not null and (tg_op = 'INSERT' or new.sowing_date is distinct from old.sowing_date) then
    insert into public.garden_sowing_records (garden_id, plant_id, bed_id, sown_on, quantity)
    values (new.garden_id, new.id, new.bed_id, new.sowing_date, new.quantity);
  end if;
  return new;
end $$;

-- ---------- permission helpers (used by every policy) ----------------------
-- Kept in a schema PostgREST does not expose, so they are not callable as /rpc.
create schema if not exists garden_private;
revoke all on schema garden_private from public;
grant usage on schema garden_private to anon, authenticated;

create or replace function garden_private.garden_role(g uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.garden_members m where m.garden_id = g and m.user_id = (select auth.uid())
$$;

create or replace function garden_private.garden_can_read(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.garden_gardens x where x.id = g and x.visibility in ('public_read', 'public_open'))
      or exists (select 1 from public.garden_members m where m.garden_id = g and m.user_id = (select auth.uid()))
$$;

create or replace function garden_private.garden_can_write(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.garden_gardens x where x.id = g and x.visibility = 'public_open')
      or exists (select 1 from public.garden_members m where m.garden_id = g and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor'))
$$;

grant execute on function garden_private.garden_role(uuid), garden_private.garden_can_read(uuid), garden_private.garden_can_write(uuid) to anon, authenticated;

-- ---------- RLS on data tables: per-garden, per-role ------------------------
do $$
declare t text; p record;
begin
  foreach t in array array['garden_beds','garden_plants','garden_sowing_records','garden_harvests','garden_tasks','garden_ai_history'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy "%s read"   on public.%I for select to anon, authenticated using (garden_private.garden_can_read(garden_id))', t, t);
    execute format('create policy "%s insert" on public.%I for insert to anon, authenticated with check (garden_private.garden_can_write(garden_id))', t, t);
    execute format('create policy "%s update" on public.%I for update to anon, authenticated using (garden_private.garden_can_write(garden_id)) with check (garden_private.garden_can_write(garden_id))', t, t);
    execute format('create policy "%s delete" on public.%I for delete to anon, authenticated using (garden_private.garden_can_write(garden_id))', t, t);
  end loop;
end $$;

-- ---------- RLS on gardens and members ------------------------------------
alter table public.garden_gardens enable row level security;
alter table public.garden_members enable row level security;

drop policy if exists "gardens read" on public.garden_gardens;
drop policy if exists "gardens create" on public.garden_gardens;
drop policy if exists "gardens update" on public.garden_gardens;
drop policy if exists "gardens delete" on public.garden_gardens;
create policy "gardens read"   on public.garden_gardens for select to anon, authenticated using (garden_private.garden_can_read(id));
create policy "gardens create" on public.garden_gardens for insert to authenticated
  with check (created_by = (select auth.uid()) and visibility in ('private', 'public_read'));
create policy "gardens update" on public.garden_gardens for update to authenticated
  using (garden_private.garden_role(id) = 'owner') with check (garden_private.garden_role(id) = 'owner' and visibility in ('private', 'public_read'));
create policy "gardens delete" on public.garden_gardens for delete to authenticated using (garden_private.garden_role(id) = 'owner');

drop policy if exists "members read" on public.garden_members;
create policy "members read" on public.garden_members for select to authenticated using (garden_private.garden_role(garden_id) is not null);
-- No insert/update/delete policies: membership changes only through the functions below.

-- The invite code is a secret: hide the column, expose it to owners via a function.
revoke select, insert, update on public.garden_gardens from anon, authenticated;
grant select (id, name, visibility, created_by, created_at) on public.garden_gardens to anon, authenticated;
grant insert (id, name, visibility, created_by) on public.garden_gardens to authenticated;
grant update (name, visibility) on public.garden_gardens to authenticated;
grant delete on public.garden_gardens to authenticated;
revoke insert, update, delete on public.garden_members from anon, authenticated;
grant select on public.garden_members to authenticated;

-- The creator of a garden becomes its owner, in the same transaction.
create or replace function public.garden_add_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.garden_members (garden_id, user_id, role, email)
    values (new.id, new.created_by, 'owner', (select u.email from auth.users u where u.id = new.created_by))
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists garden_gardens_owner on public.garden_gardens;
create trigger garden_gardens_owner after insert on public.garden_gardens for each row execute function public.garden_add_owner();

-- ---------- membership functions -----------------------------------------
create or replace function public.garden_join(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Sign in to join a garden' using errcode = '42501'; end if;
  select id into g from public.garden_gardens where invite_code = lower(btrim(p_code));
  if g is null then raise exception 'That invite code is not valid' using errcode = 'P0002'; end if;
  insert into public.garden_members (garden_id, user_id, role, email)
  values (g, me, 'editor', (select u.email from auth.users u where u.id = me))
  on conflict (garden_id, user_id) do nothing;
  return g;
end $$;

create or replace function public.garden_invite_code(p_garden uuid, p_rotate boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if garden_private.garden_role(p_garden) is distinct from 'owner' then raise exception 'Only the garden owner can see the invite code' using errcode = '42501'; end if;
  if p_rotate then
    update public.garden_gardens set invite_code = encode(extensions.gen_random_bytes(6), 'hex') where id = p_garden returning invite_code into c;
  else
    select invite_code into c from public.garden_gardens where id = p_garden;
  end if;
  return c;
end $$;

create or replace function public.garden_set_member_role(p_garden uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if garden_private.garden_role(p_garden) is distinct from 'owner' then raise exception 'Only the garden owner can change roles' using errcode = '42501'; end if;
  if p_role not in ('owner', 'editor', 'viewer') then raise exception 'Unknown role' using errcode = '22023'; end if;
  if p_role <> 'owner' and (select role from public.garden_members where garden_id = p_garden and user_id = p_user) = 'owner'
     and (select count(*) from public.garden_members where garden_id = p_garden and role = 'owner') = 1 then
    raise exception 'A garden needs at least one owner' using errcode = '23514';
  end if;
  update public.garden_members set role = p_role where garden_id = p_garden and user_id = p_user;
end $$;

create or replace function public.garden_remove_member(p_garden uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or (p_user <> me and garden_private.garden_role(p_garden) is distinct from 'owner') then
    raise exception 'Only the owner can remove other members' using errcode = '42501';
  end if;
  if (select role from public.garden_members where garden_id = p_garden and user_id = p_user) = 'owner'
     and (select count(*) from public.garden_members where garden_id = p_garden and role = 'owner') = 1 then
    raise exception 'The last owner cannot leave; delete the garden or make someone else owner first' using errcode = '23514';
  end if;
  delete from public.garden_members where garden_id = p_garden and user_id = p_user;
end $$;

-- ---------- transactional writes (security invoker: RLS still applies) ------
-- Assign several plants to a bed: all or nothing.
create or replace function public.garden_assign_plants(p_bed uuid, p_plants uuid[]) returns integer
language plpgsql security invoker set search_path = public as $$
declare g uuid; n integer;
begin
  select garden_id into g from public.garden_beds where id = p_bed;
  if g is null then raise exception 'Bed not found' using errcode = 'P0002'; end if;
  update public.garden_plants set bed_id = p_bed where id = any(p_plants) and garden_id = g;
  get diagnostics n = row_count;
  if n <> coalesce(array_length(p_plants, 1), 0) then
    raise exception 'Some plants could not be assigned (they may belong to another garden). Nothing was changed.' using errcode = '23514';
  end if;
  return n;
end $$;

-- Create a full care schedule (weekly watering, one feed, harvest) in one transaction.
create or replace function public.garden_create_care_schedule(p_plant uuid) returns integer
language plpgsql security invoker set search_path = public as $$
declare p public.garden_plants; d date; start_d date; end_d date; n integer := 0;
begin
  select * into p from public.garden_plants where id = p_plant;
  if p.id is null then raise exception 'Plant not found' using errcode = 'P0002'; end if;
  start_d := greatest(coalesce(p.sowing_date, current_date), current_date);
  end_d := coalesce(p.expected_harvest_date, start_d + 60);
  d := start_d + 7;
  while d < end_d and n < 10 loop
    insert into public.garden_tasks (garden_id, title, type, due_date, bed_id, plant_id) values (p.garden_id, 'Water ' || p.name, 'water', d, p.bed_id, p.id);
    n := n + 1; d := d + 7;
  end loop;
  insert into public.garden_tasks (garden_id, title, type, due_date, bed_id, plant_id)
  values (p.garden_id, 'Feed ' || p.name, 'fertilize', start_d + greatest(7, (end_d - start_d) / 3), p.bed_id, p.id),
         (p.garden_id, 'Harvest ' || p.name, 'harvest', end_d, p.bed_id, p.id);
  return n + 2;
end $$;

-- Record a harvest and (optionally) mark the plant harvested, atomically.
create or replace function public.garden_record_harvest(p_plant uuid, p_quantity numeric, p_unit text, p_harvested_on date,
  p_notes text default null, p_mark_harvested boolean default false) returns uuid
language plpgsql security invoker set search_path = public as $$
declare p public.garden_plants; h uuid;
begin
  select * into p from public.garden_plants where id = p_plant;
  if p.id is null then raise exception 'Plant not found' using errcode = 'P0002'; end if;
  if p_harvested_on > current_date then raise exception 'Harvest date can''t be in the future' using errcode = '22023'; end if;
  if p.sowing_date is not null and p_harvested_on < p.sowing_date then raise exception 'This plant was sown after that date' using errcode = '22023'; end if;
  insert into public.garden_harvests (garden_id, plant_id, plant_name, bed_id, harvested_on, quantity, unit, notes)
  values (p.garden_id, p.id, p.name, p.bed_id, p_harvested_on, p_quantity, p_unit, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into h;
  if p_mark_harvested then update public.garden_plants set status = 'harvested' where id = p.id; end if;
  return h;
end $$;

grant execute on function public.garden_join(text), public.garden_invite_code(uuid, boolean), public.garden_set_member_role(uuid, uuid, text),
  public.garden_remove_member(uuid, uuid) to authenticated;
grant execute on function public.garden_assign_plants(uuid, uuid[]), public.garden_create_care_schedule(uuid),
  public.garden_record_harvest(uuid, numeric, text, date, text, boolean) to anon, authenticated;
revoke execute on function public.garden_join(text), public.garden_invite_code(uuid, boolean), public.garden_set_member_role(uuid, uuid, text),
  public.garden_remove_member(uuid, uuid) from anon, public;

-- ---------- search scoped to one garden ------------------------------------
drop function if exists public.garden_search(text, int);
create or replace function public.garden_search(q text, max_results int default 20, p_garden uuid default null)
returns table (kind text, id uuid, title text, detail text, rank real)
language sql stable security invoker set search_path = public, pg_catalog as $$
  with query as (select public.garden_tsquery(q) as tsq)
  select r.kind, r.id, r.title, r.detail, r.rank from (
    select 'plant'::text as kind, p.id, p.name as title, p.category || ' · ' || p.status as detail, ts_rank(p.search, query.tsq) as rank
      from public.garden_plants p, query where query.tsq is not null and p.search @@ query.tsq and (p_garden is null or p.garden_id = p_garden)
    union all
    select 'bed', b.id, b.code || ' · ' || b.name, b.soil_type || coalesce(' · ' || b.zone, ''), ts_rank(b.search, query.tsq)
      from public.garden_beds b, query where query.tsq is not null and b.search @@ query.tsq and (p_garden is null or b.garden_id = p_garden)
    union all
    select 'harvest', h.id, h.plant_name, h.quantity::text || ' ' || h.unit || ' · ' || to_char(h.harvested_on, 'DD Mon YYYY'), ts_rank(h.search, query.tsq)
      from public.garden_harvests h, query where query.tsq is not null and h.search @@ query.tsq and (p_garden is null or h.garden_id = p_garden)
    union all
    select 'task', t.id, t.title, t.type || ' · due ' || to_char(t.due_date, 'DD Mon YYYY'), ts_rank(t.search, query.tsq)
      from public.garden_tasks t, query where query.tsq is not null and t.search @@ query.tsq and (p_garden is null or t.garden_id = p_garden)
  ) r
  order by r.rank desc, r.title
  limit greatest(1, least(coalesce(max_results, 20), 50))
$$;
grant execute on function public.garden_search(text, int, uuid) to anon, authenticated;

-- ---------- integrity: links must stay inside one garden --------------------
create or replace function public.garden_same_garden() returns trigger
language plpgsql security definer set search_path = '' as $$
-- to_jsonb(new) lets one function serve tables that do / don't have plant_id
declare v jsonb := to_jsonb(new); b uuid := (v->>'bed_id')::uuid; p uuid := (v->>'plant_id')::uuid; g uuid := (v->>'garden_id')::uuid;
begin
  if b is not null and not exists (select 1 from public.garden_beds x where x.id = b and x.garden_id = g) then
    raise exception 'That bed belongs to a different garden' using errcode = '23514';
  end if;
  if p is not null and tg_table_name <> 'garden_plants' and not exists (select 1 from public.garden_plants x where x.id = p and x.garden_id = g) then
    raise exception 'That plant belongs to a different garden' using errcode = '23514';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['garden_plants','garden_tasks','garden_harvests','garden_sowing_records'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_same_garden', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.garden_same_garden()', t || '_same_garden', t);
  end loop;
end $$;
revoke execute on function public.garden_same_garden(), public.garden_add_owner() from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- OPTIONAL (only if your Supabase project is SHARED with another app). Uncomment to run.
-- ------------------------------------------------------------------------------
-- -- This Supabase project is shared with another app whose sign-up trigger
-- -- creates a row in public.profiles for every new auth user. Garden sign-ups
-- -- pass user metadata { app: 'garden' } and are skipped by that trigger.
-- -- Only needed on the shared project; a dedicated project does not have it.
-- create or replace function public.handle_new_user() returns trigger
-- language plpgsql security definer set search_path to '' as $$
-- begin
--   if coalesce(new.raw_user_meta_data->>'app', '') = 'garden' then return new; end if;
--   insert into public.profiles (id) values (new.id);
--   return new;
-- end; $$;

-- ------------------------------------------------------------------------------
-- OPTIONAL row-level-security self-test. Uncomment to run it.
-- ------------------------------------------------------------------------------
-- -- Row-level security test for migration 004. Run in the SQL editor:
-- -- everything happens inside one transaction and is rolled back.
-- -- Every row of the final result should match its "(want …)" label.
-- begin;
-- create temp table r(n serial, step text, result text) on commit drop;
-- grant all on r to anon, authenticated; grant usage on sequence r_n_seq to anon, authenticated;
-- insert into auth.users (id, email, raw_user_meta_data, aud, role) values
--  ('11111111-1111-4111-8111-111111111111','a@test.dev','{"app":"garden"}','authenticated','authenticated'),
--  ('22222222-2222-4222-8222-222222222222','b@test.dev','{"app":"garden"}','authenticated','authenticated');
-- 
-- -- signed-out visitor can still use the open demo garden
-- set local role anon;
-- select set_config('request.jwt.claims','{"role":"anon"}',true);
-- insert into public.garden_plants (name, category) values ('anon demo plant','Herb');
-- insert into r(step,result) select 'anon demo insert (want 1)', count(*)::text from public.garden_plants where name='anon demo plant';
-- reset role;
-- 
-- -- user A: private garden, bed, plant, transactional care schedule
-- set local role authenticated;
-- select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
-- insert into public.garden_gardens (id, name, created_by) values ('33333333-3333-4333-8333-333333333333','A private','11111111-1111-4111-8111-111111111111');
-- insert into r(step,result) select 'A role (want owner)', public.garden_role('33333333-3333-4333-8333-333333333333');
-- insert into public.garden_beds (id, garden_id, name, length_m, width_m, soil_type) values ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','A bed',2,1,'Loamy');
-- insert into public.garden_plants (id, garden_id, name, category, sowing_date, expected_harvest_date) values ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','A tomato','Vegetable', current_date, current_date+70);
-- insert into r(step,result) select 'sowing auto-logged in A garden (want 1)', count(*)::text from public.garden_sowing_records where garden_id='33333333-3333-4333-8333-333333333333';
-- insert into r(step,result) select 'care schedule tasks (want 11)', public.garden_create_care_schedule('55555555-5555-4555-8555-555555555555')::text;
-- create temp table code on commit drop as select public.garden_invite_code('33333333-3333-4333-8333-333333333333') c;
-- grant select on code to authenticated;
-- do $$ begin
--   insert into public.garden_plants (name, category, bed_id) values ('x','Herb','44444444-4444-4444-8444-444444444444');
--   insert into r(step,result) values ('cross-garden bed link (want blocked)','ALLOWED');
-- exception when others then insert into r(step,result) values ('cross-garden bed link (want blocked)','blocked'); end $$;
-- do $$ declare demo uuid; begin
--   select id into demo from public.garden_plants where garden_id='0a4de000-0000-4000-8000-000000000001' limit 1;
--   perform public.garden_assign_plants('44444444-4444-4444-8444-444444444444', array['55555555-5555-4555-8555-555555555555'::uuid, demo]);
--   insert into r(step,result) values ('mixed assign (want rolled back)','ALLOWED');
-- exception when others then insert into r(step,result) values ('mixed assign (want rolled back)','rolled back'); end $$;
-- insert into r(step,result) select 'bed after failed assign (want null)', coalesce(bed_id::text,'null') from public.garden_plants where id='55555555-5555-4555-8555-555555555555';
-- reset role;
-- 
-- -- user B: outsider
-- set local role authenticated;
-- select set_config('request.jwt.claims','{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',true);
-- insert into r(step,result) select 'B sees A plants (want 0)', count(*)::text from public.garden_plants where garden_id='33333333-3333-4333-8333-333333333333';
-- insert into r(step,result) select 'B sees A garden (want 0)', count(*)::text from public.garden_gardens where id='33333333-3333-4333-8333-333333333333';
-- with u as (update public.garden_plants set name='hacked' where id='55555555-5555-4555-8555-555555555555' returning 1) insert into r(step,result) select 'B updates A plant (want 0)', count(*)::text from u;
-- do $$ begin
--   insert into public.garden_beds (garden_id, name, length_m, width_m, soil_type) values ('33333333-3333-4333-8333-333333333333','B sneaks',1,1,'Loamy');
--   insert into r(step,result) values ('B inserts into A (want denied)','ALLOWED');
-- exception when others then insert into r(step,result) values ('B inserts into A (want denied)','denied'); end $$;
-- do $$ begin perform public.garden_invite_code('33333333-3333-4333-8333-333333333333'); insert into r(step,result) values ('B reads invite (want denied)','ALLOWED');
-- exception when others then insert into r(step,result) values ('B reads invite (want denied)','denied'); end $$;
-- insert into r(step,result) select 'B joins with code (want true)', (public.garden_join((select c from code)) = '33333333-3333-4333-8333-333333333333')::text;
-- insert into r(step,result) select 'B role after join (want editor)', public.garden_role('33333333-3333-4333-8333-333333333333');
-- reset role;
-- 
-- -- A demotes B to viewer; A cannot leave as last owner
-- set local role authenticated;
-- select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
-- select public.garden_set_member_role('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','viewer');
-- do $$ begin perform public.garden_remove_member('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'); insert into r(step,result) values ('last owner leaves (want blocked)','ALLOWED');
-- exception when others then insert into r(step,result) values ('last owner leaves (want blocked)','blocked'); end $$;
-- reset role;
-- 
-- set local role authenticated;
-- select set_config('request.jwt.claims','{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',true);
-- with u as (update public.garden_plants set name='viewer edit' where id='55555555-5555-4555-8555-555555555555' returning 1) insert into r(step,result) select 'viewer edits (want 0)', count(*)::text from u;
-- insert into r(step,result) select 'viewer reads (want 1)', count(*)::text from public.garden_plants where garden_id='33333333-3333-4333-8333-333333333333';
-- reset role;
-- 
-- set local role anon;
-- select set_config('request.jwt.claims','{"role":"anon"}',true);
-- do $$ begin perform public.garden_join('abc'); insert into r(step,result) values ('anon join (want denied)','ALLOWED');
-- exception when others then insert into r(step,result) values ('anon join (want denied)','denied'); end $$;
-- insert into r(step,result) select 'anon sees private gardens (want 0)', count(*)::text from public.garden_gardens where visibility='private';
-- reset role;
-- select step, result from r order by n;
-- rollback;
