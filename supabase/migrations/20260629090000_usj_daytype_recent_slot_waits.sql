-- Day-type aware USJ wait slot aggregation.
-- Weekday plans use recent weekday rows; holiday plans use weekend and Japanese public holiday rows.

drop function if exists public.get_usj_recent_slot_waits(text[], integer, text, numeric);
drop function if exists public.is_japan_public_holiday(date);
drop function if exists public.japan_public_holidays(integer);

create or replace function public.japan_public_holidays(p_year integer)
returns table (holiday_date date)
language sql
stable
as $$
  with fixed_holidays(month_num, day_num) as (
    values
      (1, 1),
      (2, 11),
      (2, 23),
      (4, 29),
      (5, 3),
      (5, 4),
      (5, 5),
      (8, 11),
      (11, 3),
      (11, 23)
  ),
  monday_holidays(month_num, nth_week) as (
    values
      (1, 2),
      (7, 3),
      (9, 3),
      (10, 2)
  ),
  base_holidays as (
    select make_date(p_year, month_num, day_num) as holiday_date
    from fixed_holidays
    union all
    select
      (
        make_date(p_year, month_num, 1)
        + (
          ((8 - extract(dow from make_date(p_year, month_num, 1))::int) % 7)
          + ((nth_week - 1) * 7)
        )::int
      )::date as holiday_date
    from monday_holidays
    union all
    select make_date(
      p_year,
      3,
      floor(20.8431 + 0.242194 * (p_year - 1980) - floor((p_year - 1980) / 4.0))::int
    ) as holiday_date
    union all
    select make_date(
      p_year,
      9,
      floor(23.2488 + 0.242194 * (p_year - 1980) - floor((p_year - 1980) / 4.0))::int
    ) as holiday_date
  ),
  substitutes as (
    select min(candidate)::date as holiday_date
    from base_holidays b
    cross join lateral generate_series(
      b.holiday_date + interval '1 day',
      b.holiday_date + interval '7 days',
      interval '1 day'
    ) as candidate
    where extract(dow from b.holiday_date)::int = 0
      and not exists (
        select 1
        from base_holidays other
        where other.holiday_date = candidate::date
      )
    group by b.holiday_date
  ),
  with_substitutes as (
    select holiday_date from base_holidays
    union
    select holiday_date from substitutes
  ),
  calendar_days as (
    select generate_series(make_date(p_year, 1, 1), make_date(p_year, 12, 31), interval '1 day')::date as day_date
  ),
  citizens as (
    select day_date as holiday_date
    from calendar_days d
    where extract(dow from d.day_date)::int not in (0, 6)
      and not exists (
        select 1
        from with_substitutes h
        where h.holiday_date = d.day_date
      )
      and exists (
        select 1
        from with_substitutes h
        where h.holiday_date = d.day_date - 1
      )
      and exists (
        select 1
        from with_substitutes h
        where h.holiday_date = d.day_date + 1
      )
  )
  select distinct holiday_date
  from (
    select holiday_date from with_substitutes
    union
    select holiday_date from citizens
  ) holidays;
$$;

create or replace function public.is_japan_public_holiday(p_date date)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.japan_public_holidays(extract(year from p_date)::int) h
    where h.holiday_date = p_date
  );
$$;

grant execute on function public.japan_public_holidays(integer) to anon, authenticated;
grant execute on function public.is_japan_public_holiday(date) to anon, authenticated;

