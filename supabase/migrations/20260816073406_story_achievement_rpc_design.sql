-- STORY Phase 3: owner-approved MarketNote achievement snapshots.
-- DESIGN ONLY on 2026-08-16. Do not apply before control-room review and negative tests.

create table public.story_achievements (
  id uuid primary key default gen_random_uuid(),
  story_profile_id uuid not null references public.story_profiles(id) on delete cascade,
  source_service text not null default 'marketnote',
  source_record_id text not null,
  metric_key text not null,
  display_mode text not null,
  publication_status text not null default 'draft',
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text,
  public_note text,
  public_photo_storage_path text,
  sort_order integer not null default 0,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_achievements_source_service_check
    check (source_service = 'marketnote'),
  constraint story_achievements_source_record_id_not_blank
    check (length(btrim(source_record_id)) > 0),
  constraint story_achievements_metric_key_not_blank
    check (length(btrim(metric_key)) > 0),
  constraint story_achievements_display_mode_check
    check (display_mode in ('count_only', 'card_only', 'card_and_count')),
  constraint story_achievements_publication_status_check
    check (publication_status in ('draft', 'published', 'withdrawn')),
  constraint story_achievements_sort_order_check
    check (sort_order >= 0),
  constraint story_achievements_public_title_length
    check (public_title is null or length(btrim(public_title)) between 1 and 120),
  constraint story_achievements_public_type_label_length
    check (public_type_label is null or length(btrim(public_type_label)) between 1 and 60),
  constraint story_achievements_public_location_length
    check (public_location is null or length(btrim(public_location)) between 1 and 120),
  constraint story_achievements_public_note_length
    check (public_note is null or char_length(public_note) <= 500),
  constraint story_achievements_public_photo_path_length
    check (public_photo_storage_path is null or char_length(public_photo_storage_path) <= 500),
  constraint story_achievements_display_payload_check
    check (
      (
        display_mode = 'count_only'
        and public_title is null
        and public_type_label is null
        and occurred_on is null
        and public_location is null
        and public_note is null
        and public_photo_storage_path is null
      )
      or (
        display_mode in ('card_only', 'card_and_count')
        and public_title is not null
        and public_type_label is not null
        and occurred_on is not null
      )
    ),
  constraint story_achievements_owner_source_unique
    unique (story_profile_id, source_service, source_record_id)
);

comment on table public.story_achievements is
  'STORY-owned snapshots explicitly staged from MarketNote and published by the owner. Never stores MarketNote memo, photo, finance, or payment data.';
comment on column public.story_achievements.metric_key is
  'Non-public aggregate key derived by database validation from market_events.event_type_id; never trusted from client input.';
comment on column public.story_achievements.display_mode is
  'count_only: aggregate only and no card payload; card_only: public card and explicit no-count override; card_and_count: one aggregate count plus public card.';
comment on column public.story_achievements.publication_status is
  'draft: private staged snapshot; published: eligible for configured public output; withdrawn: retained for dedupe/republication but not public.';

create index story_achievements_owner_status_idx
  on public.story_achievements (story_profile_id, publication_status, updated_at desc);

create index story_achievements_public_cards_idx
  on public.story_achievements (story_profile_id, sort_order, occurred_on desc)
  where publication_status = 'published'
    and display_mode in ('card_only', 'card_and_count');

create table public.story_achievement_metric_settings (
  story_profile_id uuid not null references public.story_profiles(id) on delete cascade,
  source_service text not null default 'marketnote',
  metric_key text not null,
  public_label text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (story_profile_id, source_service, metric_key),
  constraint story_achievement_metric_settings_source_check
    check (source_service = 'marketnote'),
  constraint story_achievement_metric_settings_key_not_blank
    check (length(btrim(metric_key)) > 0),
  constraint story_achievement_metric_settings_label_length
    check (length(btrim(public_label)) between 1 and 40),
  constraint story_achievement_metric_settings_order_check
    check (sort_order between 0 and 2),
  constraint story_achievement_metric_settings_order_unique
    unique (story_profile_id, sort_order)
);

