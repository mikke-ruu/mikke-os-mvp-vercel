-- Save selected Google Calendar ICS occurrences as private MarketNote schedule
-- projections. The raw ICS file never reaches this RPC. Only the narrow fields
-- explicitly validated below are accepted.

create function public.marketnote_import_google_calendar_manual(
  p_source_calendar_key text,
  p_source_label text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_total integer := 0;
  v_time_zone text;
  v_allowed_keys constant text[] := array[
    'source_record_id', 'occurrence_key', 'title', 'all_day', 'time_zone',
    'starts_at', 'ends_at', 'starts_on', 'ends_on_exclusive', 'status'
  ];
begin
  if v_user_id is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Authenticated non-anonymous user required' using errcode = '42501';
  end if;

  if p_source_calendar_key is distinct from 'ics_manual' then
    raise exception 'Invalid source calendar key' using errcode = '22023';
  end if;
  if p_source_label is distinct from 'Googleカレンダー（手動取り込み）'
     or p_source_label ~ '[@[:cntrl:]]' then
    raise exception 'Invalid source label' using errcode = '22023';
  end if;
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 2000 then
    raise exception 'Import items must contain between 1 and 2000 entries' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct jsonb_build_array(
      btrim(item->>'source_record_id'), btrim(item->>'occurrence_key')
    ))
    from jsonb_array_elements(p_items) as input(item)
  ) then
    raise exception 'Duplicate occurrence in import request' using errcode = '22023';
  end if;

  insert into public.market_schedule_source_preferences (
    user_id, source_service, source_calendar_key, source_label
  ) values (
    v_user_id, 'google_manual', btrim(p_source_calendar_key), btrim(p_source_label)
  )
  on conflict (user_id, source_service, source_calendar_key)
  do update set source_label = excluded.source_label;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or exists (
         select 1 from jsonb_object_keys(v_item) as supplied(key)
         where not (supplied.key = any(v_allowed_keys))
       ) then
      raise exception 'Import item contains unsupported fields' using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_item->>'source_record_id', ''))) not between 1 and 500
       or length(btrim(coalesce(v_item->>'occurrence_key', ''))) not between 1 and 200
       or length(btrim(coalesce(v_item->>'title', ''))) not between 1 and 200
       or btrim(coalesce(v_item->>'source_record_id', '')) !~ '^uid_[0-9a-f]{64}$'
       or length(btrim(coalesce(v_item->>'time_zone', ''))) not between 1 and 100
       or jsonb_typeof(v_item->'all_day') is distinct from 'boolean'
       or coalesce(v_item->>'status', '') not in ('active', 'cancelled') then
      raise exception 'Import item is invalid' using errcode = '22023';
    end if;
    v_time_zone := btrim(v_item->>'time_zone');
    if not (
      v_time_zone = 'UTC'
      or v_time_zone ~ '^UTC[+-](0[0-9]|1[0-3]):[0-5][0-9]$'
      or v_time_zone ~ '^UTC[+-]14:00$'
      or exists (
        select 1 from pg_catalog.pg_timezone_names
        where name = v_time_zone
      )
      or (coalesce((v_item->>'all_day')::boolean, false) and v_time_zone = 'floating')
    ) then
      raise exception 'Import item has invalid time zone' using errcode = '22023';
    end if;
    if coalesce((v_item->>'all_day')::boolean, false) then
      if coalesce(v_item->>'starts_on', '') !~ '^\d{4}-\d{2}-\d{2}$'
         or coalesce(v_item->>'ends_on_exclusive', '') !~ '^\d{4}-\d{2}-\d{2}$'
         or (v_item->>'starts_on')::date is null
         or (v_item->>'ends_on_exclusive')::date <= (v_item->>'starts_on')::date
         or v_item ? 'starts_at' or v_item ? 'ends_at' then
        raise exception 'All-day import item has invalid dates' using errcode = '22023';
      end if;
    else
      if coalesce(v_item->>'starts_at', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
         or (
           (v_item->>'ends_at') is not null
           and (v_item->>'ends_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
         )
         or (v_item->>'starts_at')::timestamptz is null
         or ((v_item->>'ends_at') is not null and (v_item->>'ends_at')::timestamptz < (v_item->>'starts_at')::timestamptz)
         or v_item ? 'starts_on' or v_item ? 'ends_on_exclusive' then
        raise exception 'Timed import item has invalid timestamps' using errcode = '22023';
      end if;
    end if;

    insert into public.market_schedule_projections (
      user_id, source_service, source_calendar_key, source_record_id,
      occurrence_key, title, starts_at, ends_at, starts_on,
      ends_on_exclusive, all_day, time_zone, status, source_updated_at
    ) values (
      v_user_id, 'google_manual', btrim(p_source_calendar_key), btrim(v_item->>'source_record_id'),
      btrim(v_item->>'occurrence_key'), btrim(v_item->>'title'),
      case when coalesce((v_item->>'all_day')::boolean, false) then null else (v_item->>'starts_at')::timestamptz end,
      case when coalesce((v_item->>'all_day')::boolean, false) or (v_item->>'ends_at') is null then null else (v_item->>'ends_at')::timestamptz end,
      case when coalesce((v_item->>'all_day')::boolean, false) then (v_item->>'starts_on')::date else null end,
      case when coalesce((v_item->>'all_day')::boolean, false) then (v_item->>'ends_on_exclusive')::date else null end,
      coalesce((v_item->>'all_day')::boolean, false), btrim(v_item->>'time_zone'),
      v_item->>'status', now()
    )
    on conflict (user_id, source_service, source_record_id, occurrence_key)
      where source_service = 'google_manual'
    do update set
      source_calendar_key = excluded.source_calendar_key,
      title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      starts_on = excluded.starts_on,
      ends_on_exclusive = excluded.ends_on_exclusive,
      all_day = excluded.all_day,
      time_zone = excluded.time_zone,
      status = excluded.status,
      source_updated_at = excluded.source_updated_at;

    v_total := v_total + 1;
  end loop;

  return jsonb_build_object(
    'total', v_total
  );
end;
$$;

comment on function public.marketnote_import_google_calendar_manual(text, text, jsonb) is
  'Imports a narrow, private Google ICS occurrence projection for the signed-in owner. Raw ICS and sensitive calendar fields are never accepted.';

revoke all on function public.marketnote_import_google_calendar_manual(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.marketnote_import_google_calendar_manual(text, text, jsonb)
  to authenticated;
