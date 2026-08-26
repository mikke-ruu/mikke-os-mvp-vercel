-- MarketNote schedule projection foundation.
--
-- This stores private, read-only calendar projections from Google and other
-- mikkeOS apps. It is intentionally separate from market_events and
-- activity_logs: projections do not become MarketNote records, activity, or
-- STORY achievements until a later explicit conversion flow is approved.

create table public.market_schedule_source_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_service text not null,
  source_calendar_key text not null default 'default',
  source_label text,
  is_visible boolean not null default true,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_schedule_source_preferences_service_check
    check (source_service ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint market_schedule_source_preferences_calendar_key_check
    check (length(btrim(source_calendar_key)) between 1 and 200),
  constraint market_schedule_source_preferences_label_check
    check (source_label is null or length(btrim(source_label)) between 1 and 80),
  constraint market_schedule_source_preferences_google_manual_identity_check
    check (
      source_service <> 'google_manual'
      or (
        source_calendar_key = 'ics_manual'
        and source_label is not null
        and source_label = 'Googleカレンダー（手動取り込み）'
      )
    ),
  constraint market_schedule_source_preferences_owner_source_key
    unique (user_id, source_service, source_calendar_key)
);

comment on table public.market_schedule_source_preferences is
  'Private per-user visibility and notification preferences for MarketNote schedule sources. Visibility never deletes or stops the source.';
comment on column public.market_schedule_source_preferences.source_calendar_key is
  'Stable non-sensitive source/calendar key. Do not store an email address or OAuth token here.';
comment on column public.market_schedule_source_preferences.notifications_enabled is
  'Independent from calendar visibility. Notification delivery is a later phase.';

create table public.market_schedule_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_service text not null,
  source_calendar_key text not null default 'default',
  source_record_id text not null,
  occurrence_key text not null default 'single',
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  starts_on date,
  ends_on_exclusive date,
  all_day boolean not null default false,
  time_zone text not null default 'Asia/Tokyo',
  location text,
  status text not null default 'active',
  source_href text,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_schedule_projections_service_check
    check (source_service ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint market_schedule_projections_calendar_key_check
    check (length(btrim(source_calendar_key)) between 1 and 200),
  constraint market_schedule_projections_source_record_check
    check (length(btrim(source_record_id)) between 1 and 500),
  constraint market_schedule_projections_google_manual_identity_check
    check (
      source_service <> 'google_manual'
      or (
        source_calendar_key = 'ics_manual'
        and source_record_id ~ '^uid_[0-9a-f]{64}$'
      )
    ),
  constraint market_schedule_projections_occurrence_key_check
    check (length(btrim(occurrence_key)) between 1 and 200),
  constraint market_schedule_projections_title_check
    check (length(btrim(title)) between 1 and 200),
  constraint market_schedule_projections_time_zone_check
    check (length(btrim(time_zone)) between 1 and 100),
  constraint market_schedule_projections_location_check
    check (location is null or length(btrim(location)) between 1 and 200),
  constraint market_schedule_projections_status_check
    check (status in ('active', 'cancelled', 'withdrawn')),
  constraint market_schedule_projections_source_href_check
    check (
      source_href is null
      or (
        length(source_href) between 1 and 500
        and source_href like '/%'
        and source_href not like '//%'
        and source_href !~ '[[:cntrl:]\\]'
      )
    ),
  constraint market_schedule_projections_temporal_shape_check
    check (
      (
        all_day
        and starts_on is not null
        and ends_on_exclusive is not null
        and ends_on_exclusive > starts_on
        and starts_at is null
        and ends_at is null
      )
      or (
        not all_day
        and starts_at is not null
        and (ends_at is null or ends_at >= starts_at)
        and starts_on is null
        and ends_on_exclusive is null
      )
    ),
  constraint market_schedule_projections_owner_source_occurrence_key
    unique (user_id, source_service, source_calendar_key, source_record_id, occurrence_key)
);

comment on table public.market_schedule_projections is
  'Private read-only schedule cache/projection. It never creates Activity Log or STORY rows and is not a MarketNote event.';
comment on column public.market_schedule_projections.source_record_id is
  'Stable ID from the source. For recurring schedules, pair with occurrence_key; never use a series ID alone.';
comment on column public.market_schedule_projections.ends_on_exclusive is
  'Exclusive end date for all-day schedules, matching iCalendar DTEND semantics.';
comment on column public.market_schedule_projections.source_href is
  'Optional internal relative route back to the source app. External URLs are rejected.';

create index market_schedule_source_preferences_owner_idx
  on public.market_schedule_source_preferences (user_id, source_service, source_calendar_key);

create index market_schedule_projections_owner_time_idx
  on public.market_schedule_projections (user_id, starts_at, starts_on);

create index market_schedule_projections_owner_source_updated_idx
  on public.market_schedule_projections (user_id, source_service, source_updated_at desc);

create unique index market_schedule_projections_google_manual_occurrence_key
  on public.market_schedule_projections (
    user_id, source_service, source_record_id, occurrence_key
  )
  where source_service = 'google_manual';

create function public.set_marketnote_schedule_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_marketnote_schedule_updated_at() from public, anon, authenticated;
grant execute on function public.set_marketnote_schedule_updated_at() to postgres, service_role;

create trigger set_market_schedule_source_preferences_updated_at
before update on public.market_schedule_source_preferences
for each row execute function public.set_marketnote_schedule_updated_at();

create trigger set_market_schedule_projections_updated_at
before update on public.market_schedule_projections
for each row execute function public.set_marketnote_schedule_updated_at();

alter table public.market_schedule_source_preferences enable row level security;
alter table public.market_schedule_projections enable row level security;

revoke all on table public.market_schedule_source_preferences from anon, authenticated;
revoke all on table public.market_schedule_projections from anon, authenticated;

grant select, insert, update on table public.market_schedule_source_preferences to authenticated;
grant select on table public.market_schedule_projections to authenticated;
grant select, insert, update, delete on table public.market_schedule_source_preferences to service_role;
grant select, insert, update, delete on table public.market_schedule_projections to service_role;

create policy market_schedule_source_preferences_select_owner
on public.market_schedule_source_preferences for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and not (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
);

create policy market_schedule_source_preferences_insert_owner
on public.market_schedule_source_preferences for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and not (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
);

create policy market_schedule_source_preferences_update_owner
on public.market_schedule_source_preferences for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and not (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and not (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
);

create policy market_schedule_projections_select_owner
on public.market_schedule_projections for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and not (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
);