comment on table public.story_achievement_metric_settings is
  'At most three owner-selected public STORY metrics. Rows are replaced only through an authenticated owner RPC.';

create function public.set_story_achievement_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_story_achievement_updated_at() from public, anon, authenticated;

create trigger set_story_achievements_updated_at
before update on public.story_achievements
for each row execute function public.set_story_achievement_updated_at();

create trigger set_story_achievement_metric_settings_updated_at
before update on public.story_achievement_metric_settings
for each row execute function public.set_story_achievement_updated_at();

alter table public.story_achievements enable row level security;
alter table public.story_achievement_metric_settings enable row level security;

revoke all on table public.story_achievements from public, anon, authenticated;
revoke all on table public.story_achievement_metric_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.story_achievements to service_role;
grant select, insert, update, delete on table public.story_achievement_metric_settings to service_role;

create policy story_achievements_select_owner
on public.story_achievements
for select
to authenticated
using (
  exists (
    select 1
    from public.story_profiles sp
    where sp.id = story_achievements.story_profile_id
      and sp.owner_user_id = (select auth.uid())
  )
);

create policy story_achievement_metric_settings_select_owner
on public.story_achievement_metric_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.story_profiles sp
    where sp.id = story_achievement_metric_settings.story_profile_id
      and sp.owner_user_id = (select auth.uid())
  )
);

