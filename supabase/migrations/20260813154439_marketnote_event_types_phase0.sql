-- Phase 0: move authenticated MarketNote event-type settings from browser
-- localStorage to profile-scoped Supabase rows with stable UUIDs.

create table if not exists public.market_event_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#3f4eb5',
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_event_types_name_not_blank check (length(btrim(name)) > 0),
  constraint market_event_types_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint market_event_types_profile_name_key unique (profile_id, name),
  constraint market_event_types_profile_id_key unique (profile_id, id)
);

comment on table public.market_event_types is
  'Profile-scoped MarketNote event-type settings. Stable IDs are used by Activity Log integration.';

create index if not exists market_event_types_profile_order_idx
  on public.market_event_types (profile_id, is_active desc, sort_order, created_at);

create or replace function public.set_market_event_types_updated_at()
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

revoke all on function public.set_market_event_types_updated_at() from public, anon, authenticated;
grant execute on function public.set_market_event_types_updated_at() to postgres, service_role;

drop trigger if exists set_market_event_types_updated_at on public.market_event_types;
create trigger set_market_event_types_updated_at
before update on public.market_event_types
for each row execute function public.set_market_event_types_updated_at();

alter table public.market_event_types enable row level security;

revoke all on table public.market_event_types from anon, authenticated;
grant select, insert, update on table public.market_event_types to authenticated;
grant select, insert, update, delete on table public.market_event_types to service_role;

drop policy if exists market_event_types_select_owner on public.market_event_types;
drop policy if exists market_event_types_insert_owner on public.market_event_types;
drop policy if exists market_event_types_update_owner on public.market_event_types;
drop policy if exists market_event_types_delete_owner on public.market_event_types;

create policy market_event_types_select_owner
on public.market_event_types for select to authenticated
using ((select auth.uid()) = user_id);

create policy market_event_types_insert_owner
on public.market_event_types for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  )
);

create policy market_event_types_update_owner
on public.market_event_types for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  )
);

alter table public.market_events
  add column if not exists event_type_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.market_events'::regclass
      and conname = 'market_events_event_type_id_fkey'
  ) then
    alter table public.market_events
      add constraint market_events_event_type_id_fkey
      foreign key (profile_id, event_type_id)
      references public.market_event_types(profile_id, id)
      on delete restrict;
  end if;
end
$$;

create index if not exists market_events_event_type_id_idx
  on public.market_events (event_type_id);

with event_type_names as (
  select distinct
    event.user_id,
    event.profile_id,
    coalesce(nullif(btrim(event.genre), ''), '出店') as name
  from public.market_events event
), ordered_names as (
  select
    event_type_names.*,
    row_number() over (partition by profile_id order by name) as position
  from event_type_names
)
insert into public.market_event_types (
  user_id,
  profile_id,
  name,
  color,
  is_default,
  is_active,
  sort_order
)
select
  user_id,
  profile_id,
  name,
  (array['#f9d3d2', '#ffd370', '#3f4eb5', '#8bc7ad', '#f75a3b'])[
    (((position - 1) % 5) + 1)::integer
  ],
  false,
  true,
  position::integer
from ordered_names
on conflict (profile_id, name) do nothing;

update public.market_events event
set event_type_id = event_type.id
from public.market_event_types event_type
where event.event_type_id is null
  and event_type.profile_id = event.profile_id
  and event_type.name = coalesce(nullif(btrim(event.genre), ''), '出店');

comment on column public.market_events.event_type_id is
  'Stable MarketNote event type. genre remains as the display-name snapshot during migration.';
