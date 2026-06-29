create extension if not exists pgcrypto;

create table if not exists public.usj_attractions (
  id text primary key,
  name text not null,
  area text not null default 'USJ',
  external_source text not null default 'queue-times',
  external_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usj_wait_samples (
  id bigserial primary key,
  attraction_id text not null references public.usj_attractions(id) on delete cascade,
  sampled_at timestamptz not null,
  wait_minutes integer check (wait_minutes is null or (wait_minutes >= 0 and wait_minutes <= 600)),
  status text not null default 'unknown',
  source text not null default 'queue-times',
  inserted_at timestamptz not null default now()
);

create unique index if not exists usj_wait_samples_unique_idx
  on public.usj_wait_samples (attraction_id, sampled_at, source);

create index if not exists usj_wait_samples_lookup_idx
  on public.usj_wait_samples (attraction_id, sampled_at desc);

create or replace function public.usj_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists usj_attractions_set_updated_at on public.usj_attractions;
create trigger usj_attractions_set_updated_at
before update on public.usj_attractions
for each row
execute function public.usj_set_updated_at();

alter table public.usj_attractions enable row level security;
alter table public.usj_wait_samples enable row level security;

drop policy if exists usj_attractions_read_all on public.usj_attractions;
create policy usj_attractions_read_all
  on public.usj_attractions
  for select
  using (true);

drop policy if exists usj_wait_samples_read_all on public.usj_wait_samples;
create policy usj_wait_samples_read_all
  on public.usj_wait_samples
  for select
  using (true);

create or replace function public.usj_recent_slot_waits(
  p_attraction_ids text[],
  p_days integer default 14
)
returns table (
  attraction_id text,
  slot_minute integer,
  avg_wait numeric,
  median_wait numeric,
  sample_count integer
)
language sql
stable
as $$
  select
    attraction_id,
    (
      extract(hour from sampled_at at time zone 'Asia/Tokyo')::int * 60
      + (extract(minute from sampled_at at time zone 'Asia/Tokyo')::int / 15) * 15
    ) as slot_minute,
    avg(wait_minutes)::numeric as avg_wait,
    percentile_cont(0.5) within group (order by wait_minutes)::numeric as median_wait,
    count(*)::int as sample_count
  from public.usj_wait_samples
  where attraction_id = any(p_attraction_ids)
    and wait_minutes is not null
    and sampled_at >= now() - make_interval(days => greatest(p_days, 1))
  group by attraction_id, slot_minute
  order by attraction_id, slot_minute;
$$;

grant execute on function public.usj_recent_slot_waits(text[], integer) to anon, authenticated;

-- See migrations/20260629090000_usj_daytype_recent_slot_waits.sql for day-type aware USJ wait slot RPC.
