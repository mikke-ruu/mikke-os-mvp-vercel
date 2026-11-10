-- Add Academy to display preferences only; no ownership or data changes.
set local lock_timeout = '5s';
alter table public.mikke_app_menu_preferences drop constraint mikke_app_menu_preferences_app_key_check;
alter table public.mikke_app_menu_preferences add constraint mikke_app_menu_preferences_app_key_check
  check (app_key in ('marketnote', 'story', 'community', 'ninteikoza', 'academy'));

create or replace function public.mikke_app_menu_preferences_replace_mine(p_items jsonb)
returns table (
  app_key text,
  sort_order integer,
  is_hidden boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item jsonb;
  v_item_count integer;
  v_app_key text;
  v_sort_order integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count > 32 then
    raise exception 'p_items cannot contain more than 32 entries' using errcode = '22023';
  end if;

  -- An empty replacement removes all overrides. The client then uses the
  -- registry default order with every otherwise-authorized app visible.
  if v_item_count = 0 then
    delete from public.mikke_app_menu_preferences
    where user_id = v_user_id;
    return;
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each preference must be a JSON object' using errcode = '22023';
    end if;

    if not (v_item ?& array['app_key', 'sort_order', 'is_hidden'])
      or exists (
        select 1
        from jsonb_object_keys(v_item) as item_key
        where item_key not in ('app_key', 'sort_order', 'is_hidden')
      )
    then
      raise exception 'Each preference must contain only app_key, sort_order, and is_hidden' using errcode = '22023';
    end if;

    if jsonb_typeof(v_item -> 'app_key') <> 'string'
      or jsonb_typeof(v_item -> 'sort_order') <> 'number'
      or jsonb_typeof(v_item -> 'is_hidden') <> 'boolean'
    then
      raise exception 'Preference fields have invalid JSON types' using errcode = '22023';
    end if;

    v_app_key := v_item ->> 'app_key';
    if v_app_key not in ('marketnote', 'story', 'community', 'ninteikoza', 'academy') then
      raise exception 'Unknown app_key: %', v_app_key using errcode = '22023';
    end if;

    if (v_item ->> 'sort_order') !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'sort_order must be a non-negative integer' using errcode = '22023';
    end if;

    v_sort_order := (v_item ->> 'sort_order')::integer;
    if v_sort_order > 31 then
      raise exception 'sort_order must be between 0 and 31' using errcode = '22023';
    end if;
  end loop;

  if (
    select count(*) <> count(distinct item ->> 'app_key')
    from jsonb_array_elements(p_items) as item
  ) then
    raise exception 'Duplicate app_key values are not allowed' using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct (item ->> 'sort_order')::integer)
    from jsonb_array_elements(p_items) as item
  ) then
    raise exception 'Duplicate sort_order values are not allowed' using errcode = '22023';
  end if;

  delete from public.mikke_app_menu_preferences
  where user_id = v_user_id;

  insert into public.mikke_app_menu_preferences (
    user_id,
    app_key,
    sort_order,
    is_hidden,
    updated_at
  )
  select
    v_user_id,
    item ->> 'app_key',
    (item ->> 'sort_order')::integer,
    (item ->> 'is_hidden')::boolean,
    statement_timestamp()
  from jsonb_array_elements(p_items) as item;

  return query
  select
    preference.app_key,
    preference.sort_order,
    preference.is_hidden,
    preference.updated_at
  from public.mikke_app_menu_preferences as preference
  where preference.user_id = v_user_id
  order by preference.sort_order, preference.app_key;
end;
$$;


-- CREATE OR REPLACE preserves existing function ownership and ACL.
notify pgrst, 'reload schema';