create function public.story_achievement_stage_from_marketnote(
  p_source_record_id uuid,
  p_display_mode text,
  p_public_title text default null,
  p_public_type_label text default null,
  p_occurred_on date default null,
  p_public_location text default null
)
returns table (
  achievement_id uuid,
  source_record_id text,
  display_mode text,
  publication_status text,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_story_profile_id uuid;
  v_owner_profile_id uuid;
  v_event_ended_at date;
  v_event_type_id uuid;
  v_event_title text;
  v_event_type_name text;
  v_today_jst date := (now() at time zone 'Asia/Tokyo')::date;
  v_achievement_id uuid;
  v_title text;
  v_type_label text;
  v_occurred_on date;
  v_location text;
begin
  if v_caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_source_record_id is null then
    raise exception 'MarketNote source record is required.' using errcode = '22023';
  end if;
  if p_display_mode not in ('count_only', 'card_only', 'card_and_count') then
    raise exception 'Invalid STORY display mode.' using errcode = '22023';
  end if;

  select sp.id, sp.owner_profile_id
  into v_story_profile_id, v_owner_profile_id
  from public.story_profiles sp
  where sp.owner_user_id = v_caller_user_id
  limit 1;

  if v_story_profile_id is null then
    raise exception 'STORY profile is required before adding an achievement.' using errcode = 'P0002';
  end if;

  select al.ended_at, met.id
  into v_event_ended_at, v_event_type_id
  from public.market_events me
  join public.market_event_types met
    on met.id = me.event_type_id
   and met.profile_id = me.profile_id
   and met.user_id = me.user_id
  join public.activity_logs al
    on al.profile_id = me.profile_id
   and al.source_service = 'marketnote'
   and al.source_record_id = me.id::text
   and al.status = 'confirmed'
   and al.ended_at < v_today_jst
  where me.id = p_source_record_id
    and me.user_id = v_caller_user_id
    and me.profile_id = v_owner_profile_id;

  if v_event_ended_at is null then
    raise exception 'Eligible MarketNote achievement source was not found.' using errcode = 'P0002';
  end if;

  if p_display_mode = 'count_only' then
    v_title := null;
    v_type_label := null;
    v_occurred_on := null;
    v_location := null;
  else
    select me.title, met.name
    into v_event_title, v_event_type_name
    from public.market_events me
    join public.market_event_types met
      on met.id = me.event_type_id
     and met.profile_id = me.profile_id
     and met.user_id = me.user_id
    where me.id = p_source_record_id
      and me.user_id = v_caller_user_id
      and me.profile_id = v_owner_profile_id;

    v_title := coalesce(nullif(btrim(p_public_title), ''), nullif(btrim(v_event_title), ''));
    v_type_label := coalesce(nullif(btrim(p_public_type_label), ''), nullif(btrim(v_event_type_name), ''));
    v_occurred_on := coalesce(p_occurred_on, v_event_ended_at);
    v_location := nullif(btrim(p_public_location), '');

    if v_title is null or char_length(v_title) > 120 then
      raise exception 'Public achievement title must be 1 to 120 characters.' using errcode = '22023';
    end if;
    if v_type_label is null or char_length(v_type_label) > 60 then
      raise exception 'Public achievement type must be 1 to 60 characters.' using errcode = '22023';
    end if;
    if v_location is not null and char_length(v_location) > 120 then
      raise exception 'Public achievement location must be at most 120 characters.' using errcode = '22023';
    end if;
  end if;

  insert into public.story_achievements as sa (
    story_profile_id,
    source_service,
    source_record_id,
    metric_key,
    display_mode,
    publication_status,
    public_title,
    public_type_label,
    occurred_on,
    public_location,
    public_note,
    public_photo_storage_path,
    withdrawn_at
  ) values (
    v_story_profile_id,
    'marketnote',
    p_source_record_id::text,
    v_event_type_id::text,
    p_display_mode,
    'draft',
    v_title,
    v_type_label,
    v_occurred_on,
    v_location,
    null,
    null,
    null
  )
  on conflict on constraint story_achievements_owner_source_unique
  do update set
    metric_key = excluded.metric_key,
    display_mode = excluded.display_mode,
    publication_status = 'draft',
    public_title = excluded.public_title,
    public_type_label = excluded.public_type_label,
    occurred_on = excluded.occurred_on,
    public_location = excluded.public_location,
    public_note = case when excluded.display_mode = 'count_only' then null else sa.public_note end,
    public_photo_storage_path = case when excluded.display_mode = 'count_only' then null else sa.public_photo_storage_path end,
    withdrawn_at = null
  returning sa.id into v_achievement_id;

  return query
  select sa.id,
         sa.source_record_id,
         sa.display_mode,
         sa.publication_status,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location
  from public.story_achievements sa
  where sa.id = v_achievement_id;
end;
$$;

revoke all on function public.story_achievement_stage_from_marketnote(uuid, text, text, text, date, text) from public, anon, authenticated;
grant execute on function public.story_achievement_stage_from_marketnote(uuid, text, text, text, date, text) to authenticated;

create function public.story_achievement_get_mine_from_marketnote(p_source_record_id uuid)
returns table (
  achievement_id uuid,
  source_record_id text,
  display_mode text,
  publication_status text,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text
)
language sql
stable
security definer
set search_path = ''
as $$
  select sa.id,
         sa.source_record_id,
         sa.display_mode,
         sa.publication_status,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location
  from public.story_achievements sa
  join public.story_profiles sp on sp.id = sa.story_profile_id
  where sp.owner_user_id = (select auth.uid())
    and sa.source_service = 'marketnote'
    and sa.source_record_id = p_source_record_id::text
  limit 1;
$$;

revoke all on function public.story_achievement_get_mine_from_marketnote(uuid) from public, anon, authenticated;
grant execute on function public.story_achievement_get_mine_from_marketnote(uuid) to authenticated;

create function public.story_achievement_list_mine()
returns table (
  achievement_id uuid,
  display_mode text,
  publication_status text,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sa.id,
         sa.display_mode,
         sa.publication_status,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location,
         sa.published_at,
         sa.updated_at
  from public.story_achievements sa
  join public.story_profiles sp on sp.id = sa.story_profile_id
  where sp.owner_user_id = (select auth.uid())
  order by sa.updated_at desc, sa.created_at desc;
$$;

revoke all on function public.story_achievement_list_mine() from public, anon, authenticated;
grant execute on function public.story_achievement_list_mine() to authenticated;

create function public.story_achievement_update_draft_mine(
  p_achievement_id uuid,
  p_display_mode text,
  p_public_title text default null,
  p_public_type_label text default null,
  p_occurred_on date default null,
  p_public_location text default null,
  p_public_note text default null,
  p_public_photo_storage_path text default null,
  p_sort_order integer default 0
)
returns table (
  achievement_id uuid,
  display_mode text,
  publication_status text,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_photo_path text := nullif(btrim(p_public_photo_storage_path), '');
begin
  if v_caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_display_mode not in ('count_only', 'card_only', 'card_and_count') then
    raise exception 'Invalid STORY display mode.' using errcode = '22023';
  end if;
  if p_sort_order < 0 then
    raise exception 'Sort order must be zero or greater.' using errcode = '22023';
  end if;
  if p_display_mode <> 'count_only' then
    if nullif(btrim(p_public_title), '') is null or char_length(btrim(p_public_title)) > 120 then
      raise exception 'Public achievement title must be 1 to 120 characters.' using errcode = '22023';
    end if;
    if nullif(btrim(p_public_type_label), '') is null or char_length(btrim(p_public_type_label)) > 60 then
      raise exception 'Public achievement type must be 1 to 60 characters.' using errcode = '22023';
    end if;
    if p_occurred_on is null then
      raise exception 'Public achievement date is required for a card.' using errcode = '22023';
    end if;
    if nullif(btrim(p_public_location), '') is not null and char_length(btrim(p_public_location)) > 120 then
      raise exception 'Public achievement location must be at most 120 characters.' using errcode = '22023';
    end if;
    if p_public_note is not null and char_length(p_public_note) > 500 then
      raise exception 'Public achievement note must be at most 500 characters.' using errcode = '22023';
    end if;
    if v_photo_path is not null
      and split_part(v_photo_path, '/', 1) <> v_caller_user_id::text then
      raise exception 'Public achievement photo path must belong to the authenticated user.' using errcode = '42501';
    end if;
  end if;

  update public.story_achievements sa
  set display_mode = p_display_mode,
      publication_status = 'draft',
      public_title = case when p_display_mode = 'count_only' then null else nullif(btrim(p_public_title), '') end,
      public_type_label = case when p_display_mode = 'count_only' then null else nullif(btrim(p_public_type_label), '') end,
      occurred_on = case when p_display_mode = 'count_only' then null else p_occurred_on end,
      public_location = case when p_display_mode = 'count_only' then null else nullif(btrim(p_public_location), '') end,
      public_note = case when p_display_mode = 'count_only' then null else nullif(btrim(p_public_note), '') end,
      public_photo_storage_path = case when p_display_mode = 'count_only' then null else v_photo_path end,
      sort_order = p_sort_order,
      withdrawn_at = null
  from public.story_profiles sp
  where sa.id = p_achievement_id
    and sp.id = sa.story_profile_id
    and sp.owner_user_id = v_caller_user_id;

  if not found then
    raise exception 'Owned STORY achievement was not found.' using errcode = 'P0002';
  end if;

  return query
  select sa.id,
         sa.display_mode,
         sa.publication_status,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location,
         sa.published_at,
         sa.updated_at
  from public.story_achievements sa
  where sa.id = p_achievement_id;
end;
$$;

revoke all on function public.story_achievement_update_draft_mine(uuid, text, text, text, date, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.story_achievement_update_draft_mine(uuid, text, text, text, date, text, text, text, integer) to authenticated;

create function public.story_achievement_publish_mine(p_achievement_id uuid)
returns table (
  achievement_id uuid,
  display_mode text,
  publication_status text,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_user_id uuid := (select auth.uid());
begin
  if v_caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.story_achievements sa
  set publication_status = 'published',
      published_at = coalesce(sa.published_at, now()),
      withdrawn_at = null
  from public.story_profiles sp, public.activity_logs al
  where sa.id = p_achievement_id
    and sp.id = sa.story_profile_id
    and sp.owner_user_id = v_caller_user_id
    and al.profile_id = sp.owner_profile_id
    and al.source_service = sa.source_service
    and al.source_service = 'marketnote'
    and al.source_record_id = sa.source_record_id
    and al.status = 'confirmed'
    and al.ended_at < (now() at time zone 'Asia/Tokyo')::date;

  if not found then
    raise exception 'Owned STORY achievement was not found.' using errcode = 'P0002';
  end if;

  return query
  select sa.id,
         sa.display_mode,
         sa.publication_status,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location,
         sa.published_at,
         sa.updated_at
  from public.story_achievements sa
  where sa.id = p_achievement_id;
end;
$$;

revoke all on function public.story_achievement_publish_mine(uuid) from public, anon, authenticated;
grant execute on function public.story_achievement_publish_mine(uuid) to authenticated;

create function public.story_achievement_withdraw_mine(p_achievement_id uuid)
returns table (
  achievement_id uuid,
  display_mode text,
  publication_status text,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_user_id uuid := (select auth.uid());
begin
  if v_caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.story_achievements sa
  set publication_status = 'withdrawn',
      withdrawn_at = now()
  from public.story_profiles sp
  where sa.id = p_achievement_id
    and sp.id = sa.story_profile_id
    and sp.owner_user_id = v_caller_user_id;

  if not found then
    raise exception 'Owned STORY achievement was not found.' using errcode = 'P0002';
  end if;

  return query
  select sa.id,
         sa.display_mode,
         sa.publication_status,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location,
         sa.published_at,
         sa.updated_at
  from public.story_achievements sa
  where sa.id = p_achievement_id;
end;
$$;

revoke all on function public.story_achievement_withdraw_mine(uuid) from public, anon, authenticated;
grant execute on function public.story_achievement_withdraw_mine(uuid) to authenticated;

create function public.story_achievement_withdraw_from_marketnote(p_source_record_id uuid)
returns table (
  achievement_id uuid,
  source_record_id text,
  display_mode text,
  publication_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_achievement_id uuid;
begin
  if v_caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.story_achievements sa
  set publication_status = 'withdrawn',
      withdrawn_at = now()
  from public.story_profiles sp
  where sp.id = sa.story_profile_id
    and sp.owner_user_id = v_caller_user_id
    and sa.source_service = 'marketnote'
    and sa.source_record_id = p_source_record_id::text
  returning sa.id into v_achievement_id;

  if v_achievement_id is null then
    raise exception 'Owned STORY achievement was not found.' using errcode = 'P0002';
  end if;

  return query
  select sa.id,
         sa.source_record_id,
         sa.display_mode,
         sa.publication_status
  from public.story_achievements sa
  where sa.id = v_achievement_id;
end;
$$;

revoke all on function public.story_achievement_withdraw_from_marketnote(uuid) from public, anon, authenticated;
grant execute on function public.story_achievement_withdraw_from_marketnote(uuid) to authenticated;

create function public.story_achievement_metric_options_mine()
returns table (
  source_service text,
  metric_key text,
  suggested_label text,
  achievement_count bigint,
  selected boolean,
  selected_label text,
  sort_order smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with my_story as (
    select sp.id as story_profile_id, sp.owner_profile_id
    from public.story_profiles sp
    where sp.owner_user_id = (select auth.uid())
    limit 1
  ),
  explicit_sources as (
    select sa.story_profile_id, sa.source_service, sa.source_record_id
    from public.story_achievements sa
    join my_story ms on ms.story_profile_id = sa.story_profile_id
    where sa.published_at is not null
  ),
  distinct_sources as (
    select ms.story_profile_id, al.source_service, al.source_record_id, al.subject_type_key as metric_key
    from my_story ms
    join public.activity_logs al on al.profile_id = ms.owner_profile_id
    where al.source_service = 'marketnote'
      and al.source_record_id is not null
      and al.subject_type_key is not null
      and al.counts_toward_summary = true
      and al.status = 'confirmed'
      and al.ended_at < (now() at time zone 'Asia/Tokyo')::date
      and not exists (
        select 1
        from explicit_sources es
        where es.story_profile_id = ms.story_profile_id
          and es.source_service = al.source_service
          and es.source_record_id = al.source_record_id
      )
    union
    select sa.story_profile_id, sa.source_service, sa.source_record_id, sa.metric_key
    from public.story_achievements sa
    join my_story ms on ms.story_profile_id = sa.story_profile_id
    where sa.publication_status = 'published'
      and sa.display_mode in ('count_only', 'card_and_count')
  ),
  counts as (
    select ds.story_profile_id, ds.source_service, ds.metric_key, count(*)::bigint as achievement_count
    from (
      select distinct story_profile_id, source_service, source_record_id, metric_key
      from distinct_sources
    ) ds
    group by ds.story_profile_id, ds.source_service, ds.metric_key
  )
  select c.source_service,
         c.metric_key,
         met.name as suggested_label,
         c.achievement_count,
         (settings.metric_key is not null) as selected,
         settings.public_label as selected_label,
         settings.sort_order
  from counts c
  join my_story ms on ms.story_profile_id = c.story_profile_id
  join public.market_event_types met
    on met.profile_id = ms.owner_profile_id
   and met.id::text = c.metric_key
  left join public.story_achievement_metric_settings settings
    on settings.story_profile_id = c.story_profile_id
   and settings.source_service = c.source_service
   and settings.metric_key = c.metric_key
  order by settings.sort_order nulls last, c.achievement_count desc, met.name;
$$;

revoke all on function public.story_achievement_metric_options_mine() from public, anon, authenticated;
grant execute on function public.story_achievement_metric_options_mine() to authenticated;

create function public.story_achievement_metric_settings_save_mine(p_items jsonb)
returns table (
  source_service text,
  metric_key text,
  public_label text,
  sort_order smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_story_profile_id uuid;
  v_owner_profile_id uuid;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if v_caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 3 then
    raise exception 'STORY can display at most three achievement metrics.' using errcode = '22023';
  end if;

  select sp.id, sp.owner_profile_id
  into v_story_profile_id, v_owner_profile_id
  from public.story_profiles sp
  where sp.owner_user_id = v_caller_user_id
  limit 1
  for update of sp;

  if v_story_profile_id is null then
    raise exception 'STORY profile is required before selecting metrics.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_items) as item(
      source_service text,
      metric_key text,
      public_label text,
      sort_order smallint
    )
    where item.source_service is distinct from 'marketnote'
       or item.metric_key is null
       or nullif(btrim(item.public_label), '') is null
       or char_length(btrim(item.public_label)) > 40
       or item.sort_order is null
       or item.sort_order not between 0 and 2
  ) then
    raise exception 'Invalid STORY metric setting.' using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(v_items) as item(
      source_service text,
      metric_key text,
      public_label text,
      sort_order smallint
    )
  ) <> (
    select count(distinct (item.source_service, item.metric_key))
    from jsonb_to_recordset(v_items) as item(
      source_service text,
      metric_key text,
      public_label text,
      sort_order smallint
    )
  ) or (
    select count(*)
    from jsonb_to_recordset(v_items) as item(
      source_service text,
      metric_key text,
      public_label text,
      sort_order smallint
    )
  ) <> (
    select count(distinct item.sort_order)
    from jsonb_to_recordset(v_items) as item(
      source_service text,
      metric_key text,
      public_label text,
      sort_order smallint
    )
  ) then
    raise exception 'STORY metric keys and sort positions must be unique.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_items) as item(
      source_service text,
      metric_key text,
      public_label text,
      sort_order smallint
    )
    where not exists (
      select 1
      from public.market_event_types met
      where met.profile_id = v_owner_profile_id
        and met.user_id = v_caller_user_id
        and met.id::text = item.metric_key
    )
  ) then
    raise exception 'A selected STORY metric does not belong to the authenticated user.' using errcode = '42501';
  end if;

  delete from public.story_achievement_metric_settings settings
  where settings.story_profile_id = v_story_profile_id;

  insert into public.story_achievement_metric_settings (
    story_profile_id,
    source_service,
    metric_key,
    public_label,
    sort_order
  )
  select v_story_profile_id,
         item.source_service,
         item.metric_key,
         btrim(item.public_label),
         item.sort_order
  from jsonb_to_recordset(v_items) as item(
    source_service text,
    metric_key text,
    public_label text,
    sort_order smallint
  );

  return query
  select settings.source_service,
         settings.metric_key,
         settings.public_label,
         settings.sort_order
  from public.story_achievement_metric_settings settings
  where settings.story_profile_id = v_story_profile_id
  order by settings.sort_order;
end;
$$;

revoke all on function public.story_achievement_metric_settings_save_mine(jsonb) from public, anon, authenticated;
grant execute on function public.story_achievement_metric_settings_save_mine(jsonb) to authenticated;

create function public.story_public_achievement_cards(p_handle text)
returns table (
  achievement_id uuid,
  public_title text,
  public_type_label text,
  occurred_on date,
  public_location text,
  public_note text,
  public_photo_storage_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select sa.id,
         sa.public_title,
         sa.public_type_label,
         sa.occurred_on,
         sa.public_location,
         sa.public_note,
         sa.public_photo_storage_path
  from public.story_profiles sp
  join public.story_achievements sa on sa.story_profile_id = sp.id
  where lower(sp.handle) = lower(btrim(p_handle))
    and sp.publication_status = 'published'
    and sa.publication_status = 'published'
    and sa.display_mode in ('card_only', 'card_and_count')
  order by sa.sort_order, sa.occurred_on desc, sa.created_at desc;
$$;

revoke all on function public.story_public_achievement_cards(text) from public, anon, authenticated;
grant execute on function public.story_public_achievement_cards(text) to anon, authenticated;

create function public.story_public_achievement_metrics(p_handle text)
returns table (
  public_label text,
  achievement_count bigint,
  sort_order smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with published_story as (
    select sp.id as story_profile_id, sp.owner_profile_id
    from public.story_profiles sp
    where lower(sp.handle) = lower(btrim(p_handle))
      and sp.publication_status = 'published'
    limit 1
  ),
  explicit_sources as (
    select sa.story_profile_id, sa.source_service, sa.source_record_id
    from public.story_achievements sa
    join published_story ps on ps.story_profile_id = sa.story_profile_id
    where sa.published_at is not null
  ),
  eligible_sources as (
    select ps.story_profile_id, al.source_service, al.source_record_id, al.subject_type_key as metric_key
    from published_story ps
    join public.activity_logs al on al.profile_id = ps.owner_profile_id
    where al.source_service = 'marketnote'
      and al.source_record_id is not null
      and al.subject_type_key is not null
      and al.counts_toward_summary = true
      and al.status = 'confirmed'
      and al.ended_at < (now() at time zone 'Asia/Tokyo')::date
      and not exists (
        select 1
        from explicit_sources es
        where es.story_profile_id = ps.story_profile_id
          and es.source_service = al.source_service
          and es.source_record_id = al.source_record_id
      )
    union
    select sa.story_profile_id, sa.source_service, sa.source_record_id, sa.metric_key
    from public.story_achievements sa
    join published_story ps on ps.story_profile_id = sa.story_profile_id
    where sa.publication_status = 'published'
      and sa.display_mode in ('count_only', 'card_and_count')
  ),
  distinct_sources as (
    select distinct story_profile_id, source_service, source_record_id, metric_key
    from eligible_sources
  ),
  counts as (
    select ds.story_profile_id, ds.source_service, ds.metric_key, count(*)::bigint as achievement_count
    from distinct_sources ds
    group by ds.story_profile_id, ds.source_service, ds.metric_key
  )
  select settings.public_label,
         coalesce(counts.achievement_count, 0)::bigint,
         settings.sort_order
  from published_story ps
  join public.story_achievement_metric_settings settings
    on settings.story_profile_id = ps.story_profile_id
  left join counts
    on counts.story_profile_id = settings.story_profile_id
   and counts.source_service = settings.source_service
   and counts.metric_key = settings.metric_key
  order by settings.sort_order
  limit 3;
$$;

revoke all on function public.story_public_achievement_metrics(text) from public, anon, authenticated;
grant execute on function public.story_public_achievement_metrics(text) to anon, authenticated;

comment on function public.story_achievement_stage_from_marketnote(uuid, text, text, text, date, text) is
  'Validates an owned MarketNote source whose private Activity Log is confirmed and ended before today in JST; derives metric_key in the database; and stages a private STORY snapshot.';
comment on function public.story_public_achievement_metrics(text) is
  'Returns at most three configured aggregate numbers. Activity Log and manual STORY sources are never added directly; source identity is deduplicated first.';