create or replace function public.get_usj_recent_slot_waits(
  p_attraction_ids text[],
  p_days integer default 7,
  p_day_type text default 'weekday',
  p_shrink_k numeric default 8
)
returns table (
  attraction_id text,
  slot_minute integer,
  avg_wait numeric,
  median_wait numeric,
  sample_count integer,
  daytype_sample_count integer,
  all_sample_count integer,
  blended_wait numeric,
  observed_count integer,
  daytype_observed_count integer
)
language sql
stable
as $$
  with normalized as (
    select
      ws.attraction_id,
      ws.sampled_at,
      (ws.sampled_at at time zone 'Asia/Tokyo')::date as sample_date,
      (
        extract(hour from ws.sampled_at at time zone 'Asia/Tokyo')::int * 60
        + (extract(minute from ws.sampled_at at time zone 'Asia/Tokyo')::int / 15) * 15
      ) as slot_minute,
      ws.wait_minutes,
      lower(coalesce(ws.status, 'unknown')) as normalized_status,
      case
        when extract(dow from ws.sampled_at at time zone 'Asia/Tokyo')::int in (0, 6)
          or public.is_japan_public_holiday((ws.sampled_at at time zone 'Asia/Tokyo')::date) then 'holiday'
        else 'weekday'
      end as day_type
    from public.usj_wait_samples ws
    where ws.attraction_id = any(p_attraction_ids)
      and ws.sampled_at >= now() - make_interval(days => greatest(1, p_days))
      and ws.source = 'queue-times'
  ),
  slot_daily as (
    select
      n.attraction_id,
      n.sample_date,
      n.slot_minute,
      n.day_type,
      (
        array_agg(n.wait_minutes order by n.sampled_at desc)
        filter (
          where n.normalized_status = 'operating'
            and n.wait_minutes is not null
        )
      )[1]::numeric as slot_wait,
      bool_or(n.normalized_status <> 'unknown') as has_observation
    from normalized n
    group by n.attraction_id, n.sample_date, n.slot_minute, n.day_type
  ),
  observed_stats as (
    select attraction_id, slot_minute, count(*)::int as observed_count
    from slot_daily
    where has_observation
    group by attraction_id, slot_minute
  ),
  all_stats as (
    select
      attraction_id,
      slot_minute,
      avg(slot_wait)::numeric(10, 2) as avg_wait,
      percentile_cont(0.5) within group (order by slot_wait)::numeric(10, 2) as median_wait,
      count(*)::int as sample_count
    from slot_daily
    where slot_wait is not null
    group by attraction_id, slot_minute
  ),
  daytype_stats as (
    select
      attraction_id,
      slot_minute,
      percentile_cont(0.5) within group (order by slot_wait)::numeric(10, 2) as median_wait,
      count(*)::int as sample_count
    from slot_daily
    where case
      when p_day_type = 'holiday' then day_type = 'holiday'
      when p_day_type = 'weekday' then day_type = 'weekday'
      else true
    end
      and slot_wait is not null
    group by attraction_id, slot_minute
  ),
  daytype_observed_stats as (
    select attraction_id, slot_minute, count(*)::int as observed_count
    from slot_daily
    where case
      when p_day_type = 'holiday' then day_type = 'holiday'
      when p_day_type = 'weekday' then day_type = 'weekday'
      else true
    end
      and has_observation
    group by attraction_id, slot_minute
  )
  select
    o.attraction_id,
    o.slot_minute,
    a.avg_wait,
    a.median_wait,
    coalesce(a.sample_count, 0)::int as sample_count,
    coalesce(d.sample_count, 0)::int as daytype_sample_count,
    coalesce(a.sample_count, 0)::int as all_sample_count,
    (
      case
        when a.median_wait is null then null
        when p_day_type not in ('weekday', 'holiday') then a.median_wait
        when coalesce(d.sample_count, 0) <= 0 then a.median_wait
        else (
          (d.sample_count::numeric / (d.sample_count::numeric + greatest(0, p_shrink_k))) * d.median_wait
          + (greatest(0, p_shrink_k) / (d.sample_count::numeric + greatest(0, p_shrink_k))) * a.median_wait
        )
      end
    )::numeric(10, 2) as blended_wait,
    o.observed_count,
    coalesce(dobs.observed_count, 0)::int as daytype_observed_count
  from observed_stats o
  left join all_stats a
    on a.attraction_id = o.attraction_id
   and a.slot_minute = o.slot_minute
  left join daytype_stats d
    on d.attraction_id = o.attraction_id
   and d.slot_minute = o.slot_minute
  left join daytype_observed_stats dobs
    on dobs.attraction_id = o.attraction_id
   and dobs.slot_minute = o.slot_minute;
$$;

grant execute on function public.get_usj_recent_slot_waits(text[], integer, text, numeric)
  to anon, authenticated;

